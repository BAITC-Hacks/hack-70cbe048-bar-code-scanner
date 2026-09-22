import express from 'express';
import {adminAuth,rateLimit} from './security.js';
import cors from 'cors';
import multer from 'multer';
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { lookup } from './galmart.js';
import { isCity, validEan, requiredPrice } from './validation.js';
import { createDb, history, save } from './db.js';
import {
  createStore,
  importStoreItems,
  listStoreCatalog,
  listStores,
  lookupStorePrice,
  upsertStoreItem,
} from './merchant.js';
import { createObservation, listObservations } from './observations.js';
import { comparePrices } from './compare.js';
import { retailerResearchRegistry, getRetailerAdapter } from './retailers/index.js';
import { listDirectoryStores, syncRetailerStores } from './store-directory.js';

function apiError(res: express.Response, error: unknown) {
  const code = error instanceof Error ? error.message : 'UNKNOWN';

  const map: Record<string, [number, string]> = {
    RESERVED_RETAILER_NAME: [400, 'Название сети зарезервировано для официального источника.'],
    STORE_NAME_REQUIRED: [400, 'Введите название магазина.'],
    STORE_CITY_REQUIRED: [400, 'Введите город.'],
    STORE_ADDRESS_REQUIRED: [400, 'Введите адрес магазина.'],
    STORE_NOT_FOUND: [404, 'Магазин не найден.'],
    STORE_NOT_MERCHANT: [400, 'Эта точка доступна только для наблюдений и не является merchant-каталогом.'],
    INVALID_EAN: [400, 'Некорректный EAN/GTIN.'],
    INVALID_PRICE: [400, 'Цена должна быть числом не меньше нуля.'],
    INVALID_OLD_PRICE: [400, 'Старая цена должна быть числом не меньше нуля.'],
    INVALID_OBSERVED_AT: [400, 'Некорректная дата наблюдения.'],
    ITEMS_REQUIRED: [400, 'В импорте нет товаров.'],
    TOO_MANY_ITEMS: [400, 'За один импорт можно загрузить не более 5000 товаров.'],
  };

  const [status, message] = map[code] ?? [500, 'Не удалось выполнить операцию.'];
  return res.status(status).json({ status: 'error', code, message });
}

function buildObservationUpload() {
  const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'data', 'uploads');
  mkdirSync(uploadDir, { recursive: true });

  const extByMime: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = extByMime[file.mimetype];
      cb(null, `${randomUUID()}${ext}`);
    },
  });

  return {
    upload: multer({
      storage,
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!extByMime[file.mimetype]) {
          return cb(new Error('INVALID_IMAGE_TYPE'));
        }
        return cb(null, true);
      },
    }),
    uploadDir,
  };
}

export function createApp(db = createDb(':memory:')) {
  const app = express();
  const { upload, uploadDir } = buildObservationUpload();

  app.use(express.json({ limit: '2mb' }));
  app.use(cors());
  app.post('/api/v1/stores', rateLimit(20));
  app.post('/api/v1/observations', rateLimit(30));
  app.post('/api/v1/stores/:storeId/import', rateLimit(10));
  app.post('/api/v1/stores/:storeId/products', rateLimit(60));
  app.get('/api/v1/compare', rateLimit(60));
  app.get('/api/v1/admin/observations', adminAuth, (_req,res) => {
    res.json(db.prepare("SELECT * FROM user_observations WHERE status='pending' ORDER BY id LIMIT 100").all());
  });
  app.patch('/api/v1/admin/observations/:id', adminAuth, (req,res) => {
    const status=req.body?.status;
    if(!['verified','rejected'].includes(status)) return res.status(400).json({code:'INVALID_STATUS'});
    const row=db.prepare('SELECT status FROM user_observations WHERE id=?').get(Number(req.params.id)) as any;
    if(!row) return res.status(404).json({code:'NOT_FOUND'});
    if(row.status!=='pending') return res.status(409).json({code:'ALREADY_MODERATED'});
    db.prepare('UPDATE user_observations SET status=? WHERE id=?').run(status,Number(req.params.id));
    return res.json({id:Number(req.params.id),status,source_type:'user_reported'});
  });
  app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  app.use('/uploads', express.static(uploadDir, { dotfiles: 'deny', setHeaders(res) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  }}));

  // Legacy Galmart endpoint kept for compatibility with the existing MVP.
  app.get('/api/v1/price', async (req, res) => {
    const ean = String(req.query.ean ?? '');
    const city = String(req.query.city ?? 'astana');

    if (!validEan(ean)) {
      return res.status(400).json({
        status: 'invalid',
        message:
          'EAN должен содержать 8, 12, 13 или 14 цифр и иметь корректную контрольную цифру.',
      });
    }

    if (!isCity(city)) {
      return res.status(400).json({
        status: 'invalid',
        message: 'Поддерживаются города astana и almaty.',
      });
    }

    const result = await lookup(ean, city);
    save(db, result);
    return res.json(result);
  });

  app.get('/api/v1/compare', async (req, res) => {
    const ean = String(req.query.ean ?? '');
    const city = String(req.query.city ?? 'astana');

    if (!validEan(ean)) {
      return res.status(400).json({
        status: 'invalid',
        message: 'Некорректный EAN/GTIN.',
      });
    }

    if (!isCity(city)) {
      return res.status(400).json({
        status: 'invalid',
        message: 'Поддерживаются города astana и almaty.',
      });
    }

    try {
      return res.json(await comparePrices(db, ean, city, req.query.refresh === '1'));
    } catch {
      return res.status(500).json({
        status: 'source_error',
        message: 'Не удалось выполнить сравнение цен.',
      });
    }
  });

  app.get('/api/v1/retailers', (_req, res) => {
    return res.json(retailerResearchRegistry);
  });

  app.get('/api/v1/retailers/:retailerId/stores', async (req, res) => {
    const adapter = getRetailerAdapter(req.params.retailerId);
    if (!adapter?.listStores) {
      return res.status(404).json({
        status: 'not_available',
        message: 'Для этого источника список магазинов пока не подключён.',
      });
    }

    try {
      return res.json(await adapter.listStores());
    } catch {
      return res.status(502).json({
        status: 'source_error',
        message: 'Не удалось получить список магазинов.',
      });
    }
  });

  app.get('/api/v1/history', (_req, res) => res.json(history(db)));

  app.get('/api/v1/store-directory', async (req, res) => {
    const city = req.query.city == null ? undefined : String(req.query.city);
    const shouldSync = String(req.query.sync ?? '1') !== '0';

    let sync = { synced: [] as Array<{ retailer: string; count: number }>, errors: [] as Array<{ retailer: string; message: string }> };
    if (shouldSync) {
      sync = await syncRetailerStores(db);
    }

    return res.json({
      stores: listDirectoryStores(db, { city }),
      sync,
    });
  });

  app.get('/api/v1/stores', (_req, res) => {
    return res.json(listStores(db));
  });

  app.post('/api/v1/stores', (req, res) => {
    try {
      const store = createStore(db, {
        name: String(req.body?.name ?? ''),
        city: String(req.body?.city ?? ''),
        address: String(req.body?.address ?? ''),
      });
      return res.status(201).json(store);
    } catch (error) {
      return apiError(res, error);
    }
  });

  app.get('/api/v1/stores/:storeId/catalog', (req, res) => {
    try {
      return res.json(listStoreCatalog(db, Number(req.params.storeId)));
    } catch (error) {
      return apiError(res, error);
    }
  });

  app.post('/api/v1/stores/:storeId/products', (req, res) => {
    try {
      const item = upsertStoreItem(db, Number(req.params.storeId), {
        ean: String(req.body?.ean ?? ''),
        name: req.body?.name == null ? undefined : String(req.body.name),
        brand: req.body?.brand == null ? undefined : String(req.body.brand),
        pack: req.body?.pack == null ? undefined : String(req.body.pack),
        price_kzt: requiredPrice(req.body?.price_kzt),
        old_price_kzt:
          req.body?.old_price_kzt == null || req.body.old_price_kzt === ''
            ? null
            : Number(req.body.old_price_kzt),
        available: req.body?.available !== false,
      });
      return res.json(item);
    } catch (error) {
      return apiError(res, error);
    }
  });

  app.post('/api/v1/stores/:storeId/import', (req, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const imported = importStoreItems(
        db,
        Number(req.params.storeId),
        items.map((item: any) => ({
          ean: String(item?.ean ?? ''),
          name: item?.name == null ? undefined : String(item.name),
          brand: item?.brand == null ? undefined : String(item.brand),
          pack: item?.pack == null ? undefined : String(item.pack),
          price_kzt: requiredPrice(item?.price_kzt),
          old_price_kzt:
            item?.old_price_kzt == null || item.old_price_kzt === ''
              ? null
              : Number(item.old_price_kzt),
          available: item?.available !== false,
        })),
      );

      return res.json({ status: 'ok', imported: imported.length });
    } catch (error) {
      return apiError(res, error);
    }
  });

  app.get('/api/v1/stores/:storeId/price', (req, res) => {
    try {
      const ean = String(req.query.ean ?? '');
      if (!validEan(ean)) {
        return res.status(400).json({
          status: 'invalid',
          message: 'Некорректный EAN/GTIN.',
        });
      }

      return res.json(lookupStorePrice(db, Number(req.params.storeId), ean));
    } catch (error) {
      return apiError(res, error);
    }
  });

  app.get('/api/v1/observations', (req, res) => {
    const ean = req.query.ean == null ? undefined : String(req.query.ean);
    const storeId =
      req.query.store_id == null ? undefined : Number(req.query.store_id);

    if (ean && !validEan(ean)) {
      return res.status(400).json({ status: 'invalid', message: 'Некорректный EAN/GTIN.' });
    }

    try {
      return res.json(listObservations(db, { ean, storeId, limit: 50 }));
    } catch (error) {
      return apiError(res, error);
    }
  });

  app.post('/api/v1/observations', (req, res, next) => {
    upload.single('photo')(req, res, (error) => {
      if (error) return next(error);
      try {
        if (req.file) {
          const b = readFileSync(req.file.path);
          const mime = b.length >= 12 && b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'image/jpeg'
            : b.length >= 24 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
            : b.length >= 16 && b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP' ? 'image/webp' : '';
          if (mime !== req.file.mimetype) {
            unlinkSync(req.file.path);
            return next(new Error('INVALID_IMAGE_TYPE'));
          }
        }
        const observation = createObservation(db, {
          storeId: Number(req.body?.store_id),
          ean: String(req.body?.ean ?? ''),
          priceKzt: requiredPrice(req.body?.observed_price_kzt),
          oldPriceKzt:
            req.body?.old_price_kzt == null || req.body.old_price_kzt === ''
              ? null
              : Number(req.body.old_price_kzt),
          observedAt: String(req.body?.observed_at ?? ''),
          photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
          comment: req.body?.comment == null ? null : String(req.body.comment),
        });
        return res.status(201).json(observation);
      } catch (createError) {
        if (req.file) { try { unlinkSync(req.file.path); } catch {} }
        return apiError(res, createError);
      }
    });
  });

  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error?.message === 'INVALID_IMAGE_TYPE') {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_IMAGE_TYPE',
        message: 'Допустимы только JPEG, PNG и WebP.',
      });
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        code: 'IMAGE_TOO_LARGE',
        message: 'Фото должно быть не больше 5 МБ.',
      });
    }

    if (error instanceof multer.MulterError || /multipart|boundary|Unexpected end/i.test(error?.message ?? '') || error?.type === 'entity.parse.failed') {
      return res.status(400).json({status:'error', code:'MALFORMED_REQUEST', message:'Некорректный запрос.'});
    }
    return res.status(500).json({
      status: 'error',
      message: 'Не удалось обработать запрос.',
    });
  });

  return app;
}

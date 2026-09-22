import type Database from 'better-sqlite3';
import { validEan, requiredPrice } from './validation.js';

export interface MerchantItemInput {
  ean: string;
  name?: string;
  brand?: string | null;
  pack?: string | null;
  price_kzt: number;
  old_price_kzt?: number | null;
  available?: boolean;
}

export function listStores(db: Database.Database) {
  return db
    .prepare(`
      SELECT
        s.id,
        s.name,
        s.city,
        s.address,
        s.created_at,
        s.updated_at,
        COUNT(sp.ean) AS product_count
      FROM stores s
      LEFT JOIN store_products sp ON sp.store_id = s.id
      WHERE COALESCE(s.kind,'merchant')='merchant'
      GROUP BY s.id
      ORDER BY s.id DESC
    `)
    .all();
}

export function getStore(db: Database.Database, storeId: number) {
  return db
    .prepare('SELECT id,name,city,address,kind,retailer_id,external_store_id,latitude,longitude,created_at,updated_at FROM stores WHERE id=?')
    .get(storeId) as any;
}

export function createStore(
  db: Database.Database,
  input: { name: string; city: string; address: string },
) {
  const name = input.name.trim();
  const city = input.city.trim();
  const address = input.address.trim();

  if (!name) throw new Error('STORE_NAME_REQUIRED');
  if (!city) throw new Error('STORE_CITY_REQUIRED');
  if (!address) throw new Error('STORE_ADDRESS_REQUIRED');

  const reserved = new Set(['magnum','magnumgo','galmart','small','metro','metro kazakhstan','anvar','toimart','arbuz','arbuz.kz','carefood','firkan24','a-store','fix price','fix price kazakhstan','ayan market','магнум','галмарт','смолл','метро','анвар','тоймарт']);
  if (reserved.has(name.toLowerCase().replace(/\s+/g, ' '))) throw new Error('RESERVED_RETAILER_NAME');
  const now = new Date().toISOString();
  const result = db
    .prepare(
      "INSERT INTO stores (name,city,address,kind,created_at,updated_at) VALUES (?,?,?,'merchant',?,?)",
    )
    .run(name, city, address, now, now);

  return getStore(db, Number(result.lastInsertRowid));
}

export function upsertStoreItem(
  db: Database.Database,
  storeId: number,
  input: MerchantItemInput,
) {
  const store = getStore(db, storeId);
  if (!store) throw new Error('STORE_NOT_FOUND');
  if (store.kind && store.kind !== 'merchant') throw new Error('STORE_NOT_MERCHANT');

  const ean = String(input.ean ?? '').trim();
  if (!validEan(ean)) throw new Error('INVALID_EAN');

  const price = requiredPrice(input.price_kzt);
  if (!Number.isFinite(price) || price < 0) throw new Error('INVALID_PRICE');

  const oldPrice =
    input.old_price_kzt == null || input.old_price_kzt === ('' as any)
      ? null
      : Number(input.old_price_kzt);
  if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < 0)) {
    throw new Error('INVALID_OLD_PRICE');
  }

  const existingProduct = db
    .prepare('SELECT ean,name,brand,pack,image_url FROM products WHERE ean=?')
    .get(ean) as any;

  const name = String(input.name ?? existingProduct?.name ?? `Товар ${ean}`).trim();
  const brand =
    input.brand === undefined ? existingProduct?.brand ?? null : input.brand?.trim() || null;
  const pack =
    input.pack === undefined ? existingProduct?.pack ?? null : input.pack?.trim() || null;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO products (ean,name,brand,pack,image_url,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(ean) DO UPDATE SET
      name=CASE
        WHEN excluded.name LIKE 'Товар %' AND products.name NOT LIKE 'Товар %' THEN products.name
        ELSE excluded.name
      END,
      brand=COALESCE(excluded.brand,products.brand),
      pack=COALESCE(excluded.pack,products.pack),
      updated_at=excluded.updated_at
  `).run(ean, name, brand, pack, existingProduct?.image_url ?? null, now, now);

  db.prepare(`
    INSERT INTO store_products (store_id,ean,price_kzt,old_price_kzt,available,updated_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(store_id,ean) DO UPDATE SET
      price_kzt=excluded.price_kzt,
      old_price_kzt=excluded.old_price_kzt,
      available=excluded.available,
      updated_at=excluded.updated_at
  `).run(
    storeId,
    ean,
    price,
    oldPrice,
    input.available === false ? 0 : 1,
    now,
  );

  return lookupStorePrice(db, storeId, ean);
}

export function importStoreItems(
  db: Database.Database,
  storeId: number,
  items: MerchantItemInput[],
) {
  const store = getStore(db, storeId);
  if (!store) throw new Error('STORE_NOT_FOUND');
  if (store.kind && store.kind !== 'merchant') throw new Error('STORE_NOT_MERCHANT');
  if (!Array.isArray(items) || items.length === 0) throw new Error('ITEMS_REQUIRED');
  if (items.length > 5000) throw new Error('TOO_MANY_ITEMS');

  const tx = db.transaction((rows: MerchantItemInput[]) =>
    rows.map((item) => upsertStoreItem(db, storeId, item)),
  );

  return tx(items);
}

export function listStoreCatalog(db: Database.Database, storeId: number) {
  const store = getStore(db, storeId);
  if (!store) throw new Error('STORE_NOT_FOUND');
  if (store.kind && store.kind !== 'merchant') throw new Error('STORE_NOT_MERCHANT');

  return db
    .prepare(`
      SELECT
        p.ean,
        p.name,
        p.brand,
        p.pack,
        p.image_url,
        sp.price_kzt,
        sp.old_price_kzt,
        sp.available,
        sp.updated_at
      FROM store_products sp
      JOIN products p ON p.ean = sp.ean
      WHERE sp.store_id = ?
      ORDER BY sp.updated_at DESC, p.name ASC
    `)
    .all(storeId)
    .map((row: any) => ({ ...row, available: Boolean(row.available) }));
}

export function lookupStorePrice(
  db: Database.Database,
  storeId: number,
  ean: string,
) {
  const store = getStore(db, storeId);
  if (!store) throw new Error('STORE_NOT_FOUND');
  if (store.kind && store.kind !== 'merchant') throw new Error('STORE_NOT_MERCHANT');

  const item = db
    .prepare(`
      SELECT
        p.ean,
        p.name,
        p.brand,
        p.pack,
        p.image_url,
        sp.price_kzt,
        sp.old_price_kzt,
        sp.available,
        sp.updated_at
      FROM store_products sp
      JOIN products p ON p.ean = sp.ean
      WHERE sp.store_id = ? AND sp.ean = ?
    `)
    .get(storeId, ean) as any;

  if (!item) {
    return {
      status: 'not_found',
      source: 'merchant_catalog',
      store,
      ean,
      message: 'В каталоге этого магазина товар пока не найден.',
    };
  }

  return {
    status: 'found',
    source: 'merchant_catalog',
    channel: 'store_catalog',
    store,
    ean: item.ean,
    title: item.name,
    brand: item.brand,
    pack: item.pack,
    image_url: item.image_url,
    price_kzt: item.price_kzt,
    old_price_kzt: item.old_price_kzt,
    available: Boolean(item.available),
    retrieved_at: new Date().toISOString(),
    source_updated_at: item.updated_at,
    warnings: ['Цена загружена владельцем магазина.'],
  };
}


export function listMerchantOffersByEan(
  db: Database.Database,
  ean: string,
  city?: string,
) {
  const rows = db.prepare(`
    SELECT
      sp.store_id,
      sp.ean,
      sp.price_kzt,
      sp.old_price_kzt,
      sp.available,
      sp.updated_at,
      p.name,
      p.brand,
      p.pack,
      p.image_url,
      s.name AS store_name,
      s.city,
      s.address
    FROM store_products sp
    JOIN products p ON p.ean=sp.ean
    JOIN stores s ON s.id=sp.store_id
    WHERE sp.ean=?
      AND COALESCE(s.kind,'merchant')='merchant'
      AND (? IS NULL OR lower(s.city)=lower(?))
    ORDER BY sp.updated_at DESC, s.name ASC
  `).all(ean, city ?? null, city ?? null) as any[];

  return rows.map((row) => ({
    source_type: 'merchant_provided',
    retailer_id: null,
    retailer_name: null,
    retailer_product_id: null,
    store_id: String(row.store_id),
    store_name: row.store_name,
    store_address: row.address,
    city: row.city,
    title: row.name,
    brand: row.brand,
    pack: row.pack,
    image_url: row.image_url,
    price_kzt: row.price_kzt,
    old_price_kzt: row.old_price_kzt,
    available: Boolean(row.available),
    retrieved_at: row.updated_at,
    source_updated_at: row.updated_at,
    source_url: null,
    confidence: 'high',
    warnings: ['Цена загружена магазином.'],
  }));
}

import type Database from 'better-sqlite3';
import type { RetailerOffer } from './retailers/types.js';

function qualityRank(name: string) {
  return name.startsWith('Товар ') ? 0 : 1;
}

export function persistRetailerOffer(db: Database.Database, offer: RetailerOffer) {
  const now = offer.retrievedAt;

  db.prepare(`
    INSERT INTO retailers (id,name,integration_status,updated_at)
    VALUES (?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      integration_status=excluded.integration_status,
      updated_at=excluded.updated_at
  `).run(offer.retailer, offer.retailerName, 'active', now);

  const current = db
    .prepare('SELECT ean,name,brand,pack,image_url FROM products WHERE ean=?')
    .get(offer.gtin) as any;

  if (!current) {
    db.prepare(`
      INSERT INTO products (ean,name,brand,pack,image_url,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      offer.gtin,
      offer.title,
      offer.brand,
      offer.pack,
      offer.imageUrl,
      now,
      now,
    );
  } else {
    const nextName =
      qualityRank(offer.title) >= qualityRank(String(current.name))
        ? offer.title
        : current.name;
    db.prepare(`
      UPDATE products
      SET name=?, brand=COALESCE(?,brand), pack=COALESCE(?,pack),
          image_url=COALESCE(?,image_url), updated_at=?
      WHERE ean=?
    `).run(
      nextName,
      offer.brand,
      offer.pack,
      offer.imageUrl,
      now,
      offer.gtin,
    );
  }

  db.prepare(`
    INSERT INTO retailer_products
      (retailer_id,retailer_product_id,ean,title,brand,pack,image_url,updated_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(retailer_id,retailer_product_id) DO UPDATE SET
      ean=excluded.ean,
      title=excluded.title,
      brand=COALESCE(excluded.brand,retailer_products.brand),
      pack=COALESCE(excluded.pack,retailer_products.pack),
      image_url=COALESCE(excluded.image_url,retailer_products.image_url),
      updated_at=excluded.updated_at
  `).run(
    offer.retailer,
    offer.retailerProductId,
    offer.gtin,
    offer.title,
    offer.brand,
    offer.pack,
    offer.imageUrl,
    now,
  );

  const scope = offer.storeId || offer.city || 'catalog';
  const offerKey = `official:${offer.retailer}:${scope}`;

  db.prepare(`
    INSERT INTO offers (
      ean,offer_key,source_type,retailer_id,retailer_name,retailer_product_id,
      store_id,store_name,city,price_kzt,old_price_kzt,available,retrieved_at,
      source_updated_at,source_url,confidence,warnings
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(ean,offer_key) DO UPDATE SET
      retailer_name=excluded.retailer_name,
      retailer_product_id=excluded.retailer_product_id,
      store_id=excluded.store_id,
      store_name=excluded.store_name,
      city=excluded.city,
      price_kzt=excluded.price_kzt,
      old_price_kzt=excluded.old_price_kzt,
      available=excluded.available,
      retrieved_at=excluded.retrieved_at,
      source_updated_at=excluded.source_updated_at,
      source_url=excluded.source_url,
      confidence=excluded.confidence,
      warnings=excluded.warnings
  `).run(
    offer.gtin,
    offerKey,
    'official_retailer',
    offer.retailer,
    offer.retailerName,
    offer.retailerProductId,
    offer.storeId,
    offer.storeName,
    offer.city,
    offer.priceKzt,
    offer.oldPriceKzt,
    offer.available == null ? null : offer.available ? 1 : 0,
    offer.retrievedAt,
    offer.sourceUpdatedAt,
    offer.sourceUrl,
    offer.confidence,
    JSON.stringify(offer.warnings),
  );
}

export function listCachedOffers(db: Database.Database, ean: string) {
  return db.prepare(`
    SELECT
      source_type,
      retailer_id,
      retailer_name,
      retailer_product_id,
      store_id,
      store_name,
      city,
      price_kzt,
      old_price_kzt,
      available,
      retrieved_at,
      source_updated_at,
      source_url,
      confidence,
      warnings
    FROM offers
    WHERE ean=?
    ORDER BY retrieved_at DESC
  `).all(ean).map((row: any) => ({
    ...row,
    available: row.available == null ? null : Boolean(row.available),
    warnings: row.warnings ? JSON.parse(row.warnings) : [],
  }));
}

export function getProduct(db: Database.Database, ean: string) {
  return db
    .prepare('SELECT ean,name,brand,pack,image_url,created_at,updated_at FROM products WHERE ean=?')
    .get(ean) as any;
}

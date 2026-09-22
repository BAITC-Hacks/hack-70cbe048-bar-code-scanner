import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Result } from './types.js';

function ensureStoreColumns(db: Database.Database) {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(stores)').all() as Array<{ name: string }>).map(
      (column) => column.name,
    ),
  );

  const additions: Array<[string, string]> = [
    ['kind', "TEXT NOT NULL DEFAULT 'merchant'"],
    ['retailer_id', 'TEXT'],
    ['external_store_id', 'TEXT'],
    ['latitude', 'REAL'],
    ['longitude', 'REAL'],
  ];

  for (const [name, sqlType] of additions) {
    if (!columns.has(name)) {
      db.exec(`ALTER TABLE stores ADD COLUMN ${name} ${sqlType}`);
    }
  }

  db.exec(`
    DROP INDEX IF EXISTS idx_stores_retailer_external;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_retailer_external
      ON stores(retailer_id, external_store_id);
    CREATE INDEX IF NOT EXISTS idx_stores_kind ON stores(kind);
  `);
}

export function createDb(path = process.env.DATABASE_PATH || './data/baga.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);

  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ean TEXT NOT NULL,
      city TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      retailer_product_id INTEGER,
      title TEXT,
      price_kzt REAL,
      requested_at TEXT NOT NULL,
      store_id TEXT,
      warnings TEXT
    );

    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT,
      kind TEXT NOT NULL DEFAULT 'merchant',
      retailer_id TEXT,
      external_store_id TEXT,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      ean TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT,
      pack TEXT,
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS store_products (
      store_id INTEGER NOT NULL,
      ean TEXT NOT NULL,
      price_kzt REAL NOT NULL,
      old_price_kzt REAL,
      available INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (store_id, ean),
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      FOREIGN KEY (ean) REFERENCES products(ean) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS retailers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      integration_status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS retailer_products (
      retailer_id TEXT NOT NULL,
      retailer_product_id TEXT NOT NULL,
      ean TEXT NOT NULL,
      title TEXT NOT NULL,
      brand TEXT,
      pack TEXT,
      image_url TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (retailer_id, retailer_product_id),
      UNIQUE (retailer_id, ean),
      FOREIGN KEY (retailer_id) REFERENCES retailers(id) ON DELETE CASCADE,
      FOREIGN KEY (ean) REFERENCES products(ean) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ean TEXT NOT NULL,
      offer_key TEXT NOT NULL,
      source_type TEXT NOT NULL,
      retailer_id TEXT,
      retailer_name TEXT,
      retailer_product_id TEXT,
      store_id TEXT,
      store_name TEXT,
      city TEXT,
      price_kzt REAL NOT NULL,
      old_price_kzt REAL,
      available INTEGER,
      retrieved_at TEXT NOT NULL,
      source_updated_at TEXT,
      source_url TEXT,
      confidence TEXT NOT NULL,
      warnings TEXT,
      UNIQUE (ean, offer_key),
      FOREIGN KEY (ean) REFERENCES products(ean) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      ean TEXT NOT NULL,
      price_kzt REAL NOT NULL,
      old_price_kzt REAL,
      observed_at TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      photo_url TEXT,
      comment TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      source_type TEXT NOT NULL DEFAULT 'user_reported',
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_store_products_ean ON store_products(ean);
    CREATE INDEX IF NOT EXISTS idx_offers_ean ON offers(ean);
    CREATE INDEX IF NOT EXISTS idx_observations_ean ON user_observations(ean);
    CREATE INDEX IF NOT EXISTS idx_observations_store ON user_observations(store_id);
  `);

  ensureStoreColumns(db);
  // Additive migration: preserve unknown historical addresses without inventing them.
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS legacy_store_address_issues (
        store_id INTEGER PRIMARY KEY REFERENCES stores(id), detected_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO legacy_store_address_issues
        SELECT id,datetime('now') FROM stores WHERE address IS NULL OR trim(address)='';
      CREATE TRIGGER IF NOT EXISTS stores_address_insert BEFORE INSERT ON stores
        WHEN NEW.address IS NULL OR trim(NEW.address)=''
        BEGIN SELECT RAISE(ABORT,'STORE_ADDRESS_REQUIRED'); END;
      CREATE TRIGGER IF NOT EXISTS stores_address_update BEFORE UPDATE OF address ON stores
        WHEN NEW.address IS NULL OR trim(NEW.address)=''
        BEGIN SELECT RAISE(ABORT,'STORE_ADDRESS_REQUIRED'); END;
      CREATE TRIGGER IF NOT EXISTS stores_address_resolved AFTER UPDATE OF address ON stores
        WHEN NEW.address IS NOT NULL AND trim(NEW.address)<>''
        BEGIN DELETE FROM legacy_store_address_issues WHERE store_id=NEW.id; END;
      INSERT OR IGNORE INTO schema_migrations VALUES (1,datetime('now'));
    `);
  })();
  db.pragma('foreign_keys = ON');
  return db;
}

export function save(db: Database.Database, r: Result) {
  if (r.status === 'source_error') return;

  db.prepare(
    'INSERT INTO history (ean,city,source,status,retailer_product_id,title,price_kzt,requested_at,store_id,warnings) VALUES (?,?,?,?,?,?,?,?,?,?)',
  ).run(
    r.ean,
    r.city,
    r.source,
    r.status,
    r.status === 'found' ? r.retailer_product_id : null,
    r.status === 'found' ? r.title : null,
    r.status === 'found' ? r.price_kzt : null,
    r.retrieved_at,
    null,
    r.status === 'found' ? JSON.stringify(r.warnings) : null,
  );
}

export function history(db: Database.Database) {
  return db
    .prepare(
      'SELECT ean,city,source,status,retailer_product_id,title,price_kzt,requested_at,store_id,warnings FROM history ORDER BY id DESC LIMIT 20',
    )
    .all();
}

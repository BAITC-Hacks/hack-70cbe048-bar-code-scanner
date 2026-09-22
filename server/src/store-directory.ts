import type Database from 'better-sqlite3';
import { activeRetailerAdapters } from './retailers/index.js';

export interface DirectoryStore {
  id: number;
  kind: 'merchant' | 'retailer';
  retailer_id: string | null;
  external_store_id: string | null;
  name: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export async function syncRetailerStores(db: Database.Database) {
  const now = new Date().toISOString();
  const synced: Array<{ retailer: string; count: number }> = [];
  const errors: Array<{ retailer: string; message: string }> = [];

  for (const adapter of activeRetailerAdapters) {
    if (!adapter.listStores) continue;

    try {
      const stores = await adapter.listStores();
      let count = 0;

      const tx = db.transaction((rows: typeof stores) => {
        for (const store of rows) {
          const name = String(store.name ?? adapter.name).trim();
          const city = String(store.city ?? '').trim();
          const address = String(store.address ?? '').trim();
          const externalId = String(store.id ?? '').trim();

          if (!name || !city || !address || !externalId) continue;

          db.prepare(`
            INSERT INTO stores (
              name,city,address,kind,retailer_id,external_store_id,
              latitude,longitude,created_at,updated_at
            )
            VALUES (?,?,?,'retailer',?,?,?,?,?,?)
            ON CONFLICT(retailer_id,external_store_id) DO UPDATE SET
              name=excluded.name,
              city=excluded.city,
              address=excluded.address,
              latitude=excluded.latitude,
              longitude=excluded.longitude,
              updated_at=excluded.updated_at
          `).run(
            name,
            city,
            address,
            adapter.id,
            externalId,
            (store as any).latitude ?? null,
            (store as any).longitude ?? null,
            now,
            now,
          );
          count += 1;
        }
      });

      tx(stores);
      synced.push({ retailer: adapter.id, count });
    } catch (error) {
      errors.push({
        retailer: adapter.id,
        message: error instanceof Error ? error.message : 'Unable to sync stores',
      });
    }
  }

  return { synced, errors };
}

export function listDirectoryStores(
  db: Database.Database,
  options: { city?: string } = {},
): DirectoryStore[] {
  const city = options.city?.trim() || null;
  return db.prepare(`
    SELECT
      id,
      COALESCE(kind,'merchant') AS kind,
      retailer_id,
      external_store_id,
      name,
      city,
      address,
      latitude,
      longitude
    FROM stores
    WHERE address IS NOT NULL
      AND trim(address) <> ''
      AND (? IS NULL OR lower(city)=lower(?))
    ORDER BY
      CASE COALESCE(kind,'merchant') WHEN 'merchant' THEN 0 ELSE 1 END,
      name ASC,
      address ASC
  `).all(city, city) as DirectoryStore[];
}

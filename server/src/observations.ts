import type Database from 'better-sqlite3';
import { validEan, requiredPrice } from './validation.js';

export interface ObservationInput {
  storeId: number;
  ean: string;
  priceKzt: number;
  oldPriceKzt?: number | null;
  observedAt: string;
  photoUrl?: string | null;
  comment?: string | null;
}

export function createObservation(
  db: Database.Database,
  input: ObservationInput,
) {
  const store = db
    .prepare('SELECT id,name,city,address FROM stores WHERE id=?')
    .get(input.storeId) as any;

  if (!store) throw new Error('STORE_NOT_FOUND');
  if (!store.address?.trim()) throw new Error('STORE_ADDRESS_REQUIRED');

  const ean = String(input.ean ?? '').trim();
  if (!validEan(ean)) throw new Error('INVALID_EAN');

  const price = requiredPrice(input.priceKzt);
  if (!Number.isFinite(price) || price < 0) throw new Error('INVALID_PRICE');

  const oldPrice =
    input.oldPriceKzt == null ? null : Number(input.oldPriceKzt);
  if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < 0)) {
    throw new Error('INVALID_OLD_PRICE');
  }

  const observedAt = new Date(input.observedAt);
  if (Number.isNaN(observedAt.getTime())) throw new Error('INVALID_OBSERVED_AT');

  const submittedAt = new Date().toISOString();
  const comment = input.comment?.trim().slice(0, 1000) || null;

  const result = db.prepare(`
    INSERT INTO user_observations
      (store_id,ean,price_kzt,old_price_kzt,observed_at,submitted_at,photo_url,comment,status,source_type)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    input.storeId,
    ean,
    price,
    oldPrice,
    observedAt.toISOString(),
    submittedAt,
    input.photoUrl ?? null,
    comment,
    'pending',
    'user_reported',
  );

  return getObservation(db, Number(result.lastInsertRowid));
}

export function getObservation(db: Database.Database, id: number) {
  return db.prepare(`
    SELECT
      o.id,
      o.store_id,
      o.ean,
      o.price_kzt,
      o.old_price_kzt,
      o.observed_at,
      o.submitted_at,
      o.photo_url,
      o.comment,
      o.status,
      o.source_type,
      s.name AS store_name,
      s.city AS store_city,
      s.address AS store_address
    FROM user_observations o
    JOIN stores s ON s.id=o.store_id
    WHERE o.id=?
  `).get(id) as any;
}

export function listObservations(
  db: Database.Database,
  input: { ean?: string; storeId?: number; limit?: number },
) {
  const clauses: string[] = ["o.status <> 'rejected'"];
  const params: any[] = [];

  if (input.ean) {
    clauses.push('o.ean=?');
    params.push(input.ean);
  }

  if (input.storeId) {
    clauses.push('o.store_id=?');
    params.push(input.storeId);
  }

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  return db.prepare(`
    SELECT
      o.id,
      o.store_id,
      o.ean,
      o.price_kzt,
      o.old_price_kzt,
      o.observed_at,
      o.submitted_at,
      o.photo_url,
      o.comment,
      o.status,
      o.source_type,
      s.name AS store_name,
      s.city AS store_city,
      s.address AS store_address
    FROM user_observations o
    JOIN stores s ON s.id=o.store_id
    ${where}
    ORDER BY o.observed_at DESC, o.id DESC
    LIMIT ?
  `).all(...params, limit);
}

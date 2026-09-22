import { afterEach, describe, expect, it } from 'vitest';
import { createDb } from '../server/src/db.js';
import { createStore, lookupStorePrice, upsertStoreItem } from '../server/src/merchant.js';
import { createObservation, listObservations } from '../server/src/observations.js';

describe('user observations', () => {
  const dbs: ReturnType<typeof createDb>[] = [];
  afterEach(() => {
    for (const db of dbs.splice(0)) db.close();
  });

  function setup() {
    const db = createDb(':memory:');
    dbs.push(db);
    const store = createStore(db, {
      name: 'Observation Shop',
      city: 'Астана',
      address: 'Абая 10',
    });
    upsertStoreItem(db, store.id, {
      ean: '4870207314301',
      name: 'FoodMaster milk 1L',
      price_kzt: 620,
    });
    return { db, store };
  }

  it('creates a pending user observation with store identity', () => {
    const { db, store } = setup();
    const observation = createObservation(db, {
      storeId: store.id,
      ean: '4870207314301',
      priceKzt: 590,
      oldPriceKzt: 620,
      observedAt: new Date().toISOString(),
      comment: 'Shelf label',
    });

    expect(observation.status).toBe('pending');
    expect(observation.source_type).toBe('user_reported');
    expect(observation.store_address).toBe('Абая 10');
  });

  it('rejects unknown store, invalid EAN and invalid price', () => {
    const { db, store } = setup();
    const base = {
      ean: '4870207314301',
      priceKzt: 590,
      observedAt: new Date().toISOString(),
    };

    expect(() => createObservation(db, { ...base, storeId: 999999 })).toThrow('STORE_NOT_FOUND');
    expect(() => createObservation(db, { ...base, storeId: store.id, ean: '123' })).toThrow('INVALID_EAN');
    expect(() => createObservation(db, { ...base, storeId: store.id, priceKzt: -1 })).toThrow('INVALID_PRICE');
  });

  it('does not overwrite merchant price', () => {
    const { db, store } = setup();
    createObservation(db, {
      storeId: store.id,
      ean: '4870207314301',
      priceKzt: 590,
      observedAt: new Date().toISOString(),
    });

    expect((lookupStorePrice(db, store.id, '4870207314301') as any).price_kzt).toBe(620);
    expect((listObservations(db, { ean: '4870207314301' })[0] as any).price_kzt).toBe(590);
  });
});

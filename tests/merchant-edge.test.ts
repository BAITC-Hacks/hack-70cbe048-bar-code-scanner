import { describe, expect, it } from 'vitest';
import { createDb } from '../server/src/db.js';
import { createStore, importStoreItems, listStoreCatalog, lookupStorePrice } from '../server/src/merchant.js';

describe('merchant edge cases', () => {
  it('requires name, city and allows duplicate names at different addresses', () => {
    const db = createDb(':memory:');
    try {
      expect(() => createStore(db, { name: '', city: 'Астана', address: 'A 1' })).toThrow('STORE_NAME_REQUIRED');
      expect(() => createStore(db, { name: 'Shop', city: '', address: 'A 1' })).toThrow('STORE_CITY_REQUIRED');
      const a = createStore(db, { name: 'Shop', city: 'Астана', address: 'A 1' });
      const b = createStore(db, { name: 'Shop', city: 'Астана', address: 'B 2' });
      expect(a.id).not.toBe(b.id);
    } finally { db.close(); }
  });

  it('rejects unknown store and invalid price', () => {
    const db = createDb(':memory:');
    try {
      expect(() => lookupStorePrice(db, 999, '4870207314301')).toThrow('STORE_NOT_FOUND');
      const store = createStore(db, { name: 'Shop', city: 'Астана', address: 'A 1' });
      expect(() => importStoreItems(db, store.id, [{ ean: '4870207314301', price_kzt: -1 }])).toThrow('INVALID_PRICE');
    } finally { db.close(); }
  });

  it('upserts duplicate EAN in one store instead of duplicating it', () => {
    const db = createDb(':memory:');
    try {
      const store = createStore(db, { name: 'Shop', city: 'Астана', address: 'A 1' });
      importStoreItems(db, store.id, [
        { ean: '4870207314301', name: 'Milk', price_kzt: 1000 },
        { ean: '4870207314301', name: 'Milk', price_kzt: 1050 },
      ]);
      expect(listStoreCatalog(db, store.id)).toHaveLength(1);
      expect((lookupStorePrice(db, store.id, '4870207314301') as any).price_kzt).toBe(1050);
    } finally { db.close(); }
  });
});

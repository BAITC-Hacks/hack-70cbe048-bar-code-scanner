import { describe, expect, it } from 'vitest';
import { createDb } from '../server/src/db.js';
import {
  createStore,
  importStoreItems,
  listStoreCatalog,
  listStores,
  lookupStorePrice,
  upsertStoreItem,
} from '../server/src/merchant.js';

describe('merchant self-service catalog', () => {
  it('requires an address for every store location', () => {
    const db = createDb(':memory:');
    try {
      expect(() =>
        createStore(db, {
          name: 'Same Name Shop',
          city: 'Астана',
          address: '',
        }),
      ).toThrow('STORE_ADDRESS_REQUIRED');
    } finally {
      db.close();
    }
  });

  it('creates a store, saves a product and finds its price by EAN', () => {
    const db = createDb(':memory:');
    try {
      const store = createStore(db, {
        name: 'Demo Market',
        city: 'Астана',
        address: 'Test street 1',
      });

      const saved = upsertStoreItem(db, store.id, {
        ean: '4870207314301',
        name: 'FoodMaster milk 1L',
        price_kzt: 1190,
      });

      expect(saved.status).toBe('found');
      expect(saved.price_kzt).toBe(1190);
      expect((listStores(db)[0] as any).product_count).toBe(1);
      expect(listStoreCatalog(db, store.id)).toHaveLength(1);

      const lookup = lookupStorePrice(db, store.id, '4870207314301');
      expect(lookup.status).toBe('found');
      expect(lookup.store.name).toBe('Demo Market');
    } finally {
      db.close();
    }
  });

  it('bulk imports and updates store prices', () => {
    const db = createDb(':memory:');
    try {
      const store = createStore(db, {
        name: 'Bulk Shop',
        city: 'Астана',
        address: 'Second street 2',
      });

      importStoreItems(db, store.id, [
        { ean: '4870207314301', name: 'Milk', price_kzt: 1000 },
        { ean: '4870055002696', name: 'Second product', price_kzt: 500 },
      ]);

      importStoreItems(db, store.id, [
        { ean: '4870207314301', name: 'Milk', price_kzt: 1100 },
      ]);

      expect(listStoreCatalog(db, store.id)).toHaveLength(2);
      expect(
        (lookupStorePrice(db, store.id, '4870207314301') as any).price_kzt,
      ).toBe(1100);
    } finally {
      db.close();
    }
  });
});

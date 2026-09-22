import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/src/app.js';
import { createDb } from '../server/src/db.js';
import { createStore } from '../server/src/merchant.js';

describe('observation HTTP upload validation', () => {
  const dbs: ReturnType<typeof createDb>[] = [];
  afterEach(() => {
    for (const db of dbs.splice(0)) db.close();
  });

  async function withServer(run: (base: string, storeId: number) => Promise<void>) {
    const db = createDb(':memory:');
    dbs.push(db);
    const store = createStore(db, { name: 'Upload Shop', city: 'Астана', address: 'Сарыарка 25' });
    const app = createApp(db);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test port');
    try {
      await run(`http://127.0.0.1:${address.port}`, store.id);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  it('accepts an observation without a photo', async () => {
    await withServer(async (base, storeId) => {
      const body = new FormData();
      body.set('store_id', String(storeId));
      body.set('ean', '4870207314301');
      body.set('observed_price_kzt', '590');
      body.set('observed_at', new Date().toISOString());
      const response = await fetch(`${base}/api/v1/observations`, { method: 'POST', body });
      expect(response.status).toBe(201);
      expect((await response.json()).status).toBe('pending');
    });
  });

  it('rejects a non-image upload', async () => {
    await withServer(async (base, storeId) => {
      const body = new FormData();
      body.set('store_id', String(storeId));
      body.set('ean', '4870207314301');
      body.set('observed_price_kzt', '590');
      body.set('observed_at', new Date().toISOString());
      body.set('photo', new Blob(['not an image'], { type: 'text/plain' }), 'note.txt');
      const response = await fetch(`${base}/api/v1/observations`, { method: 'POST', body });
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe('INVALID_IMAGE_TYPE');
    });
  });
});

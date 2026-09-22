import { describe, expect, it, vi } from 'vitest';
import { lookupGalmartOffer } from '../server/src/retailers/galmart.js';

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    { status, headers: { 'content-type': 'application/json' } },
  ));
}

const item = {
  id: 163043,
  title: 'Food Master молоко 1000 мл',
  brand_name: 'Food Master',
  pack_name: 'ТЕТРАПАК',
  price: 1265,
  old_price: 1300,
  available: true,
};

describe('Galmart retailer adapter', () => {
  it('normalizes a successful public catalog response', async () => {
    const fetcher = vi.fn().mockImplementation((_url: string, init: any) => {
      expect(init.headers.City).toBe('2');
      return response({ data: [item] });
    });
    const offer = await lookupGalmartOffer('4870207314301', 'astana', fetcher);
    expect(offer?.retailer).toBe('galmart');
    expect(offer?.priceKzt).toBe(1265);
    expect(offer?.oldPriceKzt).toBe(1300);
  });

  it('returns null when product is not found', async () => {
    expect(await lookupGalmartOffer('4870207314301', 'astana', () => response({ data: [] }))).toBeNull();
  });

  it('separates upstream timeout/network failure', async () => {
    await expect(
      lookupGalmartOffer('4870207314301', 'astana', async () => {
        throw new Error('timeout');
      }),
    ).rejects.toMatchObject({ name: 'RetailerUpstreamError', retailer: 'galmart' });
  });

  it('rejects malformed JSON', async () => {
    await expect(
      lookupGalmartOffer('4870207314301', 'astana', () => response('{bad json')),
    ).rejects.toMatchObject({ name: 'RetailerUpstreamError' });
  });

  it('rejects missing required fields', async () => {
    await expect(
      lookupGalmartOffer('4870207314301', 'astana', () => response({ data: [{ id: 1 }] })),
    ).rejects.toMatchObject({ name: 'RetailerUpstreamError' });
  });

  it('separates upstream HTTP errors', async () => {
    await expect(
      lookupGalmartOffer('4870207314301', 'astana', () => response({}, 503)),
    ).rejects.toMatchObject({ status: 503 });
  });
});

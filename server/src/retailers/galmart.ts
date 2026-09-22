import { cityIds } from '../validation.js';
import type { City } from '../types.js';
import {
  RetailerUpstreamError,
  type RetailerAdapter,
  type RetailerOffer,
} from './types.js';

const warnings = [
  'Цена относится к городскому онлайн-каталогу.',
  'Конкретный филиал не подтверждён.',
  'Время обновления цены источником не передано.',
  'Цена на кассе не проверена.',
];

function isAgeRestrictedTitle(title: string) {
  const normalized = title.toLowerCase();
  return /(?<![\p{L}])(пиво|водка|вино|коньяк|виски|ром|джин|текила|сигарет|табак|вейп|nicotine|beer|wine|vodka|whisky|whiskey)(?![\p{L}])/iu.test(
    normalized,
  );
}

export async function lookupGalmartOffer(
  gtin: string,
  city: City,
  fetcher: typeof fetch = fetch,
): Promise<RetailerOffer | null> {
  const baseUrl = process.env.GALMART_BASE_URL || 'https://galmart.kz';
  const sourceUrl = `${baseUrl}/api/v2/catalog/goods/?search=${encodeURIComponent(gtin)}&limit=5`;

  let response: Response;
  try {
    response = await fetcher(sourceUrl, {
      headers: {
        City: String(cityIds[city]),
        'Accept-Language': 'ru',
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw new RetailerUpstreamError(
      'galmart',
      error instanceof Error ? error.message : 'Network error',
    );
  }

  if (!response.ok) {
    throw new RetailerUpstreamError(
      'galmart',
      `Galmart returned HTTP ${response.status}`,
      response.status,
    );
  }

  let payload: { data?: any[] };
  try {
    payload = (await response.json()) as { data?: any[] };
  } catch {
    throw new RetailerUpstreamError('galmart', 'Malformed JSON response');
  }

  if (!Array.isArray(payload.data)) {
    throw new RetailerUpstreamError('galmart', 'Missing data array');
  }

  const item = payload.data[0];
  if (!item) return null;

  if (
    typeof item.id !== 'number' ||
    typeof item.title !== 'string' ||
    typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0
  ) {
    throw new RetailerUpstreamError('galmart', 'Missing required product fields');
  }

  // Baga is scoped to ordinary grocery/household goods in this MVP.
  if (isAgeRestrictedTitle(item.title)) return null;

  return {
    gtin,
    retailer: 'galmart',
    retailerName: 'Galmart',
    retailerProductId: String(item.id),
    storeId: null,
    storeName: null,
    city,
    title: item.title,
    brand: item.brand_name ?? null,
    pack: item.pack_name ?? null,
    imageUrl: Array.isArray(item.photos) ? item.photos[0] ?? null : null,
    priceKzt: item.price,
    oldPriceKzt: item.old_price ?? null,
    available: typeof item.available === 'boolean' ? item.available : null,
    retrievedAt: new Date().toISOString(),
    sourceUpdatedAt: null,
    sourceUrl,
    confidence: 'medium',
    channel: 'online_city_catalog',
    warnings,
  };
}

export const galmartAdapter: RetailerAdapter = {
  id: 'galmart',
  name: 'Galmart',
  async lookupByBarcode(gtin, context) {
    const city = context.city === 'almaty' ? 'almaty' : 'astana';
    return lookupGalmartOffer(gtin, city);
  },
  async listStores() {
    const baseUrl = process.env.GALMART_BASE_URL || 'https://galmart.kz';
    const response = await fetch(`${baseUrl}/api/v2/addits/shops/`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept-Language': 'ru' },
    });
    if (!response.ok) {
      throw new RetailerUpstreamError('galmart', 'Unable to load Galmart shops', response.status);
    }
    const payload = (await response.json()) as any;
    const cities = Array.isArray(payload?.data) ? payload.data : [];
    return cities.flatMap((city: any) =>
      (Array.isArray(city.shop_addresses) ? city.shop_addresses : []).map((shop: any) => ({
        id: String(shop.id ?? ''),
        name: String(shop.title ?? 'Galmart'),
        city: String(city.title ?? ''),
        address: shop.address ?? null,
        latitude: typeof shop.latitude === 'number' ? shop.latitude : null,
        longitude: typeof shop.longitude === 'number' ? shop.longitude : null,
      })),
    ).filter((shop: any) => shop.id);
  },
};

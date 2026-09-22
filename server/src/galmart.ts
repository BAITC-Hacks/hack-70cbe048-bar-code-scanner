import type { City, Result } from './types.js';
import { lookupGalmartOffer } from './retailers/galmart.js';

export async function lookup(
  ean: string,
  city: City,
  fetcher: typeof fetch = fetch,
): Promise<Result> {
  const retrieved_at = new Date().toISOString();

  try {
    const offer = await lookupGalmartOffer(ean, city, fetcher);

    if (!offer) {
      return {
        status: 'not_found',
        source: 'galmart',
        city,
        ean,
        retrieved_at,
        message: 'Товар с таким штрихкодом не найден в каталоге Galmart.',
      };
    }

    return {
      status: 'found',
      source: 'galmart',
      channel: 'online_city_catalog',
      city,
      ean,
      retailer_product_id: Number(offer.retailerProductId),
      title: offer.title,
      brand: offer.brand,
      pack: offer.pack,
      price_kzt: offer.priceKzt,
      old_price_kzt: offer.oldPriceKzt,
      unit: null,
      unit_value: null,
      unit_price_kzt: null,
      available: offer.available ?? false,
      inventory: null,
      retrieved_at: offer.retrievedAt,
      source_updated_at: null,
      store_id: null,
      store_name: null,
      confidence: 'medium',
      warnings: offer.warnings,
    };
  } catch {
    return {
      status: 'source_error',
      source: 'galmart',
      city,
      ean,
      retrieved_at,
      message: 'Источник временно недоступен.',
    };
  }
}

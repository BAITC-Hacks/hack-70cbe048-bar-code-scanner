import type Database from 'better-sqlite3';
import { activeRetailerAdapters } from './retailers/index.js';
import { RetailerUpstreamError } from './retailers/types.js';
import { persistRetailerOffer, getProduct, listCachedOffers } from './offers.js';
import { listMerchantOffersByEan } from './merchant.js';
import { listObservations } from './observations.js';

export async function comparePrices(
  db: Database.Database,
  ean: string,
  city: string,
  forceRefresh = false,
) {
  const ttl = Math.max(0, Number(process.env.OFFICIAL_CACHE_TTL_SECONDS || 120)) * 1000;
  const before = listCachedOffers(db,ean);
  const retailerResults = await Promise.allSettled(
    activeRetailerAdapters.map(async (adapter) => {
      const cached = before.find((o:any)=>o.retailer_id===adapter.id && o.city===city);
      if(!forceRefresh && cached && Date.now()-Date.parse(cached.retrieved_at)<ttl) return {adapter:adapter.id,offer:null};
      const offer = await adapter.lookupByBarcode(ean, { city });
      if (offer) persistRetailerOffer(db, offer);
      else db.prepare("DELETE FROM offers WHERE ean=? AND retailer_id=? AND city=? AND source_type='official_retailer'").run(ean,adapter.id,city);
      return { adapter: adapter.id, offer };
    }),
  );

  const errors = retailerResults
    .map((result, index) => {
      if (result.status === 'fulfilled') return null;
      const error = result.reason;
      return {
        retailer: activeRetailerAdapters[index]?.id ?? 'unknown',
        message:
          error instanceof RetailerUpstreamError
            ? error.message
            : 'Источник временно недоступен.',
      };
    })
    .filter(Boolean);

  const officialOffers = listCachedOffers(db, ean).filter((offer: any) => {
    if (!offer.city) return true;
    return String(offer.city).toLowerCase() === city.toLowerCase();
  });

  const merchantOffers = listMerchantOffersByEan(db, ean);
  const observations = listObservations(db, { ean, limit: 20 });
  const product = getProduct(db, ean);

  return {
    status:
      product || officialOffers.length || merchantOffers.length || observations.length
        ? 'found'
        : 'not_found',
    ean,
    city,
    product: product ?? null,
    official_offers: officialOffers.map((o:any)=>({...o, freshness: Date.now()-Date.parse(o.retrieved_at)<ttl ? 'fresh' : 'stale', source_freshness: o.source_updated_at ? 'known' : 'unknown'})),
    merchant_offers: merchantOffers.map((o:any)=>({...o, freshness: Date.now()-Date.parse(o.source_updated_at)<86400000 ? 'fresh' : 'stale'})),
    observations,
    source_errors: errors,
    retrieved_at: new Date().toISOString(),
  };
}

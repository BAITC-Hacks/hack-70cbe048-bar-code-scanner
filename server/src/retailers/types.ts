export type Confidence = 'high' | 'medium' | 'low';

export interface RetailerContext {
  city?: string;
  storeId?: string;
}

export interface RetailerOffer {
  gtin: string;
  retailer: string;
  retailerName: string;
  retailerProductId: string;
  storeId: string | null;
  storeName: string | null;
  city: string | null;
  title: string;
  brand: string | null;
  pack: string | null;
  imageUrl: string | null;
  priceKzt: number;
  oldPriceKzt: number | null;
  available: boolean | null;
  retrievedAt: string;
  sourceUpdatedAt: string | null;
  sourceUrl: string;
  confidence: Confidence;
  channel: string;
  warnings: string[];
}

export interface RetailerStore {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface RetailerAdapter {
  id: string;
  name: string;
  lookupByBarcode(gtin: string, context: RetailerContext): Promise<RetailerOffer | null>;
  listStores?(): Promise<RetailerStore[]>;
}

export class RetailerUpstreamError extends Error {
  constructor(
    public readonly retailer: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'RetailerUpstreamError';
  }
}

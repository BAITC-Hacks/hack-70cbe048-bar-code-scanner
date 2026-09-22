# Baga architecture

## Runtime

```text
Camera
  ↓
ZXing one-dimensional barcode reader
  ↓
Baga React frontend
  ↓
Baga Express API
  ├─ retailer adapters
  │    └─ Galmart (active)
  ├─ merchant catalogs
  ├─ user observations
  ├─ store directory
  └─ price comparison / provenance
  ↓
SQLite
```

## Adapter contract

Every live retailer implements `RetailerAdapter` and returns a normalized `RetailerOffer`. Retailer-specific parsing stays inside `server/src/retailers/`.

The comparison service queries active adapters on demand, persists successful mappings/offers, and returns source errors separately from “not found”.

## Modes

### On demand
Scan GTIN → query active adapters → normalize → persist product/mapping/offer → combine with merchant offers and user observations.

### Bulk/research ingestion
`scripts/ingest-galmart.ts` reads a GTIN corpus, validates/deduplicates, retries with bounded attempts, rate-limits requests, persists successful offers, and checkpoints completed GTINs for resume.

The current Galmart public interface is search-oriented. Baga does not crawl an undocumented entire catalog just to claim “all products”; it ingests known GTINs safely and expands the corpus when a permitted catalog enumeration exists.

## Failure boundaries

Invalid GTINs are rejected before upstream calls. Upstream timeout, HTTP errors, malformed JSON and missing required fields become source errors and never become fake zero-price offers.

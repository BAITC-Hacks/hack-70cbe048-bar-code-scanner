# Price provenance

Baga keeps three price classes separate.

| Source type | Meaning | Can overwrite another type? |
|---|---|---|
| OFFICIAL RETAILER | Retrieved from an enabled retailer adapter | No |
| MERCHANT PROVIDED | Uploaded by the merchant for a Baga store | No |
| USER REPORTED | Observation submitted by a user at a concrete store | No |

## Official retailer

Every normalized offer stores retailer, retailer product ID, scope, retrieval time, source URL, confidence and warnings. Missing upstream freshness is represented as null rather than invented.

## Merchant provided

The merchant's store has a unique internal ID, city and required address. The store's own `updated_at` is shown as the price update time.

## User reported

New observations are `pending` and displayed as unverified. They may include JPEG/PNG/WebP evidence up to 5 MB. Uploaded files receive random server names. Local disk storage is an MVP limitation; production should use persistent object storage and content inspection.

A user observation never updates `offers` or `store_products`.

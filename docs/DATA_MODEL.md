# Baga data model

## Product identity

`products.ean` is the global packaged-product identifier. One product is not duplicated per retailer/store.

### products
- ean PK
- name
- brand
- pack
- image_url
- created_at
- updated_at

### retailers
- id PK
- name
- integration_status
- updated_at

### retailer_products
Maps retailer product IDs to the global GTIN.
- retailer_id
- retailer_product_id
- ean
- title/brand/pack/image
- updated_at

### stores
One physical/store identity per row.
- id internal PK
- kind: merchant or retailer
- retailer_id nullable
- external_store_id nullable
- name
- city
- address
- latitude/longitude nullable

Names are deliberately **not unique**. Identity is internal ID plus address/context.

### store_products
Merchant-provided catalog offers.
- store_id + ean composite PK
- price_kzt
- old_price_kzt
- available
- updated_at

### offers
Normalized official retailer offers.
- ean
- offer_key
- source_type
- retailer/store scope
- price/old price/availability
- retrieved_at/source_updated_at
- source_url
- confidence/warnings

### user_observations
Crowdsourced observations are separate facts, never overwrites.
- id
- store_id
- ean
- price_kzt
- old_price_kzt
- observed_at
- submitted_at
- photo_url
- comment
- status
- source_type

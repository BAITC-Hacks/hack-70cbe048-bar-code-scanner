# Retail data research — Baga

Research date: 2026-09-23. Scope: ordinary packaged grocery/household products in Kazakhstan. Baga does not bypass authentication, CAPTCHA, access controls, rate limits, or private credentials.

## Executive result

Only **Galmart** currently meets the bar for a production-enabled Baga barcode adapter: an unauthenticated official catalog endpoint accepts a GTIN/EAN search and returns a product and current city-level online price. The response does **not** prove a branch/cash-register price and does not expose a source update timestamp, so the integration is deliberately labelled **YELLOW**, not GREEN.

Other retailers remain research-only until Baga has a stable, permitted EAN→offer path. They are shown in the product as research, never as connected price sources.

## Live Galmart experiment

Official endpoint tested:

`GET https://galmart.kz/api/v2/catalog/goods/?search=<GTIN>&limit=5`

Request header used by the public web catalog:

- `City: 2` — Astana
- `City: 1` — Almaty
- `Accept-Language: ru`

Store directory endpoint tested:

`GET https://galmart.kz/api/v2/addits/shops/`

The store directory returns city groups and branch addresses/coordinates. Product-price lookup itself is city-scoped, not branch-scoped.

A public GTIN research corpus of **43 real packaged products** was tested against Astana. Result:

- 39 returned a real product and price;
- 4 returned no product;
- 0 upstream failures during the completed run.

Examples from the run:

| GTIN | Product returned by Galmart | Astana price |
|---|---|---:|
| 4870207314301 | Food Master Легкое утро безлактозное 3.2%, 1000 ml | 1265 ₸ |
| 4870055002696 | Lactel milk 3.2%, 1000 ml | 846 ₸ |
| 5449000054227 | Coca-Cola 1000 ml | 785 ₸ |
| 4870036001205 | Рахат Казахстанский chocolate 100 g | 1175 ₸ |
| 4870071000256 | Tassay water 5000 ml | 955 ₸ |
| 4870001570095 | Pepsi 2000 ml | 1040 ₸ |
| 8887290101004 | MacCoffee 3-in-1 20 g | 115 ₸ |
| 4860019001346 | Borjomi 500 ml | 880 ₸ |
| 4870035001152 | Шедевр sunflower oil 1000 ml | 1063 ₸ |
| 4870227270946 | Big Bon noodles 75 g | 220 ₸ |
| 4870207313328 | Food Master Greek yogurt 130 g | 490 ₸ |
| 4870001081270 | Цин Каз tomato paste 220 g | 730 ₸ |
| 4602481104473 | Царь 7 злаков 400 g | 540 ₸ |
| 4870055002542 | President sour cream 20%, 400 g | 903 ₸ |
| 4870071000195 | Tassay water 500 ml | 400 ₸ |

The full reproducible corpus is `data/gtin-corpus.txt`. The ingestion script is `scripts/ingest-galmart.ts`; it validates GTINs, deduplicates input, retries failures, sleeps between requests, and writes a resume checkpoint.

## Retailer matrix

| Retailer | Official/public source investigated | EAN searchable? | Metadata | Price | Old price | Availability | City-specific | Store-specific | Freshness | Auth | Reliability | Risk | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Galmart | official web catalog JSON API | **Yes, confirmed** | Yes | **Yes** | Often | Yes/field-dependent | **Yes** | No for price lookup | retrieval time only; source timestamp absent | No | Good for city online catalog | branch/cash price not proven | **YELLOW / enabled** |
| Magnum / MagnumGO | official catalog/web properties and public catalog responses | not confirmed | Yes | catalog price visible | varies | catalog-dependent | Yes | partial/store data exists | not consistently exposed | varies by surface | useful catalog, missing deterministic barcode mapping | do not infer EAN | **YELLOW / research** |
| SMALL | official site plus linked delivery storefronts | partner pages may expose barcode | Yes | partner price visible | varies | partner-dependent | Yes | Yes on delivery storefront | partner-dependent | storefront-dependent | not suitable as Baga-owned production feed without permission/stable contract | third-party reuse | **RED / research** |
| METRO Kazakhstan | official online catalog/store selector | not confirmed | Yes | Yes | promo-dependent | Yes | Yes | **Yes** | not consistently exposed | browsing surface varies | strong store catalog, missing confirmed public barcode lookup | access/interface stability | **YELLOW / research** |
| ANVAR | official online store | not confirmed | Yes | Yes | varies | catalog-dependent | Yes | not confirmed | not consistently exposed | varies | useful catalog | no deterministic EAN mapping confirmed | **YELLOW / research** |
| Toimart | official site/promotions/catalog material | not confirmed | partial | promo/catalog | promo | partial | Yes | no reliable price mapping found | promo dates | No for public pages | insufficient for barcode price lookup | sparse mapping | **RED / research** |
| Arbuz.kz | official city grocery catalog | not confirmed | Yes | Yes | promo-dependent | Yes | **Yes** | fulfillment/catalog scope rather than physical branch | current catalog | storefront | good consumer catalog | barcode mapping absent | **YELLOW / research** |
| Carefood | official public catalog | not confirmed | Yes | Yes | varies | catalog-dependent | Yes | one/store context | not consistently exposed | storefront | useful for its service area | EAN mapping absent | **YELLOW / research** |
| Firkan24 | official storefront/store selection | not confirmed | Yes | Yes | varies | catalog-dependent | Yes | Yes | not consistently exposed | storefront | store-aware catalog | EAN mapping absent | **YELLOW / research** |
| A-Store | official online catalog | not confirmed | partial | catalog price | varies | partial | Yes | Yes | not consistently exposed | storefront | limited geographic relevance for current Astana demo | no EAN mapping | **RED / research** |
| Fix Price Kazakhstan | official catalog/store-aware browsing | not confirmed | Yes | catalog price | varies | store-aware | Yes | Yes | not consistently exposed | protected surface | useful to a human shopper | automation/access stability | **RED / research** |
| Ayan Market | public product/store pages | product/article values observed | Yes | Yes | varies | store/seller context | Yes | Yes | not consistently exposed | public browsing | promising | stable public EAN search not confirmed | **YELLOW / research** |

### Delivery partners

Glovo/Wolt/Yandex can expose store-specific delivery prices, but Baga does not treat them as retailer-official integrations unless there is a stable permitted public/partner interface. A delivery price may also differ from shelf/cash price. Partner-derived data therefore remains research-only.

## Why there are no fake adapters

The adapter registry lists researched retailers, but `activeRetailerAdapters` contains only integrations with a real working barcode lookup. A retailer is not promoted to “connected” merely because its website shows products or prices.

## Freshness and provenance

For Galmart, `retrieved_at` is Baga's retrieval time. `source_updated_at` is null because the tested response did not provide a reliable source-update timestamp. UI warnings explicitly say that the price is a city online-catalog price, a specific branch is not confirmed, and the cash-register price has not been checked.

## Next research gates

A research-only retailer can become active only after all of these are confirmed:

1. deterministic EAN/GTIN mapping;
2. real price returned by an official/permitted source;
3. clear city/store scope;
4. stable request contract without bypassing access controls;
5. provenance fields Baga can show honestly;
6. timeout/malformed/HTTP-error tests;
7. documented limitations.

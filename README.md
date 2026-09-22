# Baga

**Baga — цена по штрихкоду.**

Baga is a mobile-first Kazakhstan price lookup MVP for ordinary packaged products. A shopper scans an EAN/GTIN, sees prices Baga can actually source, and can distinguish an official retailer catalog price from a merchant-uploaded price and an unverified user observation.

## Problem

A barcode identifies a packaged product, not its price. Prices vary by retailer, city and physical store, while small stores often have no public digital catalog. Existing delivery/catalog surfaces also differ in whether they expose barcode mapping, branch scope and freshness.

## Solution

Baga uses GTIN as the global product key and keeps price provenance explicit:

- official retailer adapters;
- merchant-provided store catalogs;
- user-reported observations.

No source is shown as connected unless the integration really returns a price.

## Live Demo

Deployed demo: https://barcode-scanner-b2qjh.sprites.app

**Deployment gate:** anonymous requests currently return HTTP 302 (Sprite login). Owner must enable public URL before jury use. The application itself does not require customer login.

## 2-minute Jury Demo

0:00–0:20 open the URL, choose Astana / all sources. 0:20–0:50 scan or enter `4870207314301`, show official price, online-city scope and source-time warning. 0:50–1:15 add a pending observation for a concrete branch. 1:15–1:45 create `Jury Local Shop` with an address, add the same EAN and your demo price. 1:45–2:00 select that store and show its separate merchant price. Merchant demo values are manually entered, never labelled official.

Suggested steps:

1. Open Baga on a phone.
2. Choose **Все подключённые источники**.
3. Scan a packaged product with the camera or enter a valid EAN.
4. Baga performs live enabled-retailer lookup and displays provenance/warnings.
5. Open **Добавить наблюдение пользователя**, choose a concrete store/address, enter observed price and optionally attach a photo.
6. Switch to **Для магазина** to create a merchant store, add/scan products or import CSV, then select that store in shopper mode.

Known live Galmart test GTINs include `4870207314301`, `5449000054227`, `4870036001205` and `4870071000195`.

## Customer Flow

```text
Open Baga
  ↓
choose source/store
  ↓
scan barcode
  ↓
validate EAN/GTIN
  ↓
lookup
  ↓
product + price + source + scope + updated/retrieved time
```

“All sources” compares enabled retailer adapters plus merchant offers and user observations. A selected merchant store performs an exact store-catalog lookup.

## Merchant Flow

```text
Для магазина
  ↓
create store (name + city + required address)
  ↓
scan/add one product OR upload CSV
  ↓
catalog
  ↓
shopper can select that exact store
```

CSV requires `ean` and `price`; `name` and `old_price` are optional. Duplicate GTINs update that store's offer rather than duplicating the global product.

## User Observations

“Добавить наблюдение пользователя” is functional. It accepts:

- concrete `store_id`;
- EAN/GTIN;
- observed price;
- optional old price;
- observation date/time;
- optional JPEG/PNG/WebP photo up to 5 MB;
- optional comment.

New observations are stored as `pending` / unverified and never replace official or merchant prices.

## Supported Retailers

| Retailer | Integration status | EAN support | Price | Store-specific | Notes |
|---|---|---|---|---|---|
| Galmart | **ACTIVE** | confirmed | live city online catalog | No | Real EAN lookup; branch/cash price and source update timestamp are not confirmed |
| Magnum | research | unconfirmed | catalog confirmed | partial | Not enabled until deterministic public EAN mapping is confirmed |
| SMALL | research | partner-only evidence | partner catalog | yes on delivery surface | Not used as production feed without a stable permitted interface |
| METRO Kazakhstan | research | unconfirmed | catalog confirmed | yes | Store-aware catalog; barcode lookup not confirmed |
| ANVAR | research | unconfirmed | catalog confirmed | unknown | Not enabled |
| Toimart | research | unconfirmed | promo/catalog | no reliable mapping | Not enabled |
| Arbuz.kz | research | unconfirmed | catalog confirmed | fulfillment scope | Not enabled |
| Carefood | research | unconfirmed | catalog confirmed | yes/contextual | Not enabled |
| Firkan24 | research | unconfirmed | catalog confirmed | yes | Not enabled |
| A-Store | research | unconfirmed | partial | yes | Not enabled |
| Fix Price Kazakhstan | research | unconfirmed | catalog confirmed | yes | Protected/unstable automation surface; not enabled |
| Ayan Market | research | product-page evidence | catalog confirmed | yes | Stable public EAN search not confirmed |

See [docs/RETAIL_DATA_RESEARCH.md](docs/RETAIL_DATA_RESEARCH.md) for experiment details.

## Architecture

```text
Camera
  ↓
ZXing
  ↓
Baga Frontend
  ↓
Baga API
  ├─ retailer adapters
  ├─ merchant catalogs
  ├─ user observations
  ├─ store directory
  └─ comparison/provenance
  ↓
SQLite / data layer
```

Retailer-specific parsing is isolated under `server/src/retailers/` behind a shared adapter interface.

## Data Model

The global product table is keyed by EAN/GTIN. Retailer mappings, official offers, merchant store offers and user observations are separate tables. See [docs/DATA_MODEL.md](docs/DATA_MODEL.md).

## Price Provenance

Baga renders:

- **OFFICIAL RETAILER**
- **MERCHANT PROVIDED**
- **USER REPORTED · НЕ ПРОВЕРЕНО**

See [docs/PRICE_PROVENANCE.md](docs/PRICE_PROVENANCE.md).

## Retail ingestion

The safe ingestion mode is corpus-driven:

```bash
npm run ingest:galmart -- --city=astana
```

`scripts/ingest-galmart.ts` validates/deduplicates GTINs, retries bounded failures, waits between requests, checkpoints completed items and persists successful mappings/offers.

The checked-in corpus `research/corpus/gtins.txt` contains **128 unique, checksum-valid public GTIN examples**. A fresh Astana run returned **61 matches, 67 not found, 0 upstream failures**. The earlier 43-code baseline had 39 matches. Public Arbuz product identities expanded the corpus; Arbuz is not enabled as a price feed. Identity provenance is in `research/corpus/arbuz-identity.json`.

Baga does not claim that this is “all products in Kazakhstan”.

## Installation

Requirements: **Node.js 22.9–22.x**, tested on **22.23.2**, and npm. `.nvmrc`, `engines` and `.npmrc` agree: unsupported Node versions fail installation early. Install and run with the same Node major; do not copy node_modules from another computer or Node version. Fresh npm install builds/downloads better-sqlite3 automatically; no manual rebuild is required.

```bash
git clone https://github.com/BAITC-Hacks/hack-70cbe048-bar-code-scanner.git
cd hack-70cbe048-bar-code-scanner
nvm install
nvm use
npm install
cp .env.example .env
npm test
npm run build
npm start
```

## Environment Variables

`.env.example`:

```env
PORT=3000
GALMART_BASE_URL=https://galmart.kz
DATABASE_PATH=./data/baga.sqlite
UPLOAD_DIR=./data/uploads
ADMIN_TOKEN=
OFFICIAL_CACHE_TTL_SECONDS=120
```

No secrets are required for the current Galmart public adapter. Do not commit private credentials if future adapters need them.

## Clean Run

Development:

```bash
npm install
npm run dev
```

Production-style:

```bash
npm run build
npm start
```

Open `http://localhost:3000`.

## Tests

```bash
npm test
```

Coverage includes EAN/GTIN checksum/length, merchant store/address behavior, product upsert, CSV/import edge cases, user observations, upload type validation, persistence and retailer-adapter error handling.

Test count and final verification are recorded in [HackALEM verification](docs/HACKALEM_VERIFICATION.md). Tests use isolated databases and upload directories; no retailer network is required.

## Deployment

Build with `npm run build`, run `npm start`; never expose the development or Vitest UI server.
The Sprite service uses Node 22.23.2, port 8080 and the existing **data/history.sqlite** to preserve production data. New installs default to **data/baga.sqlite**. Uploads remain in **data/uploads**.
The Sprites connector available in this session has no URL-auth mutation operation. The authenticated owner must run:

```bash
sprite url update --auth public -o sanzhar-923 -s barcode-scanner
curl -sS -o /dev/null -w '%{http_code}\\n' https://barcode-scanner-b2qjh.sprites.app/
curl -sS -o /dev/null -w '%{http_code}\\n' https://barcode-scanner-b2qjh.sprites.app/api/health
```

Both must return 200 without cookies/tokens. Do not describe the deployment as public until this passes.

### Backup and restore

Before this update: Sprite checkpoint **v9**, plus SQLite backup **data/backups/pre-hardening-20260922T224253Z.sqlite**, integrity_check=ok. For a new backup use SQLite's online backup API, not a live file copy. Stop the application before restoring the backup over DATABASE_PATH; preserve the current DB and any WAL/SHM files first, restore with the matching application version, then run integrity_check and restart. Back up uploads separately or use a Sprite checkpoint. Never delete the current DB to apply a migration.

### Minimal migration strategy

`schema_migrations` records version 1. Clean and old MVP DBs use the same initializer. The address migration is additive: INSERT/UPDATE triggers reject new null/blank addresses. Historical unknown addresses remain intact and appear in `legacy_store_address_issues`; no invented address or destructive table rebuild. Repair with a verified address; the issue clears automatically. Such stores are excluded from observation directory and cannot accept observations until repaired.

Demo: https://barcode-scanner-b2qjh.sprites.app

## Known Limitations

- Galmart price is a **city-level online catalog** price, not a proven branch/cash-register price.
- Galmart's tested product response does not provide a reliable source-update timestamp; Baga records retrieval time instead.
- Only Galmart currently passes the live EAN→price integration bar. Other retailers remain research-only.
- Local photo uploads are appropriate for MVP/demo, not durable production object storage.
- Moderation API is token-protected; no admin UI. Empty ADMIN_TOKEN disables moderation endpoints.
- Merchant ownership/authentication is prototype-level; do not treat the merchant dashboard as a production authorization system.
- Camera scanning needs HTTPS and camera permission on mobile.
- The current frontend bundle triggers a Vite >500 kB warning; it works, but code splitting is a later optimization.

## Research and technical docs

- [Retail data research](docs/RETAIL_DATA_RESEARCH.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Price provenance](docs/PRICE_PROVENANCE.md)

## Retailer Research Status

Only Galmart is ACTIVE. [Second-pass evidence](docs/RETAILER_SECOND_PASS.md) and [HTTP probe log](docs/retailer-second-pass.json) document findings and unresolved fields for the other 11 retailers.

## Research Method

Use only unauthenticated public pages/catalog calls; inspect response fields, product identities, price scope and errors. No auth/CAPTCHA bypass, token harvesting, identity spoofing or rate-limit evasion. HTTP errors are blockers, not proof that an integration is impossible. Corpus ingestion validates/deduplicates, uses 10s timeouts, bounded retries and >=350ms delay, and checkpoints successful/not-found items. Run again with the same checkpoint to resume. Use a new checkpoint for a fresh measurement.

## Freshness and Cache

Official comparisons reuse successful persisted offers for 120 seconds by default. `?refresh=1` and “Обновить из источника” force retrieval. Retrieval freshness is separate from unknown source update time. Upstream failures retain an expired price labelled stale; confirmed not-found removes that cached offer. Merchant freshness threshold is 24 hours. These thresholds indicate age, not guaranteed price correctness. Parallel identical misses are not coalesced in this MVP.

## Security Notes

- Photo upload: JPEG/PNG/WebP only, maximum 5 MiB; MIME and magic signatures must agree. UUID filename and server-controlled extension; original filename ignored. Files served as static data with nosniff and sandbox CSP, never executed. This is signature validation, not full image decoding, malware scanning or EXIF removal.
- Failed observation submissions remove their uploaded file. Invalid multipart gets HTTP 400.
- Address invariant enforced in SQLite, not only forms. Invalid/empty/null prices rejected.
- Exact retailer names reserved; merchant prices always remain unofficial. No fuzzy blocking of local shop names.
- In-memory limits per IP: stores 20/min, observations 30/min, imports 10/min, product writes 60/min, compare 60/min. Restart resets counters. Proxy headers are not trusted; behind a shared proxy users can share a bucket. This is demo protection, not distributed abuse prevention.
- Merchant ownership remains prototype-level: anyone can edit a merchant catalog by ID. Do not store sensitive merchant data or present it as verified ownership.
- ADMIN_TOKEN is server-only. GET /api/v1/admin/observations lists pending rows. PATCH /api/v1/admin/observations/:id accepts {"status":"verified"} or {"status":"rejected"} with Authorization: Bearer token. Only pending rows can transition; rejected observations disappear from public results, verified observations remain USER REPORTED.
- Production dependencies and development dependencies should be audited separately; see verification report.

## Hackathon Scope

A working web MVP: iPhone ZXing scanning, one real retailer adapter, merchant catalogs/import, separate user observations, moderation API, SQLite persistence and explicit provenance. No native iOS rewrite, AI marketing feature, guaranteed shelf price, price-history chart or claim of nationwide coverage.

## What Is Real vs Research-only

**Real:** Galmart live city-catalog lookup, physical branch directory, exact merchant-store catalog lookup, pending user observations and photo uploads, moderation API.
**Research-only:** Magnum, SMALL, METRO, ANVAR, Toimart, Arbuz, Carefood, Firkan24, A-Store, Fix Price Kazakhstan, Ayan Market. No second official price adapter has met the activation bar.

## iPhone Manual Test Checklist

Use Safari on a physical iPhone; automated API tests do not certify camera behavior.

1. Open the demo in a private tab without Sprite login; require the Baga page.
2. Tap Camera, allow permission; rear camera appears inline.
3. Scan 4870207314301 on real packaging; code fills and one search starts.
4. Check product, price, OFFICIAL RETAILER, city catalog scope, retrieval time and warnings.
5. Close/reopen camera several times; camera indicator stops on close. Also close while permission is pending, then grant it: no background camera.
6. Deny permission; verify useful message and manual entry still works.
7. Add an observation: concrete store/address, prefilled EAN, price, time, optional old price/comment.
8. Attach a JPEG/PNG/WebP under 5 MiB; submit and open photo; observation remains separate and pending. HEIC is intentionally unsupported.
9. Rotate phone; modal close and controls remain accessible.
10. Merchant mode: create store with required address, scan a product, set price, save, then select the store as customer.
11. Refresh Safari; store/catalog data persist; camera does not start automatically.
12. Disable network during lookup, check error state, reconnect and retry/force-refresh successfully.

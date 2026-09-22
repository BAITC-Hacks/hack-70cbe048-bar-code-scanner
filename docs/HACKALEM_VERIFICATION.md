# Baga HackALEM verification — 2026-09-22 UTC

Status: improved existing build, **not all P0 gates closed**. Public access and physical iPhone manual verification remain open.

## Verified results

- Baseline: 26/26 tests, production build passes, anonymous root/health both 302.
- Updated: **47/47 tests in 12 files**, TypeScript and Vite production build pass.
- Clean environment approximation: a fresh directory without node_modules, dist, .env or any SQLite data; Node **22.23.2**; npm install, npm test, npm run build, npm start succeed. No native-module rebuild. This is not a fresh operating-system/container test.
- Production service restarted from updated dist on port 8080, existing data/history.sqlite retained.
- Production local HTTP smoke: /, /api/health, /api/v1/retailers, /api/v1/store-directory all 200.
- Live Astana results: 4870207314301 → 1265 KZT; 5449000054227 → 785 KZT; 4870036001205 → 1175 KZT. These were retrieved values, not guaranteed future or shelf prices.
- Merchant store creation, product write, exact-store lookup, observation submission and separate comparison all passed.
- Smoke store ID 45, its offers and observation removed. integrity_check=ok.
- Admin HTTP route returns 503 while ADMIN_TOKEN absent. Authenticated verify/reject, unauthorized access and invalid/repeated transitions tested in isolated HTTP tests. No production moderation token was installed or exposed.
- Anonymous public requests still return **302**, not 200. Deployment URL: https://barcode-scanner-b2qjh.sprites.app
- 128 real unique validated corpus GTINs, 61 Galmart matches, 67 not-found, 0 failures in new isolated ingestion run. Earlier baseline: 39/43.
- Only **Galmart ACTIVE**. No second working official retailer.
- Bundle remains 580.68 kB (gzip 161.02 kB). P2 splitting deferred while P0 public/mobile gates remain open.

## Fixes and added protection

Strict nonempty prices; malformed EAN is no longer silently stripped in server merchant/observation validation; robust quoted CSV parsing and transaction rollback; scanner close/permission race session guard; source warnings visible; retrieval timestamp no longer labelled source update time; stale/error/not-found separation; 120s official cache plus force refresh; token-protected moderation; rejected observations hidden without changing provenance; simple rate limits; reserved exact retailer names and unofficial merchant labels; mobile store search; image signatures plus MIME/size, UUID names, static sandbox/nosniff, malformed multipart 400 and failed-upload cleanup.

## Database safety

Checkpoint v9 plus data/backups/pre-hardening-20260922T224253Z.sqlite, integrity=ok before changes. Backup contained 11 stores and 0 observations.
Additive schema_migrations version 1, legacy_store_address_issues and address INSERT/UPDATE triggers. Historical null addresses preserved, flagged, excluded from observation directory and cannot receive observations until repaired. No table rebuild or destructive data migration. Existing stores/branch observation associations survive idempotent upsert sync.

## Files changed / added relative to Sprite baseline

- server/src/app.ts, db.ts, validation.ts, merchant.ts, observations.ts, compare.ts, retailers/galmart.ts.
- server/src/security.ts (new).
- src/main.tsx; src/csv.ts (new).
- .npmrc (new), .env.example.
- scripts/ingest-galmart.ts; scripts/production-smoke.mjs (new).
- tests/hardening.test.ts, http-security.test.ts, csv.test.ts, cache.test.ts (new).
- README.md; docs/RETAILER_SECOND_PASS.md, retailer-second-pass.json, HACKALEM_VERIFICATION.md.
- research/corpus/gtins.txt and arbuz-identity.json (new).

GitHub was behind the Sprite and did not contain the current merchant/scanner/observations implementation. Synchronization must therefore include existing baseline application files and package-lock.json too, while preserving repository history.

## Research findings and remaining work

Magnum: public CMS list/detail JSON and price fields found, no EAN field in sampled records; barcode-as-name query empty. No fabricated mapping.
METRO: public store map (six codes) and search/PDP frontend modules found, but no verified selected-store GTIN→price payload.
Arbuz: public barcode product identities found; sample raw HTML price fields zero, search uses frontend auth abstraction. No token extraction or fake zero-price integration.
Other retailers: see second-pass evidence. Smaller-retailer homepage probes are incomplete deep research, explicitly not certified adapters.

Known limitations: no physical iPhone test performed by the agent; no second retailer; merchant catalogs still lack owner authorization; rate limiter groups users behind shared proxy; signature validation is not full image decode; no geolocation, offer history or lazy scanner added; source freshness unavailable for Galmart; corpus identities don't imply Galmart coverage. Official cache does not coalesce concurrent misses. Full tests do not include a real camera.

Dependency audit: existing development-only Vitest 2 dependency chain reports five advisories (including one critical UI-server advisory). Attempted isolated upgrade to Vitest 4.1.11 failed inside npm with “Cannot read properties of null (reading edgesOut)”; baseline package/lock retained. Do not expose Vite/Vitest development/UI servers. Production dependency audit is recorded separately at verification time.

## Exact owner action for public demo

The available Sprites connector lacks URL auth update. Run in an authenticated owner CLI:

```bash
sprite url update --auth public -o sanzhar-923 -s barcode-scanner
curl -sS -o /dev/null -w '%{http_code}\n' https://barcode-scanner-b2qjh.sprites.app/
curl -sS -o /dev/null -w '%{http_code}\n' https://barcode-scanner-b2qjh.sprites.app/api/health
```

Both results must be 200 without cookies/Authorization. This action changes infrastructure policy, not app code.

## Two-minute demo and iPhone checklist

The exact timed demo and 12-step physical iPhone checklist are in README sections “2-minute Jury Demo” and “iPhone Manual Test Checklist”. Use real packaging where available and label manually entered merchant values as demo inputs.

## Top three pre-HackALEM tasks

1. Owner enables public Sprite URL and verifies anonymous 200 responses.
2. Run all 12 iPhone Safari steps on a physical phone, including permission-pending close/reopen.
3. Confirm judges have repository access (repository is private), retain backup, and rehearse the 2-minute flow on the actual venue network.

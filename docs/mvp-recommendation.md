# MVP recommendation

## MVP 0 — reproducible proof (1–2 days)

Node.js 20+ or PowerShell, no mobile UI. Input EAN and city; call Galmart search; return title, pack, price, old price, inventory/availability, retailer id, retrieval time, `source_updated_at` and confidence. Acceptance: five sourced EANs match twice, one unknown returns empty, and city switch is visible. Existing `galmart-probe.ps1` is the reference experiment.

## MVP 1 — demo (3–7 days, one developer)

Mobile web PWA (TypeScript + React/Vite) with camera scanning via a maintained browser barcode library, a city selector, comparison cards, and source/time badges. Backend Node/TypeScript adapter isolates each retailer; SQLite stores only normalized observations and hashes, not copied catalog dumps. Galmart adapter is the only live adapter at first. A card must say “онлайн-каталог Астана” and “обновление источником неизвестно”. Add manual photo/receipt observation form with consent and redaction; do not use OCR for the numeric price until a human confirms it.

Acceptance: scan one of five test EANs; result under 3 seconds on a normal connection; unknown code has an explicit empty state; no price is shown without source and retrieval time; product size mismatch cannot be silently merged.

## MVP 2 — pilot

Obtain retailer permission or signed feeds, then add a second network and two Astana branches. Add freshness SLA, stale-price suppression after seven days, price-condition fields (club, promotion, delivery), audit log, error metrics and a discrepancy workflow comparing shelf photo, receipt and API. Cloud deployment and paid services are intentionally deferred until source permission and usage justify them.

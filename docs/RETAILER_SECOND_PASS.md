# Second-pass retailer evidence — 2026-09-22 UTC

Scope: public web surfaces only. No login bypass or private tokens. These findings are bounded probes, not exhaustive proof of absence. All 11 remain research-only.

| Retailer | Observed public evidence | Missing gate |
|---|---|---|
| Magnum | https://magnum.kz:1337/api/products?pagination[pageSize]=3&populate=* returned 200. Three product IDs: 102073, 102045, 102047. Attributes include name, start_price, final_price, discount, action_start/end, createdAt/updatedAt, shops, category. Detail /api/products/102073?populate=* also 200. Public product page and sitemap returned 200. | No EAN/barcode/GTIN field in sampled list/detail. Name search for 4870207314301 returned empty data. CMS updatedAt is not proven price-update time. Product-name matching cannot establish GTIN identity. |
| MagnumGO | https://magnumgo.kz/ failed from this environment. | No confirmed deterministic public GTIN feed. Network failure is not a claim about service availability for consumers. |
| METRO | https://shop.metro-kz.com/ redirected to /shop, HTTP 200. Public JS exposes searchdiscover article-search and PDP modules. Public /cia/content/sitecore/storeIdMappingWithOnlineVisibility/KZ/ru-KZ returns six visible store codes: 00010,00011,00013,00014,00018,00021. Official metro-kz.com says offers vary by store. | Store scoping exists, but no verified GTIN→selected store→price response. Module discovery is not an adapter. Source timestamp/availability mapping unverified. |
| SMALL | https://small.kz/ returned 403. | Stop at access barrier; no bypass. Partner evidence from prior research is not an official integration. |
| ANVAR | https://shop.anvar.kz/ returned 200 and public SPA asset /assets/index-DFZ0l-EY.js. | No EAN mapping verified. |
| Toimart | https://toimart.kz/ → www.toimart.kz, 200. | No barcode field in tested page; promotions are not a deterministic lookup. |
| Arbuz | https://arbuz.kz/ returned public collection product JSON in HTML attributes with id/name/barcode. 86 distinct valid GTIN identities extracted; combined corpus 128. Public frontend refers to shop/search/products through an auth-token abstraction; no private token used. | HTML sample price_actual/price_previous are zero; not accepted as live offers. Wrong search URL returns generic homepage content, so never treat first result as a barcode match. Astana homepage differs. |
| Carefood | https://carefood.kz/ returned 200 with public catalog frontend assets. | No EAN→live offer confirmed. |
| Firkan24 | https://firkan24.kz/ timed out after 8s. Search also surfaced firkaan.kz. | No stable interface verified; timeout is not definitive absence. |
| A-Store | https://a-store.kz/ returned 200 (OpenCart frontend). | No deterministic barcode mapping verified. |
| Fix Price Kazakhstan | https://fix-price.kz/ru returned 403. | Access barrier; no bypass. |
| Ayan Market | Previously identified product URL under new.ayanmarket.kz failed to fetch. | Stable current public barcode search unverified. |

All timestamps above are Baga retrieval dates, not retailer price update timestamps. No new adapter activated. Broad homepage probes for smaller retailers do not fulfill a complete product/search/sitemap/mobile-call investigation; those remain follow-up work.

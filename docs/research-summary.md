# Executive Summary

Проверка 20.09.2026 подтвердила главное техническое условие частично: реальный EAN можно программно превратить в товар и цену в Galmart для города Астана. По 11 реальным EAN API вернул товар и цену; два прохода в одной сессии совпали. Цена остаётся городской онлайн-ценой: филиал и время обновления не возвращаются. В Galmart цена Coca-Cola 1 л отличалась между Астаной (785 ₸) и Алматы (700 ₸), поэтому city/store key обязателен.

Magnum имеет отдельный официально заявленный barcode price checker и публичный catalog API, но EAN mapping в исследованном API не подтверждён. Small доступен через delivery-партнёров и HTML может содержать GTIN, но Wolt Terms запрещают automated collection without consent. Toimart даёт промо-цены, однако Астана не указана среди городов его собственного списка и EAN mapping не найден. Galmart — лучший источник для MVP 0.

Проблема расхождения цен существует и признаётся регулятором, но распространённость в Астане и готовность устанавливать отдельное приложение неизвестны. Казахстанские аналоги уже есть: arzan.kz (бывший MinPrice), VAUXMART и другие; Magnum Club закрывает внутри сети сценарий barcode→price. Поэтому преимущество должно быть в проверяемом cross-retailer сравнении с филиалом, временем и условиями, а не в самом сканере.

## Evidence Matrix

| Claim | Evidence | Source | Confidence |
|---|---|---|---|
| Galmart EAN→product→price работает | 11/12 sourced EAN matched; 2 passes | `research/retailers/galmart.md`, `experiments/retailer-price-fetch/galmart-results.json` | HIGH |
| Galmart city changes price | Coca-Cola 1 l: Astana 785, Almaty 700 | same | HIGH |
| Magnum has barcode checker | Official Play listing | https://play.google.com/store/apps/details?hl=ru&id=kz.magnum.app | HIGH |
| Magnum public catalog API has prices | `/api/products`, `/cities`, `/shops` | `research/retailers/magnum.md` | HIGH |
| Toimart EAN mapping | Promo HTML only | `research/retailers/toimart.md` | UNKNOWN |
| Direct KZ alternatives exist | arzan, VAUXMART, MinPrice rename | `research/competitors/report.md` | MEDIUM/HIGH |
| Price mismatch is a real consumer issue | official complaints context + anecdotal evidence | `research/problem/report.md` | MEDIUM for existence; UNKNOWN prevalence |

## Retailer Matrix

| Network | Barcode support | Price source | Store-specific | API | MVP usable | Risk |
|---|---|---|---|---|---|---|
| Galmart | Confirmed search | public city catalog | City, not branch | Confirmed | Yes, city-labelled | license, freshness |
| Magnum | Official app claims checker; API mapping unknown | catalog/promos | shops in API; price linkage incomplete | Confirmed | Limited | endpoint/license |
| Small | Delivery catalog; no retailer EAN proof | partner/app | delivery venue | Unknown | Evidence only | Wolt ToS |
| Toimart | Unknown | promo website | city list excludes Astana | Partial | No | coverage |

## Recommendation

**PIVOT → constrained BUILD.** Build a demo around Galmart city-level EAN lookup plus a clearly labelled user observation layer, then add a second retailer only after another real EAN→price path and legal permission are confirmed. Do not promise “current cash price at this branch” yet.

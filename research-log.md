# Research log

| Date/time | Question | Action | Source | Finding | Confidence | Next step |
|---|---|---|---|---|---|---|
| 2026-09-20T23:21+05:00 | Состояние проекта и GitHub | Проверены Git, CLI и профиль подключённого GitHub | Локальная папка; GitHub connector | Репозиторий пустой; CLI не авторизован; connector возвращает профиль sazmak, но инструмента создания репозитория среди доступных GitHub tools нет | HIGH | Проверить доступные интеграции; продолжать локально |
| 2026-09-20T23:22+05:00 | Как распараллелить исследование | Запущены три исследовательских субагента | Утверждённый план | Toimart/Galmart, barcode, problem/competitors выполняются независимо от Magnum/Small | HIGH | Свести доказательства на первом контрольном рубеже |
| 2026-09-20T23:24+05:00 | Можно ли получить цену по реальному EAN | Публичный Galmart GET с City:2, 12 sourced EAN, два прохода | galmart.kz API; `galmart-results.json` | 11/12 EAN matched to product id and KZT price; 1 real code empty; unknown code empty | HIGH | Проверить полку/кассу и второй approved retailer |
| 2026-09-20T23:25+05:00 | Можно ли сравнить каналы | Offline inspection of one Small Astana Wolt HTML response | Wolt venue; `small-wolt-sample.json`; Wolt Terms 13.6 | 22 GTIN/price records embedded, venue/address available; automated reuse restricted, no source update time | HIGH technical / HIGH legal limitation | Do not use in production without permission |
| 2026-09-20T23:26+05:00 | Новизна решения | Competitor and problem research completed | `research/competitors/report.md`, `research/problem/report.md` | KZ analogues exist; problem exists but prevalence and install demand unknown | MEDIUM | Differentiate by provenance, freshness and branch evidence |
| 2026-09-20T23:27+05:00 | Итоговое решение | Evidence synthesis | `docs/research-summary.md` | PIVOT → constrained BUILD: Galmart city demo + observations; second network only after proof/permission | HIGH | Field protocol and data permission |

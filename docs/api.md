# API

`GET /api/v1/price?ean=4870207314301&city=astana` поддерживает `astana` (Gal­mart City 2) и `almaty` (City 1). Ответы имеют статусы `found`, `not_found`, `source_error`; некорректный EAN получает HTTP 400. `GET /api/v1/history` возвращает последние 20 нормализованных запросов. Источник, город, `retrieved_at`, retailer ID и предупреждения обязательны для found.

# Реализация MVP

Проект состоит из React/Vite frontend (`src/`), Express/TypeScript API (`server/src/`) и SQLite истории. Единственный live-адаптер — Galmart. Frontend работает через Vite proxy в dev-сценарии (или через reverse proxy в production).

`npm install` устанавливает зависимости, `npm run dev` запускает API и UI, `npm test` выполняет mock-тесты, `npm run build` собирает frontend и проверяет TypeScript. В реальной публикации камеру следует подключить через `@zxing/browser` и HTTPS; ручной ввод уже является резервным сценарием.

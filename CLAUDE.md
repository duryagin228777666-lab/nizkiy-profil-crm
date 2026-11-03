# CRM «Низкий профиль» — рабочая область

Эта папка — **отдельный проект и отдельный git-репозиторий** (настольная CRM на Electron).
Работаем только здесь. Остальной `NIZKIPROF` (сайт, Telegram-бот, `hh/`, `игра/`, `РЕЗЮМЭ/`,
`test crm/` и т.д.) в эту область не входит — не читать, не править, не анализировать.

## Границы

| Можно | Нельзя без прямой просьбы |
|---|---|
| Всё внутри `crm/` (кроме сгенерированного, см. ниже) | Любые файлы выше `crm/` |
| | Править `../server/*` — это чужой репозиторий (сайт + бот), CRM от него больше не зависит |
| | Читать `../.env`, `bookings.json`, токены |

Коммиты — только в репозиторий `crm/` (из этой папки), не в родительский.

Не читать (сгенерировано / тяжёлое): `node_modules/`, `out/`, `release/`, `graphify-out/cache/`.

## Стек и структура

Electron 31 + electron-vite, React 18, TypeScript 5.5 (strict), CSS без UI-kit.

```
src/main/       main-процесс: localStore.ts (заявки) + storeFile.ts (диск), messaging.ts (Telegram/Green-API),
                telegram.ts (getUpdates, /start КОД), reminders.ts, tray.ts, settings.ts (+ secrets),
                security.ts, rules.ts (чистая логика под тесты)
src/preload/    contextBridge — единственный мост renderer ↔ main
src/renderer/   React UI: App.tsx, components/, hooks/, lib/
src/shared/     типы Booking, время (Europe/Moscow), телефоны, константы
```

## Правила проекта

- Заявки локально: `%APPDATA%/NizkiyProfil CRM/bookings.json` (+ `backups/`). Сайт и сервер не используются.
- Сеть только из main-процесса и только на api.telegram.org / хосты Green-API; токены не попадают в renderer (`telegramConfigured`, `whatsappConfigured`).
- Пути IPC-API — только через whitelist в `security.ts`.
- Боту CRM нужен свой токен: бот сайта даст 409 на getUpdates.
- Время везде Europe/Moscow, `visit_at` = `"YYYY-MM-DD HH:MM"` или `""` (необработанная).
- `called` и `reminder_sent` — независимые флаги.
- Модель `Booking` держим совместимой с прежним форматом `../server/store.py` (перенос старых записей).
- `UnscheduledPanel.tsx` не используется (заменён `InboxPage.tsx`).

## Команды

```powershell
npm test            # vitest: rules, storeFile, security
npm run typecheck   # проверка типов
npm run build       # сборка main + preload + renderer
npm run dev         # запуск
npm run dist        # установщик в release/
```

Текущий статус и планы — `NOTES.md`.

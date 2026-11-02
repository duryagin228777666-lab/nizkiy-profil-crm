# CRM «Низкий профиль» — рабочая область

Эта папка — **отдельный проект и отдельный git-репозиторий** (настольная CRM на Electron).
Работаем только здесь. Остальной `NIZKIPROF` (сайт, Telegram-бот, `hh/`, `игра/`, `РЕЗЮМЭ/`,
`test crm/` и т.д.) в эту область не входит — не читать, не править, не анализировать.

## Границы

| Можно | Нельзя без прямой просьбы |
|---|---|
| Всё внутри `crm/` (кроме сгенерированного, см. ниже) | Любые файлы выше `crm/` |
| Читать контракт API: `../server/crm_api.py`, CRM-часть `../server/store.py` (от `# CRM:` до конца) | Править `../server/*` — это чужой репозиторий (сайт + бот) |
| | Читать `../.env`, `bookings.json`, токены |

Если задача требует правки бэкенда (новое поле, эндпоинт) — сначала сказать об этом и спросить.
Коммиты — только в репозиторий `crm/` (из этой папки), не в родительский.

Не читать (сгенерировано / тяжёлое): `node_modules/`, `out/`, `release/`, `graphify-out/cache/`.

## Стек и структура

Electron 31 + electron-vite, React 18, TypeScript 5.5 (strict), CSS без UI-kit.

```
src/main/       main-процесс: api.ts (HTTP), security.ts (SSRF/whitelist), mock.ts (демо), settings.ts
src/preload/    contextBridge — единственный мост renderer ↔ main
src/renderer/   React UI: App.tsx, components/, hooks/, lib/
src/shared/     типы Booking, время (Europe/Moscow), телефоны, константы
```

## Правила проекта

- Сеть только из main-процесса; токен никогда не попадает в renderer (`tokenConfigured`).
- Пути API — только через whitelist `/api/crm` в `security.ts`.
- Время везде Europe/Moscow, `visit_at` = `"YYYY-MM-DD HH:MM"` или `""` (необработанная).
- `called` и `reminder_sent` — независимые флаги.
- Модель `Booking` должна оставаться совместимой с `../server/store.py`.
- `UnscheduledPanel.tsx` не используется (заменён `InboxPage.tsx`).

## Команды

```powershell
npm run typecheck   # проверка типов
npm run build       # сборка main + preload + renderer
npm run dev         # запуск (по умолчанию демо-режим, сервер не нужен)
npm run dist        # установщик в release/
```

Текущий статус и планы — `NOTES.md`.

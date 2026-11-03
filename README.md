# Низкий профиль — Desktop CRM

<p align="center">
  <img src="docs/banner.svg" alt="Низкий профиль CRM" width="100%" />
</p>

<p align="center">
  <strong>Настольная CRM для шиномонтажа</strong><br/>
  Расписание дня · очередь необработанных заявок · обзвон · напоминания в Telegram и WhatsApp<br/>
  <em>Electron · React · TypeScript · Telegram Bot API · Green-API</em>
</p>

<p align="center">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-31-47848F?style=flat-square&logo=electron&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-0e1116?style=flat-square" />
</p>

---

## Зачем это

Реальный сервис шиномонтажа «Низкий профиль» (Жулебино, Москва) уже принимал заявки с сайта и управлял ими через Telegram-бота. Администратору нужно было **видеть день целиком**: кто на какое время, кого ещё не обзвонили, ушло ли SMS-напоминание.

Эта CRM — отдельное настольное приложение: плотная сетка слотов, несколько клиентов в одной ячейке, горячие клавиши, без «веб-дашборда в браузере».

| Было | Стало |
|---|---|
| Записи только в Telegram | День на временной сетке |
| Один клиент «в голове» | 2–3 клиента в слот 10:00 — норма |
| Не видно, обзвонили ли | Индикаторы обзвона и SMS |
| Напоминания вручную | CRM сама пишет клиенту за N часов до визита |

---

## Возможности

- **Расписание дня** — слоты 15/20/30/60 мин, рабочий день настраивается (по умолчанию 09:00–21:00, Москва)
- **Несколько клиентов в одном слоте** — карточки стеком, счётчик на переполненных ячейках
- **Необработанные** — отдельная страница для заявок без времени (обычно с сайта)
- **Drag & drop** — перенос карточки в слот назначает `visit_at` и сбрасывает SMS-флаг
- **Обзвон / напоминание** — два независимых индикатора (`called` ≠ `reminder_sent`)
- **Напоминания** — за N часов до визита в Telegram или WhatsApp; не дошло — уведомление Windows «позвоните клиенту»
- **Сообщения клиенту** — из карточки, с шаблонами; приглашение в Telegram-бота ссылкой через WhatsApp
- **Работает в трее** — крестик сворачивает окно, напоминания продолжают уходить; автозапуск с Windows
- **CRUD за секунды** — создать, править, отменить или удалить навсегда
- **Фильтры и поиск** — по имени, телефону, коду, услуге, статусу обзвона
- **Горячие клавиши** — `N` новый, `Enter` править, `C` обзвон, `S` SMS, `Del` отменить
- **Без сервера** — заявки хранятся на компьютере администратора, копия раз в день

---

## Скриншоты

<p align="center">
  <img src="docs/screenshots/day.png" alt="Расписание дня" width="100%" />
  <br/><em>Расписание — сетка слотов и карточка клиента</em>
</p>

<p align="center">
  <img src="docs/screenshots/inbox.png" alt="Необработанные заявки" width="100%" />
  <br/><em>Необработанные — заявки без времени визита</em>
</p>

<p align="center">
  <img src="docs/screenshots/new-client.png" alt="Новый клиент" width="70%" />
  <br/><em>Создание заявки с датой и слотом</em>
</p>

<p align="center">
  <img src="docs/screenshots/settings.png" alt="Настройки" width="70%" />
  <br/><em>Настройки (скриншот старой версии)</em>
</p>

---

## Архитектура

```
┌──────────────┐   IPC   ┌─────────────────────────┐  HTTPS  ┌──────────────────┐
│  React UI    │ ──────► │  main-процесс           │ ──────► │ api.telegram.org │
│  (renderer)  │ ◄────── │  localStore · reminders │ ──────► │ Green-API        │
└──────────────┘         │  telegram (getUpdates)  │         └──────────────────┘
                         └────────────┬────────────┘
                                      ▼
            %APPDATA%/NizkiyProfil CRM: bookings.json, backups/, secrets.json (DPAPI)
```

**Почему Electron, а не Tauri / веб.** Один runtime — Node.js. Сеть и файлы — только в main-процессе: токены мессенджеров не попадают в окно. UI — системный шрифт, плотная таблица, нативное меню и диалоги подтверждения.

**Безопасность (заложена в MVP):**

- IPC только из своего окна, whitelist путей локального API
- сеть только на `api.telegram.org` и хосты Green-API, `redirect: 'error'`, токены вырезаются из ошибок
- токены зашифрованы `safeStorage` (DPAPI) и не отдаются в renderer (`telegramConfigured`)
- `sandbox: true`, DevTools скрыты в релизной сборке

---

## Стек

| Слой | Технологии |
|---|---|
| Desktop | Electron 31, electron-vite, electron-builder |
| UI | React 18, TypeScript, CSS (без UI-kit) |
| Хранилище | JSON в профиле Windows, атомарная запись, ежедневные копии |
| Мессенджеры | Telegram Bot API (long-poll), Green-API (WhatsApp) |
| Тесты | Vitest |

Модель заявки (совместима с прежним форматом сайта):

```ts
Booking {
  code, name, phone, service, comment,
  status: new | confirmed | in_progress | done | cancelled
  visit_at: "YYYY-MM-DD HH:MM" | ""   // Москва
  called, called_at                   // обзвон
  reminder_sent, reminder_channel     // напоминание
  notify_channel                      // telegram | whatsapp | "" (авто)
  source: site | bot | crm
}
```

---

## Быстрый старт

```bash
# Node.js 18+
npm install
npm run dev
```

**⚙ Настройки:** токен отдельного бота от @BotFather (Telegram) и `idInstance` / `apiTokenInstance` / `apiUrl` из кабинета Green-API (WhatsApp).

```bash
npm test
npm run typecheck
npm run dist         # установщик Windows .exe
```

---

## Структура

```
src/
├── main/          # окно, трей, IPC, локальное хранилище, мессенджеры, напоминания
├── preload/       # contextBridge → window.crm
├── renderer/      # React UI: день, inbox, формы
└── shared/        # типы, время (Europe/Moscow), телефон РФ
```

---

## Дорожная карта

- [x] Сетка дня и multi-booking в слоте
- [x] Страница необработанных заявок
- [x] Локальное хранилище без сервера
- [x] Напоминания и сообщения в Telegram / WhatsApp
- [x] Базовая безопасность IPC / токенов
- [ ] Отправка SMS (SMS.ru)
- [ ] Иконка и автообновление установщика
- [ ] macOS / Linux сборки

---

## О проекте

Сделано как рабочий инструмент для конкретного автосервиса и как кейс в портфолио:  
**desktop app + REST + реальный бизнес-процесс**, а не абстрактный ToDo.

Автор: [duryagin228777666-lab](https://github.com/duryagin228777666-lab) · ТГ @CEOOOIP · сервис: шиномонтаж «Низкий профиль», Москва

---

## License

MIT — свободное использование кода; название и бренд сервиса остаются за владельцем.

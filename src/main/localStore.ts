/**
 * Заявки на компьютере администратора — CRM работает без сайта и его сервера.
 *
 * Держит тот же контракт, что был у /api/crm на Flask (server/crm_api.py), поэтому renderer
 * не знает, где лежат данные. Файл — userData/bookings.json, раз в день копия в backups/.
 */
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  DEFAULT_GRID,
  SERVICES,
  STATUS_LABEL,
  STATUS_ORDER
} from '../shared/constants'
import { normalizePhone } from '../shared/phone'
import { isValidClock, isValidIsoDate, splitVisitAt, todayIso, visitDate } from '../shared/time'
import type { ApiResult, Booking, BookingStatus, HttpMethod, NotifyChannel } from '../shared/types'
import { availableChannels, sendToClient } from './messaging'
import { isDueForReminder, telegramLink, type StoredBooking } from './rules'
import { getSettings, userDataDir } from './settings'
import { backupStore, readStore, writeStore, type StoreData } from './storeFile'

const EDITABLE_TEXT = ['name', 'phone', 'service', 'comment'] as const
const MAX_MESSAGE = 1000
const CHANNELS: NotifyChannel[] = ['telegram', 'whatsapp', 'sms']

let db: StoreData | null = null
let lastBackup = ''
let botUsername = ''
const listeners: Array<() => void> = []

function nowStamp(): string {
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date())
  return `${todayIso()} ${clock}`
}

function genCode(taken: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = ''
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    }
    if (!taken.has(code)) return code
  }
  return `${CODE_ALPHABET[0]}${Date.now()}`.slice(0, CODE_LENGTH + 2)
}

function load(): StoreData {
  if (!db) db = readStore(userDataDir())
  backupDaily()
  return db
}

function backupDaily(): void {
  const today = todayIso()
  if (lastBackup === today) return
  try {
    backupStore(userDataDir(), today)
    lastBackup = today
  } catch (error) {
    console.error('[store] резервная копия не создана:', error)
  }
}

/**
 * Изменить данные и записать на диск. Не записалось — откатываем память к снимку,
 * иначе окно и файл разойдутся, а повтор создания дал бы дубль.
 * external = изменение пришло не из окна (бот, напоминание): окну пора обновиться.
 */
function commit(change: (data: StoreData) => void, external = false): void {
  const data = load()
  const snapshot = structuredClone(data)
  change(data)
  try {
    writeStore(userDataDir(), data)
  } catch (error) {
    db = snapshot
    throw error
  }
  if (external) for (const listener of listeners) listener()
}

/** Регулярка пропустила бы 2026-99-99 25:99, а Date.UTC молча сдвинул бы напоминание. */
function isValidVisit(raw: string): boolean {
  const parts = splitVisitAt(raw)
  if (!parts || raw !== `${parts.date} ${parts.time}`) return false
  if (!isValidIsoDate(parts.date) || !isValidClock(parts.time)) return false
  const [y, m, d] = parts.date.split('-').map(Number)
  const check = new Date(Date.UTC(y, m - 1, d))
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d
}

export function onStoreChanged(listener: () => void): void {
  listeners.push(listener)
}

/** Имя бота для ссылок t.me/<бот>?start=<код>; '' — бот не настроен. */
export function setBotUsername(name: string): void {
  botUsername = name
}

function toPublic(booking: StoredBooking): Booking {
  const { tg_chat_id: chatId, ...rest } = booking
  return { ...rest, tg_linked: chatId !== null, tg_link: telegramLink(botUsername, booking.code) }
}

function gridSettings() {
  return { ...DEFAULT_GRID, reminder_hours: getSettings().reminderHours }
}

function fail(status: number, error: string): ApiResult<never> {
  return { ok: false, error, status }
}

function findBooking(code: string): StoredBooking | undefined {
  return load().bookings.find((b) => b.code === code.toUpperCase())
}

function applyPatch(booking: StoredBooking, fields: Record<string, unknown>): string | null {
  for (const key of EDITABLE_TEXT) {
    if (key in fields) {
      const value = String(fields[key] ?? '').trim()
      if (key === 'name' && !value) return 'Имя не может быть пустым'
      if (key === 'phone' && !normalizePhone(value)) return 'Укажите корректный номер телефона'
      if (key === 'service' && value && !SERVICES.includes(value as (typeof SERVICES)[number])) {
        return `Неизвестная услуга: ${value}`
      }
      booking[key] = value
    }
  }

  if ('status' in fields) {
    const status = String(fields.status ?? '') as BookingStatus
    if (!STATUS_ORDER.includes(status)) return `Неизвестный статус: ${status}`
    booking.status = status
  }

  if ('visit_at' in fields) {
    const raw = String(fields.visit_at ?? '').trim()
    if (raw && !isValidVisit(raw)) {
      return "Время визита должно быть в формате 'ГГГГ-ММ-ДД ЧЧ:ММ'"
    }
    if (raw !== booking.visit_at) {
      booking.visit_at = raw
      booking.reminder_sent = false
      booking.reminder_channel = ''
      booking.reminder_error = ''
      if (raw && (booking.status === 'new' || booking.status === 'cancelled')) {
        booking.status = 'confirmed'
      }
    }
  }

  if ('called' in fields) {
    const called = Boolean(fields.called)
    if (called !== booking.called) {
      booking.called = called
      booking.called_at = called ? nowStamp() : null
    }
  }

  if ('reminder_sent' in fields) booking.reminder_sent = Boolean(fields.reminder_sent)

  if ('notify_channel' in fields) {
    const channel = String(fields.notify_channel ?? '').trim()
    if (channel && !CHANNELS.includes(channel as NotifyChannel)) return `Неизвестный канал связи: ${channel}`
    booking.notify_channel = channel as NotifyChannel | ''
  }
  return null
}

async function handleMessage(code: string, body: Record<string, unknown>): Promise<ApiResult<unknown>> {
  const booking = findBooking(code)
  if (!booking) return fail(404, `Заявка ${code} не найдена`)
  const text = String(body.text ?? '').trim()
  if (!text) return fail(400, 'Пустое сообщение')
  if (text.length > MAX_MESSAGE) return fail(400, `Сообщение длиннее ${MAX_MESSAGE} символов`)
  const requested = String(body.channel ?? '').trim()
  if (requested && !CHANNELS.includes(requested as NotifyChannel)) return fail(400, `Неизвестный канал: ${requested}`)

  const result = await sendToClient(booking, text, requested)
  if (!result.ok) return fail(502, result.error)
  return { ok: true, data: { ok: true, channel: result.channel } }
}

function handleList(date: string): ApiResult<unknown> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return fail(400, 'Нужен параметр date в формате ГГГГ-ММ-ДД')
  }
  const all = load().bookings
  const scheduled = all
    .filter((b) => visitDate(b.visit_at) === date)
    .sort((a, b) => a.visit_at.localeCompare(b.visit_at) || a.id - b.id)
  const unscheduled = all
    .filter((b) => !b.visit_at)
    .sort((a, b) => Number(a.called) - Number(b.called) || b.id - a.id)
  return {
    ok: true,
    data: {
      ok: true,
      date,
      scheduled: scheduled.map(toPublic),
      unscheduled: unscheduled.map(toPublic),
      services: [...SERVICES],
      settings: gridSettings(),
      channels: availableChannels()
    }
  }
}

function handleCreate(body: Record<string, unknown>): ApiResult<unknown> {
  const name = String(body.name ?? '').trim()
  if (!name) return fail(400, 'Укажите имя клиента')
  if (!normalizePhone(String(body.phone ?? ''))) {
    return fail(400, 'Укажите корректный номер телефона')
  }

  const store = load()
  const taken = new Set(store.bookings.map((b) => b.code))
  const booking: StoredBooking = {
    id: store.seq + 1,
    code: genCode(taken),
    name,
    phone: String(body.phone ?? '').trim(),
    service: SERVICES[0],
    comment: String(body.comment ?? '').trim(),
    status: 'new',
    source: 'crm',
    visit_at: '',
    reminder_sent: false,
    called: false,
    called_at: null,
    created_at: nowStamp(),
    notify_channel: '',
    reminder_channel: '',
    reminder_error: '',
    tg_chat_id: null
  }

  // visit_at через applyPatch: заявка со временем сразу становится «Подтверждена»
  const patch: Record<string, unknown> = { visit_at: String(body.visit_at ?? '').trim() }
  for (const key of ['service', 'status', 'called', 'reminder_sent', 'notify_channel']) {
    if (key in body) patch[key] = body[key]
  }
  if (!String(patch.service ?? '').trim()) delete patch.service
  const error = applyPatch(booking, patch)
  if (error) return fail(400, error)

  commit((data) => {
    data.seq = booking.id
    data.bookings.push(booking)
  })
  return { ok: true, data: { ok: true, booking: toPublic(booking) } }
}

function handlePatch(code: string, body: Record<string, unknown>): ApiResult<unknown> {
  const booking = findBooking(code)
  if (!booking) return fail(404, `Заявка ${code} не найдена`)
  // Правим копию: при ошибке валидации заявка остаётся как была
  const draft: StoredBooking = { ...booking }
  const error = applyPatch(draft, body)
  if (error) return fail(400, error)
  commit(() => Object.assign(booking, draft))
  return { ok: true, data: { ok: true, booking: toPublic(booking) } }
}

function handleDelete(code: string, mode: string): ApiResult<unknown> {
  const booking = findBooking(code)
  if (!booking) return fail(404, `Заявка ${code} не найдена`)
  if (mode === 'purge') {
    commit((data) => {
      data.bookings = data.bookings.filter((b) => b.code !== booking.code)
    })
    return { ok: true, data: { ok: true, deleted: true, booking: null } }
  }
  commit(() => {
    booking.status = 'cancelled'
  })
  return { ok: true, data: { ok: true, deleted: false, booking: toPublic(booking) } }
}

/** Тот же контракт, что был у /api/crm на Flask: путь начинается со слэша после /api/crm. */
export async function localRequest(
  method: HttpMethod,
  path: string,
  body: Record<string, unknown> | undefined
): Promise<ApiResult<unknown>> {
  const [rawPath, rawQuery = ''] = path.split('?')
  const query = new URLSearchParams(rawQuery)
  const segments = rawPath.split('/').filter(Boolean)

  if (method === 'GET' && segments[0] === 'meta') {
    return {
      ok: true,
      data: {
        ok: true,
        services: [...SERVICES],
        statuses: STATUS_ORDER.map((value) => ({ value, label: STATUS_LABEL[value] })),
        settings: gridSettings(),
        channels: availableChannels()
      }
    }
  }

  if (segments[0] !== 'bookings') return fail(404, `Неизвестный путь: ${path}`)

  if (method === 'GET' && segments.length === 1) return handleList(query.get('date') ?? '')
  if (method === 'POST' && segments.length === 1) return handleCreate(body ?? {})
  if (method === 'PATCH' && segments.length === 2) return handlePatch(segments[1], body ?? {})
  if (method === 'POST' && segments.length === 3 && segments[2] === 'message') {
    return handleMessage(segments[1], body ?? {})
  }
  if (method === 'DELETE' && segments.length === 2) {
    return handleDelete(segments[1], (query.get('mode') ?? 'cancel').toLowerCase())
  }
  return fail(405, `Метод ${method} не поддерживается для ${path}`)
}

export type LinkResult =
  | { status: 'linked'; booking: Booking }
  | { status: 'not_found' }
  | { status: 'taken' }

/** Клиент открыл бота по ссылке с кодом заявки. Чужой чат не перепривязываем — код короткий. */
export function linkTelegram(code: string, chatId: number): LinkResult {
  const booking = findBooking(code)
  if (!booking) return { status: 'not_found' }
  if (booking.tg_chat_id !== null && booking.tg_chat_id !== chatId) return { status: 'taken' }
  if (booking.tg_chat_id !== chatId) {
    commit(() => {
      booking.tg_chat_id = chatId
    }, true)
  }
  return { status: 'linked', booking: toPublic(booking) }
}

export function bookingsDueForReminder(now: number, hoursBefore: number): StoredBooking[] {
  return load().bookings.filter((b) => isDueForReminder(b, now, hoursBefore)).map((b) => ({ ...b }))
}

export function findStoredBooking(code: string): StoredBooking | null {
  const booking = findBooking(code)
  return booking ? { ...booking } : null
}

/**
 * Помечаем и при ошибке: иначе напоминание уходило бы каждую минуту (как на сервере).
 * Пока шла отправка, админ мог перенести визит — тогда отметку не ставим, напомним о новом времени.
 */
export function markReminder(code: string, sentForVisit: string, channel: NotifyChannel | '', error: string): void {
  const booking = findBooking(code)
  if (!booking || booking.visit_at !== sentForVisit) return
  commit(() => {
    booking.reminder_sent = true
    booking.reminder_channel = error ? '' : channel
    booking.reminder_error = error
  }, true)
}

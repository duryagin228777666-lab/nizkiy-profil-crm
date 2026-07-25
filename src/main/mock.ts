/**
 * Локальный «сервер» для работы без Flask: демо-режим и отладка интерфейса.
 *
 * Повторяет правила server/store.py и server/crm_api.py, чтобы renderer не знал,
 * с чем разговаривает. Данные лежат в профиле пользователя, а не в bookings.json сайта.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  DEFAULT_GRID,
  SERVICES,
  STATUS_LABEL,
  STATUS_ORDER
} from '../shared/constants'
import { normalizePhone } from '../shared/phone'
import { shiftDate, todayIso, visitDate } from '../shared/time'
import type { ApiResult, Booking, BookingStatus, HttpMethod } from '../shared/types'
import { userDataFile } from './settings'

interface MockDb {
  seq: number
  bookings: Booking[]
}

const EDITABLE_TEXT = ['name', 'phone', 'service', 'comment'] as const

let db: MockDb | null = null

function nowStamp(): string {
  const iso = todayIso()
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date())
  return `${iso} ${clock}`
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

function seed(): MockDb {
  const today = todayIso()
  const tomorrow = shiftDate(today, 1)
  const taken = new Set<string>()
  const rows: Array<Partial<Booking> & { name: string; phone: string; service: string }> = [
    { name: 'Иван Соколов', phone: '79161234567', service: 'Шиномонтаж', visit_at: `${today} 10:00`, status: 'confirmed', called: true, reminder_sent: true },
    { name: 'Марина Ковалёва', phone: '79031112233', service: 'Правка дисков', visit_at: `${today} 10:00`, status: 'confirmed', called: true },
    { name: 'Пётр Абрамов', phone: '79267778899', service: 'Виброконтроль Hunter', visit_at: `${today} 10:00`, status: 'in_progress', called: true, reminder_sent: true },
    { name: 'Сергей Гринёв', phone: '79104445566', service: 'Аргонная сварка', visit_at: `${today} 11:30`, status: 'confirmed' },
    { name: 'Ольга Пименова', phone: '79852223344', service: 'Хранение шин', visit_at: `${today} 13:00`, status: 'done', called: true, reminder_sent: true },
    { name: 'Артём Лаптев', phone: '79996667788', service: 'Продажа шин', visit_at: `${today} 16:30`, status: 'confirmed', called: true },
    { name: 'Николай Дё', phone: '79055554433', service: 'Порошковая покраска', visit_at: `${tomorrow} 09:30`, status: 'confirmed' },
    { name: 'Алексей Ким', phone: '79167770011', service: 'Шиномонтаж', source: 'site' },
    { name: 'Дарья Верес', phone: '79261239876', service: 'Продажа шин', source: 'site', comment: 'Нужен подбор на Camry 2019' },
    { name: 'Роман Тищенко', phone: '79031457788', service: 'Правка дисков', source: 'bot', called: true },
    { name: 'Егор Найдёнов', phone: '79773334455', service: 'Шиномонтаж', source: 'site' }
  ]

  const bookings: Booking[] = rows.map((row, index) => {
    const code = genCode(taken)
    taken.add(code)
    return {
      id: index + 1,
      code,
      name: row.name,
      phone: row.phone,
      service: row.service,
      comment: row.comment ?? '',
      status: (row.status ?? 'new') as BookingStatus,
      source: row.source ?? 'crm',
      visit_at: row.visit_at ?? '',
      reminder_sent: row.reminder_sent ?? false,
      called: row.called ?? false,
      called_at: row.called ? nowStamp() : null,
      created_at: nowStamp()
    }
  })

  return { seq: bookings.length, bookings }
}

function dbFile(): string {
  return userDataFile('mock-bookings.json')
}

function load(): MockDb {
  if (db) return db
  const file = dbFile()
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf-8')) as MockDb
      if (Array.isArray(parsed?.bookings)) {
        db = parsed
        return db
      }
    } catch {
      // повреждённый демо-файл не повод падать — пересоздаём
    }
  }
  db = seed()
  persist()
  return db
}

function persist(): void {
  if (!db) return
  const file = dbFile()
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8')
  renameSync(tmp, file)
}

/** Сбросить демо-данные к исходным. */
export function resetMock(): void {
  db = seed()
  persist()
}

function gridSettings() {
  return { ...DEFAULT_GRID }
}

function fail(status: number, error: string): ApiResult<never> {
  return { ok: false, error, status }
}

function applyPatch(booking: Booking, fields: Record<string, unknown>): string | null {
  for (const key of EDITABLE_TEXT) {
    if (key in fields) {
      const value = String(fields[key] ?? '').trim()
      if (key === 'name' && !value) return 'Имя не может быть пустым'
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
    if (raw && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) {
      return "Время визита должно быть в формате 'ГГГГ-ММ-ДД ЧЧ:ММ'"
    }
    if (raw !== booking.visit_at) {
      booking.visit_at = raw
      booking.reminder_sent = false
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
  return null
}

function findBooking(code: string): Booking | undefined {
  return load().bookings.find((b) => b.code === code.toUpperCase())
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
      scheduled: scheduled.map((b) => ({ ...b })),
      unscheduled: unscheduled.map((b) => ({ ...b })),
      services: [...SERVICES],
      settings: gridSettings()
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
  store.seq += 1
  const visit = String(body.visit_at ?? '').trim()
  const booking: Booking = {
    id: store.seq,
    code: genCode(taken),
    name,
    phone: String(body.phone ?? '').trim(),
    service: String(body.service ?? '').trim() || SERVICES[0],
    comment: String(body.comment ?? '').trim(),
    status: visit ? 'confirmed' : 'new',
    source: 'crm',
    visit_at: visit,
    reminder_sent: false,
    called: false,
    called_at: null,
    created_at: nowStamp()
  }

  const patch: Record<string, unknown> = {}
  for (const key of ['status', 'called', 'reminder_sent']) {
    if (key in body) patch[key] = body[key]
  }
  const error = applyPatch(booking, patch)
  if (error) return fail(400, error)

  store.bookings.push(booking)
  persist()
  return { ok: true, data: { ok: true, booking: { ...booking } } }
}

function handlePatch(code: string, body: Record<string, unknown>): ApiResult<unknown> {
  const booking = findBooking(code)
  if (!booking) return fail(404, `Заявка ${code} не найдена`)
  const error = applyPatch(booking, body)
  if (error) return fail(400, error)
  persist()
  return { ok: true, data: { ok: true, booking: { ...booking } } }
}

function handleDelete(code: string, mode: string): ApiResult<unknown> {
  const store = load()
  const booking = findBooking(code)
  if (!booking) return fail(404, `Заявка ${code} не найдена`)
  if (mode === 'purge') {
    store.bookings = store.bookings.filter((b) => b.code !== booking.code)
    persist()
    return { ok: true, data: { ok: true, deleted: true, booking: null } }
  }
  booking.status = 'cancelled'
  persist()
  return { ok: true, data: { ok: true, deleted: false, booking: { ...booking } } }
}

/** Тот же контракт, что у /api/crm на Flask: путь начинается со слэша после /api/crm. */
export function mockRequest(
  method: HttpMethod,
  path: string,
  body: Record<string, unknown> | undefined
): ApiResult<unknown> {
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
        settings: gridSettings()
      }
    }
  }

  if (segments[0] !== 'bookings') return fail(404, `Неизвестный путь: ${path}`)

  if (method === 'GET' && segments.length === 1) return handleList(query.get('date') ?? '')
  if (method === 'POST' && segments.length === 1) return handleCreate(body ?? {})
  if (method === 'PATCH' && segments.length === 2) return handlePatch(segments[1], body ?? {})
  if (method === 'DELETE' && segments.length === 2) {
    return handleDelete(segments[1], (query.get('mode') ?? 'cancel').toLowerCase())
  }
  return fail(405, `Метод ${method} не поддерживается для ${path}`)
}

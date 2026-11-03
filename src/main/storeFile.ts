/**
 * Файл заявок на диске: чтение, атомарная запись, перенос со старой версии и резервные копии.
 * Без Electron — каталог передаётся параметром, поэтому модуль проверяется тестами.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import type { StoredBooking } from './rules'

export interface StoreData {
  seq: number
  bookings: StoredBooking[]
}

export const DATA_FILE = 'bookings.json'
/** Так назывался файл демо-режима до отделения CRM от сайта: в нём живые записи админа. */
export const LEGACY_FILE = 'mock-bookings.json'
const BACKUP_DIR = 'backups'
const BACKUP_KEEP = 14
const BACKUP_NAME = /^bookings-\d{4}-\d{2}-\d{2}\.json$/

/**
 * Телефоны выдуманных клиентов, которыми старый демо-режим заполнял сетку.
 * Таким записям после переноса не шлём напоминаний — номера могут принадлежать чужим людям.
 */
const DEMO_PHONES = new Set([
  '79031112233', '79031457788', '79055554433', '79104445566', '79161234567', '79167770011',
  '79261239876', '79267778899', '79773334455', '79852223344', '79996667788'
])

/** Поля, появившиеся позже: в старых файлах их нет. */
const LATE_FIELDS = {
  comment: '',
  source: 'crm',
  visit_at: '',
  reminder_sent: false,
  called: false,
  called_at: null,
  notify_channel: '',
  reminder_channel: '',
  reminder_error: '',
  tg_chat_id: null
} as const

function normalizeBooking(raw: Record<string, unknown>): StoredBooking {
  // tg_linked и tg_link вычисляются при выдаче; в старом демо-файле tg_linked был выдуманным
  const { tg_linked: _linked, tg_link: _link, ...rest } = raw
  const booking = { ...LATE_FIELDS, ...rest } as StoredBooking
  return { ...booking, tg_chat_id: typeof booking.tg_chat_id === 'number' ? booking.tg_chat_id : null }
}

/** Содержимое файла → данные; null — файл испорчен (не JSON или не тот формат). */
function parseStore(text: string): StoreData | null {
  let parsed: { seq?: unknown; bookings?: unknown }
  try {
    parsed = JSON.parse(text) as { seq?: unknown; bookings?: unknown }
  } catch {
    return null
  }
  if (!Array.isArray(parsed?.bookings)) return null
  const bookings = (parsed.bookings as Record<string, unknown>[]).map(normalizeBooking)
  const maxId = bookings.reduce((max, b) => Math.max(max, Number(b.id) || 0), 0)
  return { seq: Math.max(Number(parsed.seq) || 0, maxId), bookings }
}

/** Первый запуск новой версии: переносим записи из демо-файла (оригинал остаётся на месте). */
export function migrateLegacy(dir: string): boolean {
  const target = join(dir, DATA_FILE)
  const legacy = join(dir, LEGACY_FILE)
  if (existsSync(target) || !existsSync(legacy)) return false
  const data = parseStore(readFileSync(legacy, 'utf-8'))
  if (!data) {
    console.error(`[store] ${LEGACY_FILE} не читается — перенос пропущен, файл не тронут`)
    return false
  }
  const bookings = data.bookings.map((b) => (DEMO_PHONES.has(b.phone) ? { ...b, reminder_sent: true } : b))
  writeStore(dir, { ...data, bookings })
  return true
}

/** Самая свежая читаемая копия из backups/ — на случай испорченного основного файла. */
function latestBackup(dir: string): StoreData | null {
  const backups = join(dir, BACKUP_DIR)
  if (!existsSync(backups)) return null
  const names = readdirSync(backups).filter((name) => BACKUP_NAME.test(name)).sort().reverse()
  for (const name of names) {
    const data = parseStore(readFileSync(join(backups, name), 'utf-8'))
    if (data) return data
  }
  return null
}

/**
 * Ошибки диска (файл занят антивирусом, нет прав) пробрасываем как есть: здоровый файл
 * нельзя принимать за испорченный. Испорченный откладываем в сторону и поднимаем последнюю копию.
 */
export function readStore(dir: string): StoreData {
  migrateLegacy(dir)
  const file = join(dir, DATA_FILE)
  if (!existsSync(file)) return { seq: 0, bookings: [] }
  const data = parseStore(readFileSync(file, 'utf-8'))
  if (data) return data

  const aside = join(dir, `bookings.corrupt-${Date.now()}.json`)
  renameSync(file, aside)
  const restored = latestBackup(dir)
  console.error(
    `[store] ${DATA_FILE} испорчен, сохранён как ${aside}; ` +
      (restored ? 'восстановлена последняя копия из backups/' : 'копий нет — начинаем с пустого списка')
  )
  if (!restored) return { seq: 0, bookings: [] }
  writeStore(dir, restored)
  return restored
}

export function writeStore(dir: string, data: StoreData): void {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, DATA_FILE)
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmp, file)
}

/** Одна копия в день: backups/bookings-ГГГГ-ММ-ДД.json, хранятся последние 14. */
export function backupStore(dir: string, today: string): void {
  const file = join(dir, DATA_FILE)
  if (!existsSync(file)) return
  const backups = join(dir, BACKUP_DIR)
  mkdirSync(backups, { recursive: true })
  const target = join(backups, `bookings-${today}.json`)
  if (!existsSync(target)) copyFileSync(file, target)

  const old = readdirSync(backups)
    .filter((name) => BACKUP_NAME.test(name))
    .sort()
    .slice(0, -BACKUP_KEEP)
  for (const name of old) unlinkSync(join(backups, name))
}

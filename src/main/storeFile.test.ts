import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { backupStore, DATA_FILE, LEGACY_FILE, readStore, writeStore } from './storeFile'

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'crm-store-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** Запись из старого демо-режима: без tg_chat_id, с выдуманным tg_linked. */
const legacyBooking = {
  id: 7,
  code: 'AB3K9',
  name: 'Иван',
  phone: '79160000001',
  service: 'Шиномонтаж',
  status: 'confirmed',
  visit_at: '2026-11-03 15:00',
  created_at: '2026-11-01 10:00',
  tg_linked: true
}

describe('readStore', () => {
  test('starts empty when there is no data', () => {
    expect(readStore(dir)).toEqual({ seq: 0, bookings: [] })
  })

  test('migrates records from the old demo file and keeps the original', () => {
    writeFileSync(join(dir, LEGACY_FILE), JSON.stringify({ seq: 3, bookings: [legacyBooking] }))

    const data = readStore(dir)

    expect(existsSync(join(dir, DATA_FILE))).toBe(true)
    expect(existsSync(join(dir, LEGACY_FILE))).toBe(true)
    expect(data.seq).toBe(7)
    expect(data.bookings[0]).toMatchObject({ code: 'AB3K9', tg_chat_id: null, reminder_error: '', called: false })
    expect(data.bookings[0]).not.toHaveProperty('tg_linked')
  })

  test('does not overwrite existing data with the old demo file', () => {
    writeStore(dir, { seq: 1, bookings: [] })
    writeFileSync(join(dir, LEGACY_FILE), JSON.stringify({ seq: 3, bookings: [legacyBooking] }))

    expect(readStore(dir).bookings).toHaveLength(0)
  })

  test('migration silences reminders for old demo clients only', () => {
    const demo = { ...legacyBooking, code: 'DEMO1', phone: '79031112233' }
    writeFileSync(join(dir, LEGACY_FILE), JSON.stringify({ seq: 8, bookings: [legacyBooking, demo] }))

    const [real, fake] = readStore(dir).bookings

    expect(real.reminder_sent).toBe(false)
    expect(fake.reminder_sent).toBe(true)
  })

  test('restores the latest backup when the main file is corrupt', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mkdirSync(join(dir, 'backups'))
    writeFileSync(join(dir, 'backups', 'bookings-2026-11-02.json'), JSON.stringify({ seq: 7, bookings: [legacyBooking] }))
    writeFileSync(join(dir, 'backups', 'bookings-2026-11-03.json'), 'also broken')
    writeFileSync(join(dir, DATA_FILE), '{ broken')

    const data = readStore(dir)

    expect(data.bookings.map((b) => b.code)).toEqual(['AB3K9'])
    expect(readStore(dir).bookings).toHaveLength(1)
  })

  test('moves a corrupt file aside instead of losing it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    writeFileSync(join(dir, DATA_FILE), '{ broken')

    expect(readStore(dir)).toEqual({ seq: 0, bookings: [] })
    const aside = readdirSync(dir).find((name) => name.startsWith('bookings.corrupt-'))
    expect(aside).toBeDefined()
    expect(readFileSync(join(dir, aside as string), 'utf-8')).toBe('{ broken')
  })
})

describe('backupStore', () => {
  test('makes one copy per day and keeps the last 14', () => {
    writeStore(dir, { seq: 0, bookings: [] })
    const backups = join(dir, 'backups')
    mkdirSync(backups)
    for (let day = 1; day <= 20; day += 1) {
      writeFileSync(join(backups, `bookings-2026-10-${String(day).padStart(2, '0')}.json`), '{}')
    }

    backupStore(dir, '2026-11-03')

    const names = readdirSync(backups).sort()
    expect(names).toHaveLength(14)
    expect(names.at(-1)).toBe('bookings-2026-11-03.json')
    expect(names[0]).toBe('bookings-2026-10-08.json')
  })
})

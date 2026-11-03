import { describe, expect, test } from 'vitest'
import {
  isDueForReminder,
  parseStartCode,
  redactSecrets,
  reminderText,
  resolveChannel,
  telegramLink,
  visitTimestamp,
  whatsappChatId
} from './rules'

const BOTH = { telegram: true, whatsapp: true, sms: false }
const HOUR = 3_600_000

describe('resolveChannel', () => {
  test('explicit channel wins over card and defaults', () => {
    expect(resolveChannel({ notify_channel: 'telegram', tg_chat_id: 1 }, BOTH, 'whatsapp')).toBe('whatsapp')
  })

  test('card channel is used when nothing is requested', () => {
    expect(resolveChannel({ notify_channel: 'whatsapp', tg_chat_id: 1 }, BOTH)).toBe('whatsapp')
  })

  test('auto picks Telegram only for linked clients', () => {
    expect(resolveChannel({ notify_channel: '', tg_chat_id: 42 }, BOTH)).toBe('telegram')
    expect(resolveChannel({ notify_channel: '', tg_chat_id: null }, BOTH)).toBe('whatsapp')
  })

  test('returns null when no messenger is configured', () => {
    const none = { telegram: false, whatsapp: false, sms: false }
    expect(resolveChannel({ notify_channel: '', tg_chat_id: 42 }, none)).toBeNull()
  })
})

describe('whatsappChatId', () => {
  test.each([
    ['8 (916) 123-45-67', '79161234567@c.us'],
    ['+7 916 1234567', '79161234567@c.us'],
    ['9161234567', '79161234567@c.us']
  ])('normalizes %s', (phone, expected) => {
    expect(whatsappChatId(phone)).toBe(expected)
  })

  test('rejects non-Russian or short numbers', () => {
    expect(whatsappChatId('12345')).toBeNull()
  })
})

describe('isDueForReminder', () => {
  const visit = '2026-11-03 15:00'
  const visitMs = visitTimestamp(visit) as number
  const active = { visit_at: visit, reminder_sent: false, status: 'confirmed' as const }

  test('visit time is read as Moscow time', () => {
    expect(new Date(visitMs).toISOString()).toBe('2026-11-03T12:00:00.000Z')
  })

  test('due inside the window before the visit', () => {
    expect(isDueForReminder(active, visitMs - 5 * HOUR, 5)).toBe(true)
    expect(isDueForReminder(active, visitMs - 1, 5)).toBe(true)
  })

  test('not due too early or after the visit started', () => {
    expect(isDueForReminder(active, visitMs - 5 * HOUR - 1, 5)).toBe(false)
    expect(isDueForReminder(active, visitMs, 5)).toBe(false)
  })

  test('skips sent, closed and unscheduled bookings', () => {
    const now = visitMs - HOUR
    expect(isDueForReminder({ ...active, reminder_sent: true }, now, 5)).toBe(false)
    expect(isDueForReminder({ ...active, status: 'cancelled' }, now, 5)).toBe(false)
    expect(isDueForReminder({ ...active, status: 'done' }, now, 5)).toBe(false)
    expect(isDueForReminder({ ...active, visit_at: '' }, now, 5)).toBe(false)
  })
})

describe('parseStartCode', () => {
  test('extracts code from deep-link start', () => {
    expect(parseStartCode('/start ab3k9')).toBe('AB3K9')
    expect(parseStartCode('/start@nizkiy_bot AB3K9')).toBe('AB3K9')
  })

  test('ignores plain start and garbage payloads', () => {
    expect(parseStartCode('/start')).toBeNull()
    expect(parseStartCode('/start ../etc')).toBeNull()
    expect(parseStartCode('hello AB3K9')).toBeNull()
    expect(parseStartCode(undefined)).toBeNull()
  })
})

test('reminderText names service, visit and phone', () => {
  const text = reminderText({ service: 'Шиномонтаж', visit_at: '2026-11-03 15:00' }, 'Низкий профиль', '+79990000000')
  expect(text).toContain('«Низкий профиль»')
  expect(text).toContain('Шиномонтаж')
  expect(text).toContain('15:00')
  expect(text).toContain('+79990000000')
})

test('telegramLink is empty without a bot', () => {
  expect(telegramLink('', 'AB3K9')).toBe('')
  expect(telegramLink('crm_bot', 'AB3K9')).toBe('https://t.me/crm_bot?start=AB3K9')
})

test('redactSecrets hides tokens in error text', () => {
  expect(redactSecrets('fetch https://x/bot123:SECRET/sendMessage failed', ['123:SECRET', ''])).toBe(
    'fetch https://x/bot***/sendMessage failed'
  )
})

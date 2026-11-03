/**
 * Чистые правила без Electron и сети — их проверяют тесты.
 * Повторяют server/messaging.py и server/reminders.py, чтобы CRM вела себя как сервер.
 */
import { CODE_ALPHABET } from '../shared/constants'
import { normalizePhone } from '../shared/phone'
import { formatVisitHuman, splitVisitAt } from '../shared/time'
import type { Booking, ChannelAvailability, NotifyChannel } from '../shared/types'

/** Заявка на диске: chat_id клиента в Telegram в окно не уходит. */
export type StoredBooking = Omit<Booking, 'tg_linked' | 'tg_link'> & { tg_chat_id: number | null }

const MSK_OFFSET_HOURS = 3
const HOUR_MS = 3_600_000
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}0-9]{5,12}$`)

/** Явный канал → канал из карточки → Telegram, если клиент привязан → WhatsApp. */
export function resolveChannel(
  booking: Pick<StoredBooking, 'notify_channel' | 'tg_chat_id'>,
  available: ChannelAvailability,
  requested = ''
): NotifyChannel | null {
  const chosen = (requested || booking.notify_channel || '').trim()
  if (chosen) return chosen as NotifyChannel
  if (booking.tg_chat_id && available.telegram) return 'telegram'
  if (available.whatsapp) return 'whatsapp'
  return null
}

/** chatId для Green-API: 7XXXXXXXXXX@c.us. null — номер не российский мобильный. */
export function whatsappChatId(phone: string): string | null {
  const digits = normalizePhone(phone)
  return digits ? `${digits}@c.us` : null
}

/** 'ГГГГ-ММ-ДД ЧЧ:ММ' по Москве → момент времени (мс UTC). */
export function visitTimestamp(visitAt: string): number | null {
  const parts = splitVisitAt(visitAt)
  if (!parts) return null
  const [y, m, d] = parts.date.split('-').map(Number)
  const [h, min] = parts.time.split(':').map(Number)
  return Date.UTC(y, m - 1, d, h - MSK_OFFSET_HOURS, min)
}

/** Пора напомнить: от «за N часов» до самого визита, ещё не отправляли, заявка активна. */
export function isDueForReminder(
  booking: Pick<StoredBooking, 'visit_at' | 'reminder_sent' | 'status'>,
  now: number,
  hoursBefore: number
): boolean {
  if (booking.reminder_sent) return false
  if (booking.status === 'cancelled' || booking.status === 'done') return false
  const visit = visitTimestamp(booking.visit_at)
  if (visit === null) return false
  return visit - hoursBefore * HOUR_MS <= now && now < visit
}

export function reminderText(
  booking: Pick<StoredBooking, 'service' | 'visit_at'>,
  serviceName: string,
  servicePhone: string
): string {
  const service = booking.service.trim() || 'услугу'
  return (
    `Здравствуйте! Это шиномонтаж «${serviceName}». ` +
    `Напоминаем: вы записаны на ${service} — ${formatVisitHuman(booking.visit_at)}. ` +
    `Если нужно перенести или изменить запись — звоните: ${servicePhone}`
  )
}

/** Текст `/start AB3K9` из deep-link → код заявки или null. */
export function parseStartCode(text: unknown): string | null {
  if (typeof text !== 'string') return null
  const match = /^\/start(?:@\w+)?\s+(\S+)\s*$/.exec(text.trim())
  if (!match) return null
  const code = match[1].toUpperCase()
  return CODE_PATTERN.test(code) ? code : null
}

export function telegramLink(botUsername: string, code: string): string {
  return botUsername ? `https://t.me/${botUsername}?start=${code}` : ''
}

/** Убрать секреты из текста ошибки fetch: токены Telegram и Green-API стоят прямо в пути. */
export function redactSecrets(message: string, secrets: string[]): string {
  return secrets.filter(Boolean).reduce((text, secret) => text.split(secret).join('***'), message)
}

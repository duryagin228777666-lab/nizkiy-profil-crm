/**
 * Напоминания о визите, порт server/reminders.py: раз в минуту ищем заявки, до визита которых
 * осталось не больше reminderHours, и пишем клиенту в канал из карточки.
 * Работает, пока CRM запущена (в том числе свёрнутой в трей).
 */
import { bookingsDueForReminder, findStoredBooking, markReminder } from './localStore'
import { availableChannels, sendToClient } from './messaging'
import { isDueForReminder, reminderText, type StoredBooking } from './rules'
import { getSettings } from './settings'

const CHECK_INTERVAL_MS = 60_000
const FIRST_CHECK_MS = 5_000

let timer: NodeJS.Timeout | null = null
let busy = false

export type ReminderFailure = (booking: StoredBooking, error: string) => void

async function processDue(onFailure: ReminderFailure): Promise<void> {
  const channels = availableChannels()
  // Ни один мессенджер не настроен — не помечаем заявки «не дошло», ждём настройки
  if (!channels.telegram && !channels.whatsapp) return

  const settings = getSettings()
  for (const due of bookingsDueForReminder(Date.now(), settings.reminderHours)) {
    // Предыдущая отправка могла идти секунды — за это время заявку могли изменить
    const booking = findStoredBooking(due.code)
    if (!booking || !isDueForReminder(booking, Date.now(), settings.reminderHours)) continue
    const text = reminderText(booking, settings.serviceName, settings.servicePhone)
    const result = await sendToClient(booking, text)
    markReminder(booking.code, booking.visit_at, result.channel, result.error)
    console.log(`[reminder] ${booking.code} → ${result.channel || '—'}: ${result.ok ? 'ok' : result.error}`)
    if (!result.ok) onFailure(booking, result.error)
  }
}

async function tick(onFailure: ReminderFailure): Promise<void> {
  if (busy) return
  busy = true
  try {
    await processDue(onFailure)
  } catch (error) {
    console.error('[reminder] сбой проверки:', error)
  } finally {
    busy = false
  }
}

export function startReminders(onFailure: ReminderFailure): void {
  if (timer) return
  setTimeout(() => void tick(onFailure), FIRST_CHECK_MS)
  timer = setInterval(() => void tick(onFailure), CHECK_INTERVAL_MS)
}

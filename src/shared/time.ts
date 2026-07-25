/** Работа с датами в часовом поясе сервиса. Всё время в системе — Москва (UTC+3). */

export const TZ = 'Europe/Moscow'

const ISO_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

// en-GB: 24-часовой формат, полночь как 00:00 (в ru-RU часть сборок ICU даёт 24:00)
const CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
})

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
]

/** Сегодняшняя дата по Москве в формате ГГГГ-ММ-ДД. */
export function todayIso(): string {
  return ISO_DATE.format(new Date())
}

/** Текущее время по Москве в формате ЧЧ:ММ. */
export function nowClock(): string {
  return CLOCK.format(new Date())
}

export function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function isValidClock(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  const [h, m] = value.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

/**
 * Сдвиг даты на N дней. Считаем через UTC-полночь: календарная дата не зависит
 * от часового пояса машины, поэтому переходов на летнее время здесь не бывает.
 */
export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function weekdayShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/** '2026-07-25' → '25 июля, сб' */
export function formatDateHuman(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}, ${weekdayShort(iso)}`
}

/** '2026-07-25' → '25.07.2026' */
export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`
}

/** Подпись выбранного дня относительно сегодня: «Сегодня», «Завтра», «Вчера» или ''. */
export function relativeDayLabel(iso: string): string {
  const today = todayIso()
  if (iso === today) return 'Сегодня'
  if (iso === shiftDate(today, 1)) return 'Завтра'
  if (iso === shiftDate(today, -1)) return 'Вчера'
  return ''
}

export function clockToMinutes(clock: string): number {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + m
}

export function minutesToClock(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Разобрать 'ГГГГ-ММ-ДД ЧЧ:ММ' на дату и время. */
export function splitVisitAt(visitAt: string): { date: string; time: string } | null {
  const raw = (visitAt || '').trim()
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(raw)
  return match ? { date: match[1], time: match[2] } : null
}

export function composeVisitAt(date: string, time: string): string {
  if (!date || !time) return ''
  return `${date} ${time}`
}

export function visitDate(visitAt: string): string {
  return splitVisitAt(visitAt)?.date ?? ''
}

export function visitTime(visitAt: string): string {
  return splitVisitAt(visitAt)?.time ?? ''
}

/** Человекочитаемый визит: '25 июля, сб · 14:30'. */
export function formatVisitHuman(visitAt: string): string {
  const parts = splitVisitAt(visitAt)
  if (!parts) return 'Без времени'
  return `${formatDateHuman(parts.date)} · ${parts.time}`
}

/** Начало слота, в который попадает время: 14:37 при шаге 30 → 14:30. */
export function snapToSlot(clock: string, stepMinutes: number): string {
  const step = Math.max(1, stepMinutes)
  return minutesToClock(Math.floor(clockToMinutes(clock) / step) * step)
}

/** Список слотов рабочего дня: ['09:00', '09:30', ...] без конечной границы. */
export function buildSlots(dayStart: string, dayEnd: string, stepMinutes: number): string[] {
  const step = Math.max(5, stepMinutes)
  const from = clockToMinutes(dayStart)
  // Конец раньше начала = смена через полночь; тянем сетку до конца суток
  const to = clockToMinutes(dayEnd) > from ? clockToMinutes(dayEnd) : 1440
  const slots: string[] = []
  for (let minute = from; minute < to; minute += step) slots.push(minutesToClock(minute))
  return slots
}

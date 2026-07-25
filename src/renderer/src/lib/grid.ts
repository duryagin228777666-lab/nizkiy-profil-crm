import { buildSlots, clockToMinutes, snapToSlot, visitTime } from '../../../shared/time'
import type { Booking } from '../../../shared/types'

export interface SlotRowData {
  /** Начало слота, 'ЧЧ:ММ' */
  time: string
  bookings: Booking[]
  /** Слот вне заданного рабочего дня — заявку не потеряли, но подсветим */
  offHours: boolean
}

/**
 * Разложить заявки дня по слотам сетки.
 *
 * Слот может содержать сколько угодно клиентов — это штатная ситуация, а не
 * конфликт. Заявка со временем вне рабочего дня не выпадает из таблицы:
 * для неё добавляется отдельная строка, помеченная как «вне графика».
 */
export function groupIntoSlots(
  bookings: Booking[],
  dayStart: string,
  dayEnd: string,
  slotMinutes: number
): SlotRowData[] {
  const regular = buildSlots(dayStart, dayEnd, slotMinutes)
  const rows = new Map<string, SlotRowData>()
  for (const time of regular) rows.set(time, { time, bookings: [], offHours: false })

  for (const booking of bookings) {
    const time = visitTime(booking.visit_at)
    if (!time) continue
    const slot = snapToSlot(time, slotMinutes)
    let row = rows.get(slot)
    if (!row) {
      row = { time: slot, bookings: [], offHours: true }
      rows.set(slot, row)
    }
    row.bookings.push(booking)
  }

  const result = [...rows.values()].sort((a, b) => clockToMinutes(a.time) - clockToMinutes(b.time))
  for (const row of result) {
    row.bookings.sort((a, b) => a.visit_at.localeCompare(b.visit_at) || a.id - b.id)
  }
  return result
}

/** Слот, в который попадает текущий момент — для полосы «сейчас». */
export function currentSlot(nowTime: string, slotMinutes: number): string {
  return snapToSlot(nowTime, slotMinutes)
}

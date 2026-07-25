import { CLOSED_STATUSES } from '../../../shared/constants'
import { phoneDigits } from '../../../shared/phone'
import type { Booking } from '../../../shared/types'

export interface Filters {
  query: string
  onlyNotCalled: boolean
  onlyNoSms: boolean
  onlyActive: boolean
  service: string
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  onlyNotCalled: false,
  onlyNoSms: false,
  onlyActive: false,
  service: ''
}

export function isFilterActive(filters: Filters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.onlyNotCalled ||
    filters.onlyNoSms ||
    filters.onlyActive ||
    filters.service !== ''
  )
}

export function countActiveFilters(filters: Filters): number {
  return (
    (filters.query.trim() ? 1 : 0) +
    (filters.onlyNotCalled ? 1 : 0) +
    (filters.onlyNoSms ? 1 : 0) +
    (filters.onlyActive ? 1 : 0) +
    (filters.service ? 1 : 0)
  )
}

/** Поиск по имени, телефону и коду заявки. Цифры номера сравниваем отдельно. */
function matchesQuery(booking: Booking, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  if (booking.name.toLowerCase().includes(needle)) return true
  if (booking.code.toLowerCase().includes(needle)) return true
  if (booking.service.toLowerCase().includes(needle)) return true
  if (booking.comment.toLowerCase().includes(needle)) return true
  const digits = phoneDigits(needle)
  return digits.length >= 3 && phoneDigits(booking.phone).includes(digits)
}

export function matchesFilters(booking: Booking, filters: Filters): boolean {
  if (filters.onlyNotCalled && booking.called) return false
  if (filters.onlyNoSms && booking.reminder_sent) return false
  if (filters.onlyActive && CLOSED_STATUSES.includes(booking.status)) return false
  if (filters.service && booking.service !== filters.service) return false
  return matchesQuery(booking, filters.query)
}

export function applyFilters(bookings: Booking[], filters: Filters): Booking[] {
  return bookings.filter((booking) => matchesFilters(booking, filters))
}

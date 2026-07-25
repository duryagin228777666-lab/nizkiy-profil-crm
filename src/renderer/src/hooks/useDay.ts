import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBooking, fetchDay, patchBooking, removeBooking } from '../api'
import { DEFAULT_GRID, SERVICES } from '../../../shared/constants'
import { todayIso, visitDate } from '../../../shared/time'
import type {
  Booking,
  BookingInput,
  DayPayload,
  DeleteMode,
  PublicSettings
} from '../../../shared/types'

const EMPTY_DAY: DayPayload = {
  date: '',
  scheduled: [],
  unscheduled: [],
  services: [...SERVICES],
  settings: DEFAULT_GRID
}

function sortScheduled(items: Booking[]): Booking[] {
  return [...items].sort((a, b) => a.visit_at.localeCompare(b.visit_at) || a.id - b.id)
}

function sortUnscheduled(items: Booking[]): Booking[] {
  // Сначала те, кого ещё не обзвонили — с них начинается рабочий день
  return [...items].sort((a, b) => Number(a.called) - Number(b.called) || b.id - a.id)
}

/**
 * Положить обновлённую заявку в нужную колонку текущего дня.
 * Заявка, перенесённая на другую дату, из вида просто исчезает.
 */
function mergeBooking(day: DayPayload, booking: Booking, date: string): DayPayload {
  const scheduled = day.scheduled.filter((b) => b.code !== booking.code)
  const unscheduled = day.unscheduled.filter((b) => b.code !== booking.code)
  if (!booking.visit_at) unscheduled.push(booking)
  else if (visitDate(booking.visit_at) === date) scheduled.push(booking)
  return {
    ...day,
    scheduled: sortScheduled(scheduled),
    unscheduled: sortUnscheduled(unscheduled)
  }
}

function dropBooking(day: DayPayload, code: string): DayPayload {
  return {
    ...day,
    scheduled: day.scheduled.filter((b) => b.code !== code),
    unscheduled: day.unscheduled.filter((b) => b.code !== code)
  }
}

export interface DayState {
  date: string
  day: DayPayload
  loading: boolean
  error: string
  lastSync: Date | null
  setDate: (date: string) => void
  refresh: () => Promise<void>
  create: (input: BookingInput) => Promise<Booking | null>
  update: (code: string, input: BookingInput) => Promise<Booking | null>
  remove: (code: string, mode: DeleteMode) => Promise<boolean>
}

export function useDay(settings: PublicSettings | null, onError: (message: string) => void): DayState {
  const [date, setDate] = useState<string>(todayIso)
  const [day, setDay] = useState<DayPayload>(EMPTY_DAY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastSync, setLastSync] = useState<Date | null>(null)

  // Ответ на устаревший запрос не должен затирать более свежий день
  const requestId = useRef(0)
  const dateRef = useRef(date)
  dateRef.current = date

  const refresh = useCallback(async () => {
    if (!settings) return
    const id = requestId.current + 1
    requestId.current = id
    const target = dateRef.current
    setLoading(true)
    const result = await fetchDay(target)
    if (requestId.current !== id) return
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
    setDay({ ...result.data, date: target })
    setLastSync(new Date())
  }, [settings])

  useEffect(() => {
    void refresh()
  }, [refresh, date])

  // Заявки с сайта приходят в фоне — подтягиваем их без участия администратора
  useEffect(() => {
    const seconds = settings?.autoRefreshSec ?? 0
    if (!settings || seconds <= 0) return undefined
    const timer = window.setInterval(() => void refresh(), seconds * 1000)
    return () => window.clearInterval(timer)
  }, [settings, refresh])

  const create = useCallback(
    async (input: BookingInput): Promise<Booking | null> => {
      const result = await createBooking(input)
      if (!result.ok) {
        onError(result.error)
        return null
      }
      setDay((current) => mergeBooking(current, result.data, dateRef.current))
      return result.data
    },
    [onError]
  )

  const update = useCallback(
    async (code: string, input: BookingInput): Promise<Booking | null> => {
      const result = await patchBooking(code, input)
      if (!result.ok) {
        onError(result.error)
        return null
      }
      setDay((current) => mergeBooking(current, result.data, dateRef.current))
      return result.data
    },
    [onError]
  )

  const remove = useCallback(
    async (code: string, mode: DeleteMode): Promise<boolean> => {
      const result = await removeBooking(code, mode)
      if (!result.ok) {
        onError(result.error)
        return false
      }
      setDay((current) =>
        result.data.booking
          ? mergeBooking(current, result.data.booking, dateRef.current)
          : dropBooking(current, code)
      )
      return true
    },
    [onError]
  )

  return useMemo(
    () => ({ date, day, loading, error, lastSync, setDate, refresh, create, update, remove }),
    [date, day, loading, error, lastSync, refresh, create, update, remove]
  )
}

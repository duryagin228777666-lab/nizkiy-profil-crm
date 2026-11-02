import { DEFAULT_GRID, NO_CHANNELS, SERVICES } from '../../shared/constants'
import type {
  ApiResult,
  Booking,
  BookingInput,
  ChannelAvailability,
  DayPayload,
  DeleteMode,
  GridSettings,
  NotifyChannel
} from '../../shared/types'

function unwrap<T>(result: ApiResult<unknown>, pick: (data: Record<string, unknown>) => T): ApiResult<T> {
  if (!result.ok) return result
  const data = (result.data ?? {}) as Record<string, unknown>
  return { ok: true, data: pick(data) }
}

function asBookings(value: unknown): Booking[] {
  return Array.isArray(value) ? (value as Booking[]) : []
}

export async function fetchDay(date: string): Promise<ApiResult<DayPayload>> {
  const result = await window.crm.request('GET', `/bookings?date=${encodeURIComponent(date)}`)
  return unwrap(result, (data) => ({
    date: typeof data.date === 'string' ? data.date : date,
    scheduled: asBookings(data.scheduled),
    unscheduled: asBookings(data.unscheduled),
    services: Array.isArray(data.services) ? (data.services as string[]) : [...SERVICES],
    settings: { ...DEFAULT_GRID, ...((data.settings ?? {}) as Partial<GridSettings>) },
    channels: { ...NO_CHANNELS, ...((data.channels ?? {}) as Partial<ChannelAvailability>) }
  }))
}

/** Ручное сообщение клиенту. Без channel сервер берёт канал из карточки. */
export async function sendMessage(
  code: string,
  text: string,
  channel?: NotifyChannel
): Promise<ApiResult<{ channel: NotifyChannel }>> {
  const body: Record<string, unknown> = { text }
  if (channel) body.channel = channel
  const result = await window.crm.request('POST', `/bookings/${encodeURIComponent(code)}/message`, body)
  return unwrap(result, (data) => ({ channel: data.channel as NotifyChannel }))
}

export async function createBooking(input: BookingInput): Promise<ApiResult<Booking>> {
  const result = await window.crm.request('POST', '/bookings', input as Record<string, unknown>)
  return unwrap(result, (data) => data.booking as Booking)
}

export async function patchBooking(code: string, input: BookingInput): Promise<ApiResult<Booking>> {
  const result = await window.crm.request(
    'PATCH',
    `/bookings/${encodeURIComponent(code)}`,
    input as Record<string, unknown>
  )
  return unwrap(result, (data) => data.booking as Booking)
}

/** cancel — мягкая отмена (status=cancelled), purge — удаление из хранилища. */
export async function removeBooking(
  code: string,
  mode: DeleteMode
): Promise<ApiResult<{ deleted: boolean; booking: Booking | null }>> {
  const result = await window.crm.request('DELETE', `/bookings/${encodeURIComponent(code)}?mode=${mode}`)
  return unwrap(result, (data) => ({
    deleted: Boolean(data.deleted),
    booking: (data.booking ?? null) as Booking | null
  }))
}

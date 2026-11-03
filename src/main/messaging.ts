/**
 * Отправка клиентам: Telegram (бот CRM) и WhatsApp (Green-API). SMS — позже.
 * Порт server/messaging.py. Хосты зашиты или проверены в security.ts, токены в логи не попадают.
 */
import type { ChannelAvailability, ChannelCheck, NotifyChannel } from '../shared/types'
import { redactSecrets, resolveChannel, whatsappChatId, type StoredBooking } from './rules'
import { getSecrets, getSettings } from './settings'

const TELEGRAM_API = 'https://api.telegram.org'
const TIMEOUT_MS = 10_000

export const CHANNEL_NAMES: Record<NotifyChannel, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  sms: 'SMS'
}

export interface SendResult {
  ok: boolean
  channel: NotifyChannel | ''
  error: string
}

type TelegramResponse<T> = { ok: true; result: T } | { ok: false; error: string; code: number }

export function availableChannels(): ChannelAvailability {
  const secrets = getSecrets()
  return {
    telegram: secrets.telegramBotToken.length > 0,
    whatsapp: secrets.greenApiToken.length > 0 && getSettings().greenApiIdInstance.length > 0,
    sms: false
  }
}

function secretList(): string[] {
  const secrets = getSecrets()
  return [secrets.telegramBotToken, secrets.greenApiToken]
}

function networkError(prefix: string, error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  if (name === 'TimeoutError' || name === 'AbortError') return `${prefix}: нет ответа за ${TIMEOUT_MS / 1000} с`
  return `${prefix}: нет связи (${redactSecrets(error instanceof Error ? error.message : String(error), secretList())})`
}

/** Вызов Bot API. timeoutMs больше обычного нужен только long-poll getUpdates. */
export async function telegramCall<T>(
  method: string,
  body: Record<string, unknown> = {},
  timeoutMs = TIMEOUT_MS,
  /** Обрывает запрос при перезапуске бота, чтобы новый getUpdates не получил 409 */
  cancel?: AbortSignal
): Promise<TelegramResponse<T>> {
  const token = getSecrets().telegramBotToken
  if (!token) return { ok: false, error: 'Telegram-бот не настроен', code: 0 }
  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: cancel ? AbortSignal.any([cancel, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      redirect: 'error'
    })
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      result?: T
      description?: string
    }
    if (response.ok && payload.ok) return { ok: true, result: payload.result as T }
    return {
      ok: false,
      error: `Telegram: ${payload.description ?? `ответ ${response.status}`}`,
      code: response.status
    }
  } catch (error) {
    return { ok: false, error: networkError('Telegram', error), code: 0 }
  }
}

async function greenApiCall(method: string, body?: Record<string, unknown>): Promise<{ ok: boolean; data: unknown; error: string }> {
  const settings = getSettings()
  const token = getSecrets().greenApiToken
  if (!token || !settings.greenApiIdInstance) {
    return { ok: false, data: null, error: 'WhatsApp не настроен (Green-API)' }
  }
  // Токен стоит прямо в пути — этот URL нигде не логируем
  const url = `${settings.greenApiUrl}/waInstance${settings.greenApiIdInstance}/${method}/${token}`
  try {
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'error'
    })
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (response.ok) return { ok: true, data, error: '' }
    const detail = String(data?.message ?? data?.error ?? '')
    const reason = response.status === 466 ? detail || 'исчерпан лимит тарифа Green-API' : detail
    return { ok: false, data, error: `WhatsApp: ошибка ${response.status}${reason ? ` — ${reason}` : ''}` }
  } catch (error) {
    return { ok: false, data: null, error: networkError('WhatsApp', error) }
  }
}

async function sendTelegram(booking: StoredBooking, text: string): Promise<string> {
  if (!booking.tg_chat_id) return 'Клиент ещё не открывал бота — Telegram недоступен'
  // Без parse_mode: текст свободный, разметку не интерпретируем
  const result = await telegramCall('sendMessage', { chat_id: booking.tg_chat_id, text })
  return result.ok ? '' : result.error
}

async function sendWhatsApp(booking: StoredBooking, text: string): Promise<string> {
  const chatId = whatsappChatId(booking.phone)
  if (!chatId) return 'Некорректный номер телефона для WhatsApp'
  const result = await greenApiCall('sendMessage', { chatId, message: text })
  return result.ok ? '' : result.error
}

/** Отправить текст клиенту в канал: явный → из карточки → Telegram, если привязан → WhatsApp. */
export async function sendToClient(booking: StoredBooking, text: string, requested = ''): Promise<SendResult> {
  const available = availableChannels()
  const channel = resolveChannel(booking, available, requested)
  if (!channel) {
    return { ok: false, channel: '', error: 'Нет доступного канала: клиент не в Telegram, WhatsApp не настроен' }
  }
  if (!available[channel]) {
    return { ok: false, channel, error: `${CHANNEL_NAMES[channel] ?? channel} не подключён в настройках` }
  }
  const error = channel === 'telegram' ? await sendTelegram(booking, text) : await sendWhatsApp(booking, text)
  return { ok: !error, channel, error }
}

export async function checkTelegram(): Promise<ChannelCheck> {
  const result = await telegramCall<{ username?: string }>('getMe')
  if (!result.ok) return { ok: false, text: result.error }
  return { ok: true, text: `Бот @${result.result.username ?? '?'} на связи` }
}

export async function checkWhatsApp(): Promise<ChannelCheck> {
  const result = await greenApiCall('getStateInstance')
  if (!result.ok) return { ok: false, text: result.error }
  const state = String((result.data as { stateInstance?: unknown } | null)?.stateInstance ?? '')
  return state === 'authorized'
    ? { ok: true, text: 'WhatsApp подключён' }
    : { ok: false, text: `WhatsApp не авторизован (${state || 'нет статуса'}): отсканируйте QR в кабинете Green-API` }
}

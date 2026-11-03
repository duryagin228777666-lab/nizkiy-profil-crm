/**
 * Проверки перед сетевыми и IPC-действиями.
 * Renderer не доверенный: даже при XSS он не должен увести токены мессенджеров на чужой хост.
 */

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE'])

/** Только маршруты локального API (контракт прежнего /api/crm сайта): без .. и мусора. */
const ALLOWED_PATH =
  /^\/(meta|bookings)(\/[A-Z0-9]{5,12})?(\?(date=\d{4}-\d{2}-\d{2}|mode=(cancel|purge)))?$/i

/** Отправка сообщения клиенту: только /bookings/<код>/message, без query. */
const MESSAGE_PATH = /^\/bookings\/[A-Z0-9]{5,12}\/message$/i

const SAFE_EXTERNAL = /^(https?:|tel:|mailto:)/i

export function isAllowedMethod(method: unknown): method is 'GET' | 'POST' | 'PATCH' | 'DELETE' {
  return typeof method === 'string' && ALLOWED_METHODS.has(method)
}

/**
 * Нормализует path от renderer. Отклоняет traversal (`/../booking`), чужие query и мусор.
 * Пример допустимого: `/bookings?date=2026-07-25`, `/bookings/AB3K9?mode=cancel`
 */
export function sanitizeApiPath(path: unknown): string | null {
  if (typeof path !== 'string' || path.length === 0 || path.length > 120) return null
  if (path.includes('..') || path.includes('\\') || path.includes('@') || path.includes('//')) return null
  if (!path.startsWith('/')) return null
  // Убираем фрагменты и нормализуем повторные слэши в пути (не в query)
  const cleaned = path.replace(/#.*$/, '').replace(/\/{2,}/g, '/')
  if (!ALLOWED_PATH.test(cleaned) && !MESSAGE_PATH.test(cleaned)) return null
  return cleaned
}

/** Хосты Green-API: общий api.green-api.com и адреса инстансов вида 7103.api.greenapi.com. */
const GREEN_API_HOST = /^(\d{1,6}\.)?api\.green-?api\.com$/i

/**
 * Адрес Green-API из настроек: только https и только хосты Green-API —
 * иначе токен инстанса из пути запроса уйдёт на чужой сервер.
 */
export function sanitizeGreenApiUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  if (!GREEN_API_HOST.test(url.hostname)) return null
  return `https://${url.hostname.toLowerCase()}`
}

export function isSafeExternalUrl(url: unknown): boolean {
  if (typeof url !== 'string' || url.length === 0 || url.length > 500) return false
  if (url.includes('\\') || /\s/.test(url)) return false
  if (!SAFE_EXTERNAL.test(url)) return false
  // javascript:, data:, file: отсечены схемой; дополнительно режем вложенные схемы
  if (/^(https?:).*[\s\0]/.test(url)) return false
  if (/^(https?):/i.test(url)) {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
      if (parsed.username || parsed.password) return false
    } catch {
      return false
    }
  }
  return true
}

/** Ключи настроек, которые renderer может менять через IPC (секреты — отдельно, см. settings.ts). */
export const SETTINGS_KEYS = [
  'slotMinutes',
  'dayStart',
  'dayEnd',
  'defaultDeleteMode',
  'autoRefreshSec',
  'serviceName',
  'servicePhone',
  'reminderHours',
  'greenApiIdInstance',
  'greenApiUrl',
  'minimizeToTray',
  'launchAtLogin'
] as const

/**
 * Проверки перед сетевыми и IPC-действиями.
 * Renderer не доверенный: даже при XSS он не должен увести токен на чужой хост.
 */

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE'])

/** Только маршруты CRM API: без .. и без выхода из /api/crm. */
const ALLOWED_PATH =
  /^\/(meta|bookings)(\/[A-Z0-9]{5,12})?(\?(date=\d{4}-\d{2}-\d{2}|mode=(cancel|purge)))?$/i

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
  if (!ALLOWED_PATH.test(cleaned)) return null
  return cleaned
}

/**
 * Адрес сервера: только http(s), без credentials в URL, без странных портов/схем.
 * localhost и частные сети разрешены — сервис часто крутится на VPS или 127.0.0.1.
 */
export function sanitizeServerUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!trimmed || trimmed.length > 200) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  if (url.hash) return null
  // hostname обязателен; запрещаем IP-literal-трюки вроде пустого хоста
  if (!url.hostname) return null
  // Собираем канонический origin без path/query — path дописывает apiRequest
  const port = url.port ? `:${url.port}` : ''
  return `${url.protocol}//${url.hostname}${port}`
}

/** Итоговый URL запроса обязан остаться под /api/crm на том же origin. */
export function buildCrmUrl(baseUrl: string, path: string): string | null {
  const base = sanitizeServerUrl(baseUrl)
  const safePath = sanitizeApiPath(path)
  if (!base || !safePath) return null
  let url: URL
  try {
    url = new URL(`${base}/api/crm${safePath}`)
  } catch {
    return null
  }
  if (!url.pathname.startsWith('/api/crm')) return null
  if (url.pathname.includes('..')) return null
  return url.toString()
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

/** Ключи настроек, которые renderer может менять через IPC. */
export const SETTINGS_KEYS = [
  'mode',
  'serverUrl',
  'token',
  'slotMinutes',
  'dayStart',
  'dayEnd',
  'defaultDeleteMode',
  'autoRefreshSec'
] as const

/**
 * Единая точка выхода в сеть. Renderer сюда не ходит напрямую: запросы идут из
 * main-процесса. Path и serverUrl жёстко проверяются — иначе возможен SSRF
 * и увод Bearer-токена на чужой хост.
 */
import { mockRequest } from './mock'
import { buildCrmUrl, isAllowedMethod, sanitizeApiPath } from './security'
import { getSettings } from './settings'
import type { ApiResult, HttpMethod } from '../shared/types'

const TIMEOUT_MS = 12000

function describeNetworkError(error: unknown, baseUrl: string): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/abort|timeout/i.test(message)) {
    return `Сервер ${baseUrl} не ответил за ${TIMEOUT_MS / 1000} с. Проверьте, запущен ли app.py.`
  }
  if (/ECONNREFUSED|fetch failed|ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return `Нет связи с ${baseUrl}. Проверьте адрес сервера в настройках и что сервис запущен.`
  }
  return `Ошибка соединения: ${message}`
}

export async function apiRequest(
  method: HttpMethod,
  path: string,
  body?: Record<string, unknown>
): Promise<ApiResult<unknown>> {
  if (!isAllowedMethod(method)) {
    return { ok: false, error: 'Недопустимый метод запроса', status: 400 }
  }
  const safePath = sanitizeApiPath(path)
  if (!safePath) {
    return { ok: false, error: 'Недопустимый путь API', status: 400 }
  }

  const settings = getSettings()

  if (settings.mode === 'mock') {
    await new Promise((resolve) => setTimeout(resolve, 60))
    return mockRequest(method, safePath, body)
  }

  const url = buildCrmUrl(settings.serverUrl, safePath)
  if (!url) {
    return {
      ok: false,
      error: 'Некорректный адрес сервера. Разрешены только http(s) без логина в URL.',
      status: 0
    }
  }
  if (!settings.token) {
    return { ok: false, error: 'Не задан токен владельца. Откройте настройки.', status: 0 }
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${settings.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Без авто-редиректов: иначе attacker.com → 127.0.0.1 уводит токен во внутреннюю сеть
      redirect: 'error'
    })
  } catch (error) {
    return { ok: false, error: describeNetworkError(error, settings.serverUrl), status: 0 }
  }

  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const fromServer =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : ''
    const fallback =
      response.status === 401
        ? 'Сервер отклонил токен владельца. Проверьте CRM_TOKEN.'
        : response.status === 503
          ? 'CRM на сервере выключена: CRM_TOKEN не задан в .env.'
          : `Сервер вернул ${response.status}`
    return { ok: false, error: fromServer || fallback, status: response.status }
  }

  return { ok: true, data: payload }
}

/** Быстрая проверка настроек из окна настроек. */
export async function pingServer(): Promise<ApiResult<unknown>> {
  return apiRequest('GET', '/meta')
}

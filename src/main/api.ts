/**
 * Единая точка входа запросов из окна. Renderer не трогает файлы и сеть напрямую:
 * path проверяется whitelist-ом, дальше работает локальное хранилище.
 */
import { localRequest } from './localStore'
import { isAllowedMethod, sanitizeApiPath } from './security'
import type { ApiResult, HttpMethod } from '../shared/types'

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
  try {
    return await localRequest(method, safePath, body)
  } catch (error) {
    console.error('[api] сбой обработки запроса:', error)
    return { ok: false, error: 'Не удалось сохранить данные на диск. Проверьте место и права.', status: 500 }
  }
}

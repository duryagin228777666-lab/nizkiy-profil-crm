import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_SETTINGS } from '../shared/constants'
import type { AppSettings, PublicSettings } from '../shared/types'
import { SETTINGS_KEYS, sanitizeServerUrl } from './security'

let cache: AppSettings | null = null

const TOKEN_PLACEHOLDER = ''

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** Полные настройки только для main-процесса (с токеном). */
export function getSettings(): AppSettings {
  if (cache) return cache
  const file = settingsFile()
  let stored: Partial<AppSettings> = {}
  if (existsSync(file)) {
    try {
      stored = JSON.parse(readFileSync(file, 'utf-8')) as Partial<AppSettings>
    } catch {
      stored = {}
    }
  }
  cache = { ...DEFAULT_SETTINGS, ...pickAllowed(stored) }
  cache.serverUrl = sanitizeServerUrl(cache.serverUrl) ?? DEFAULT_SETTINGS.serverUrl
  cache.token = typeof cache.token === 'string' ? cache.token.trim() : ''
  return cache
}

/**
 * То, что можно отдать в renderer: токен не уходит в окно.
 * Даже при XSS в интерфейсе украсть CRM_TOKEN из getSettings нельзя.
 */
export function getPublicSettings(): PublicSettings {
  const full = getSettings()
  return {
    mode: full.mode,
    serverUrl: full.serverUrl,
    tokenConfigured: full.token.length > 0,
    slotMinutes: full.slotMinutes,
    dayStart: full.dayStart,
    dayEnd: full.dayEnd,
    defaultDeleteMode: full.defaultDeleteMode,
    autoRefreshSec: full.autoRefreshSec
  }
}

function pickAllowed(patch: Record<string, unknown>): Partial<AppSettings> {
  const out: Partial<AppSettings> = {}
  for (const key of SETTINGS_KEYS) {
    if (key in patch) (out as Record<string, unknown>)[key] = patch[key]
  }
  return out
}

export function saveSettings(patch: Partial<AppSettings> & Record<string, unknown>): PublicSettings {
  const current = getSettings()
  const clean = pickAllowed(patch)
  const next: AppSettings = { ...current, ...clean }

  if (typeof clean.serverUrl === 'string') {
    const safe = sanitizeServerUrl(clean.serverUrl)
    if (!safe) throw new Error('Некорректный адрес сервера (только http/https, без логина в URL)')
    next.serverUrl = safe
  }

  // Пустой token в patch = «не менять», чтобы UI мог не знать реальный токен
  if (!('token' in clean) || clean.token === undefined || String(clean.token).trim() === '') {
    next.token = current.token
  } else {
    next.token = String(clean.token).trim()
    if (next.token.length > 200) throw new Error('Токен слишком длинный')
  }

  if (clean.mode === 'mock' || clean.mode === 'server') next.mode = clean.mode
  if (clean.defaultDeleteMode === 'cancel' || clean.defaultDeleteMode === 'purge') {
    next.defaultDeleteMode = clean.defaultDeleteMode
  }

  if (typeof next.autoRefreshSec === 'number') {
    if (!Number.isFinite(next.autoRefreshSec) || next.autoRefreshSec < 0) next.autoRefreshSec = 0
    else if (next.autoRefreshSec > 0) next.autoRefreshSec = Math.min(3600, Math.max(10, Math.floor(next.autoRefreshSec)))
  }

  if (next.slotMinutes !== null && next.slotMinutes !== undefined) {
    const allowed = [15, 20, 30, 60]
    next.slotMinutes = allowed.includes(Number(next.slotMinutes)) ? Number(next.slotMinutes) : current.slotMinutes
  }

  cache = next

  const file = settingsFile()
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8')
  renameSync(tmp, file)

  // Намеренно не возвращаем TOKEN_PLACEHOLDER в ответе как значение токена
  void TOKEN_PLACEHOLDER
  return getPublicSettings()
}

export function userDataFile(name: string): string {
  // Имя файла только basename — без ../ из renderer (на случай будущего IPC)
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '')
  if (!safe) throw new Error('Bad file name')
  const file = join(app.getPath('userData'), safe)
  mkdirSync(dirname(file), { recursive: true })
  return file
}

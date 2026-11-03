import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_SETTINGS } from '../shared/constants'
import { isValidClock } from '../shared/time'
import type { AppSettings, PublicSettings, Secrets, SettingsPatch } from '../shared/types'
import { SETTINGS_KEYS, sanitizeGreenApiUrl } from './security'

const SLOT_STEPS = [15, 20, 30, 60]
const MAX_REMINDER_HOURS = 48
const TELEGRAM_TOKEN = /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/
const GREEN_API_TOKEN = /^[A-Za-z0-9]{20,100}$/

let cache: AppSettings | null = null
let secretsCache: Secrets | null = null
const listeners: Array<() => void> = []

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function secretsFile(): string {
  return join(app.getPath('userData'), 'secrets.json')
}

function writeAtomic(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, content, 'utf-8')
  renameSync(tmp, file)
}

function readJson(file: string): Record<string, unknown> {
  if (!existsSync(file)) return {}
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8')) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function pickAllowed(patch: Record<string, unknown>): Partial<AppSettings> {
  const out: Partial<AppSettings> = {}
  for (const key of SETTINGS_KEYS) {
    if (key in patch) (out as Record<string, unknown>)[key] = patch[key]
  }
  return out
}

function text(value: unknown, max: number, fallback: string): string {
  const trimmed = typeof value === 'string' ? value.trim().slice(0, max) : ''
  return trimmed || fallback
}

/** Привести сохранённое или присланное к допустимым значениям. Бросает только на явно плохом вводе. */
function normalize(current: AppSettings, patch: Partial<AppSettings>): AppSettings {
  const next: AppSettings = { ...current, ...patch }

  next.slotMinutes = SLOT_STEPS.includes(Number(next.slotMinutes)) ? Number(next.slotMinutes) : null
  next.dayStart = typeof next.dayStart === 'string' && isValidClock(next.dayStart) ? next.dayStart : null
  next.dayEnd = typeof next.dayEnd === 'string' && isValidClock(next.dayEnd) ? next.dayEnd : null
  if (next.defaultDeleteMode !== 'cancel' && next.defaultDeleteMode !== 'purge') {
    next.defaultDeleteMode = DEFAULT_SETTINGS.defaultDeleteMode
  }

  const refresh = Number(next.autoRefreshSec)
  next.autoRefreshSec = !Number.isFinite(refresh) || refresh <= 0 ? 0 : Math.min(3600, Math.max(10, Math.floor(refresh)))

  const hours = Math.floor(Number(next.reminderHours))
  next.reminderHours = hours >= 1 && hours <= MAX_REMINDER_HOURS ? hours : DEFAULT_SETTINGS.reminderHours

  next.serviceName = text(next.serviceName, 60, DEFAULT_SETTINGS.serviceName)
  next.servicePhone = text(next.servicePhone, 30, DEFAULT_SETTINGS.servicePhone)

  const instance = typeof next.greenApiIdInstance === 'string' ? next.greenApiIdInstance.trim() : ''
  if (instance && !/^\d{5,20}$/.test(instance)) throw new Error('idInstance Green-API — только цифры')
  next.greenApiIdInstance = instance

  const url = sanitizeGreenApiUrl(next.greenApiUrl)
  if (!url) throw new Error('Адрес Green-API: только https://…api.green-api.com или https://…api.greenapi.com')
  next.greenApiUrl = url

  next.minimizeToTray = next.minimizeToTray !== false
  next.launchAtLogin = next.launchAtLogin === true
  return next
}

export function getSettings(): AppSettings {
  if (cache) return cache
  try {
    cache = normalize(DEFAULT_SETTINGS, pickAllowed(readJson(settingsFile())))
  } catch {
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache
}

/** Секреты на диске шифруются DPAPI Windows (safeStorage) — файл с другого компьютера бесполезен. */
export function getSecrets(): Secrets {
  if (secretsCache) return secretsCache
  const empty: Secrets = { telegramBotToken: '', greenApiToken: '' }
  const stored = readJson(secretsFile())
  try {
    const raw =
      stored.encrypted === true && typeof stored.data === 'string'
        ? safeStorage.decryptString(Buffer.from(stored.data, 'base64'))
        : typeof stored.data === 'string'
          ? stored.data
          : '{}'
    const parsed = JSON.parse(raw) as Partial<Secrets>
    secretsCache = {
      telegramBotToken: typeof parsed.telegramBotToken === 'string' ? parsed.telegramBotToken : '',
      greenApiToken: typeof parsed.greenApiToken === 'string' ? parsed.greenApiToken : ''
    }
  } catch (error) {
    // Не кэшируем: следующая попытка может расшифровать (например, после входа в профиль Windows)
    console.error('[settings] не удалось прочитать secrets.json:', error)
    return empty
  }
  return secretsCache
}

function saveSecrets(next: Secrets): void {
  const json = JSON.stringify(next)
  const encrypted = safeStorage.isEncryptionAvailable()
  const data = encrypted ? safeStorage.encryptString(json).toString('base64') : json
  writeAtomic(secretsFile(), JSON.stringify({ encrypted, data }))
  secretsCache = next
}

function mergeSecret(current: string, incoming: unknown, pattern: RegExp, label: string): string {
  // Пустое значение = «не менять»: окно не знает сохранённый секрет
  const value = typeof incoming === 'string' ? incoming.trim() : ''
  if (!value) return current
  if (!pattern.test(value)) throw new Error(`${label} выглядит неправильно — скопируйте его целиком`)
  return value
}

/** То, что можно отдать в renderer: секреты не уходят в окно даже при XSS в интерфейсе. */
export function getPublicSettings(): PublicSettings {
  const secrets = getSecrets()
  const settings = getSettings()
  return {
    ...settings,
    telegramConfigured: secrets.telegramBotToken.length > 0,
    whatsappConfigured: secrets.greenApiToken.length > 0 && settings.greenApiIdInstance.length > 0
  }
}

export function saveSettings(patch: SettingsPatch): PublicSettings {
  const next = normalize(getSettings(), pickAllowed(patch as Record<string, unknown>))
  const secrets = getSecrets()
  const nextSecrets: Secrets = {
    telegramBotToken: mergeSecret(secrets.telegramBotToken, patch.telegramBotToken, TELEGRAM_TOKEN, 'Токен бота'),
    greenApiToken: mergeSecret(secrets.greenApiToken, patch.greenApiToken, GREEN_API_TOKEN, 'apiTokenInstance')
  }

  writeAtomic(settingsFile(), JSON.stringify(next, null, 2))
  cache = next
  if (nextSecrets.telegramBotToken !== secrets.telegramBotToken || nextSecrets.greenApiToken !== secrets.greenApiToken) {
    saveSecrets(nextSecrets)
  }
  for (const listener of listeners) listener()
  return getPublicSettings()
}

/** Подписка на сохранение настроек: перезапуск бота, автозапуск Windows. */
export function onSettingsChanged(listener: () => void): void {
  listeners.push(listener)
}

export function userDataDir(): string {
  return app.getPath('userData')
}

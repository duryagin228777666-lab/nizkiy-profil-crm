export type BookingStatus = 'new' | 'confirmed' | 'in_progress' | 'done' | 'cancelled'

/** Заявка. Формат один в один с server/store.py — CRM не заводит своих полей. */
export interface Booking {
  id: number
  code: string
  name: string
  phone: string
  service: string
  comment: string
  status: BookingStatus
  source: string
  /** 'ГГГГ-ММ-ДД ЧЧ:ММ' по Москве либо пустая строка = «без времени» */
  visit_at: string
  reminder_sent: boolean
  called: boolean
  called_at: string | null
  created_at: string
}

/** Параметры сетки дня. Сервер отдаёт их в /api/crm/meta, локально можно переопределить. */
export interface GridSettings {
  slot_minutes: number
  day_start: string
  day_end: string
  reminder_hours: number
  timezone: string
}

export interface DayPayload {
  date: string
  scheduled: Booking[]
  unscheduled: Booking[]
  services: string[]
  settings: GridSettings
}

/** Поля, которые CRM отправляет на сервер при создании/редактировании. */
export interface BookingInput {
  name?: string
  phone?: string
  service?: string
  comment?: string
  visit_at?: string
  status?: BookingStatus
  called?: boolean
  reminder_sent?: boolean
}

export type DeleteMode = 'cancel' | 'purge'
export type ConnectionMode = 'server' | 'mock'

export interface AppSettings {
  /** mock — работа без сервера на демо-данных, server — реальный Flask */
  mode: ConnectionMode
  serverUrl: string
  token: string
  /** Пусто = взять из настроек сервера */
  slotMinutes: number | null
  dayStart: string | null
  dayEnd: string | null
  defaultDeleteMode: DeleteMode
  autoRefreshSec: number
}

/**
 * Настройки для окна: без секрета. tokenConfigured = токен уже сохранён в профиле.
 * Новый токен передаётся только при saveSettings, если пользователь его ввёл.
 */
export interface PublicSettings {
  mode: ConnectionMode
  serverUrl: string
  tokenConfigured: boolean
  slotMinutes: number | null
  dayStart: string | null
  dayEnd: string | null
  defaultDeleteMode: DeleteMode
  autoRefreshSec: number
}

/** Поля, которые renderer может прислать в saveSettings. token опционален. */
export type SettingsPatch = Partial<Omit<AppSettings, 'token'>> & { token?: string }

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

/** Экран приложения: расписание дня или необработанные заявки. */
export type AppPage = 'day' | 'inbox'

/** Команды из нативного меню приложения в интерфейс. */
export type MenuCommand =
  | 'new-booking'
  | 'refresh'
  | 'settings'
  | 'today'
  | 'prev-day'
  | 'next-day'
  | 'focus-search'
  | 'page-day'
  | 'page-inbox'

export type BookingStatus = 'new' | 'confirmed' | 'in_progress' | 'done' | 'cancelled'

/** Канал связи с клиентом. Пустая строка в заявке = выбрать автоматически. */
export type NotifyChannel = 'telegram' | 'whatsapp' | 'sms'

/** Какие каналы включены на сервере (/api/crm/meta). */
export type ChannelAvailability = Record<NotifyChannel, boolean>

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
  /** Канал из карточки; '' = Telegram, если клиент привязан, иначе WhatsApp */
  notify_channel: NotifyChannel | ''
  /** Клиент открывал бота — ему можно писать в Telegram */
  tg_linked: boolean
  /** Ссылка t.me/<бот>?start=<код>; '' — Telegram-бот не настроен */
  tg_link: string
  /** Куда ушло напоминание ('' — не отправлялось или не дошло) */
  reminder_channel: NotifyChannel | ''
  reminder_error: string
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
  channels: ChannelAvailability
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
  notify_channel?: NotifyChannel | ''
}

export type DeleteMode = 'cancel' | 'purge'

/** Секреты мессенджеров: живут только в main-процессе, на диске — через safeStorage. */
export interface Secrets {
  telegramBotToken: string
  greenApiToken: string
}

export interface AppSettings {
  /** Пусто = значение по умолчанию из DEFAULT_GRID */
  slotMinutes: number | null
  dayStart: string | null
  dayEnd: string | null
  defaultDeleteMode: DeleteMode
  autoRefreshSec: number
  /** Подпись в напоминании: «Это шиномонтаж «…»» */
  serviceName: string
  /** Телефон для переноса записи в тексте напоминания */
  servicePhone: string
  reminderHours: number
  greenApiIdInstance: string
  /** Адрес инстанса из личного кабинета Green-API (https://NNNN.api.greenapi.com) */
  greenApiUrl: string
  /** Крестик прячет окно в трей, чтобы напоминания продолжали уходить */
  minimizeToTray: boolean
  launchAtLogin: boolean
}

/**
 * Настройки для окна: без секретов. *Configured = секрет уже сохранён в профиле.
 * Новый секрет передаётся только при saveSettings, если пользователь его ввёл.
 */
export interface PublicSettings extends AppSettings {
  telegramConfigured: boolean
  whatsappConfigured: boolean
}

/** Поля, которые renderer может прислать в saveSettings. Пустой секрет = не менять. */
export type SettingsPatch = Partial<AppSettings> & Partial<Secrets>

/** Результат кнопок «Проверить Telegram / WhatsApp» в настройках. */
export interface ChannelCheck {
  ok: boolean
  text: string
}

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

import type { AppSettings, BookingStatus, GridSettings } from './types'

/** Список услуг совпадает со store.SERVICES на сервере. */
export const SERVICES = [
  'Шиномонтаж',
  'Продажа шин',
  'Виброконтроль Hunter',
  'Правка дисков',
  'Аргонная сварка',
  'Порошковая покраска',
  'Хранение шин'
] as const

/** Короткие подписи для тесной карточки в ячейке. */
export const SERVICE_SHORT: Record<string, string> = {
  Шиномонтаж: 'Шиномонтаж',
  'Продажа шин': 'Шины',
  'Виброконтроль Hunter': 'Hunter',
  'Правка дисков': 'Правка',
  'Аргонная сварка': 'Аргон',
  'Порошковая покраска': 'Покраска',
  'Хранение шин': 'Хранение'
}

export const STATUS_ORDER: BookingStatus[] = ['new', 'confirmed', 'in_progress', 'done', 'cancelled']

export const STATUS_LABEL: Record<BookingStatus, string> = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  in_progress: 'В работе',
  done: 'Готово',
  cancelled: 'Отменена'
}

/** Заявки, по которым работа закончена: скрываются фильтром «только активные». */
export const CLOSED_STATUSES: BookingStatus[] = ['done', 'cancelled']

/** Алфавит кода заявки без похожих символов (0/O, 1/I) — как в store._CODE_ALPHABET. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 5

export const DEFAULT_GRID: GridSettings = {
  slot_minutes: 30,
  day_start: '09:00',
  day_end: '21:00',
  reminder_hours: 5,
  timezone: 'Europe/Moscow'
}

export const DEFAULT_SETTINGS: AppSettings = {
  mode: 'mock',
  serverUrl: 'http://127.0.0.1:5000',
  token: '',
  slotMinutes: null,
  dayStart: null,
  dayEnd: null,
  defaultDeleteMode: 'cancel',
  autoRefreshSec: 60
}

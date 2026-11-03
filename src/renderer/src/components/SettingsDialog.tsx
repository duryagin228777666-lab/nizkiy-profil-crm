import { useState } from 'react'
import { DEFAULT_GRID } from '../../../shared/constants'
import type { ChannelCheck, DeleteMode, PublicSettings, SettingsPatch } from '../../../shared/types'
import { IconClose } from './Icons'

interface Props {
  settings: PublicSettings
  onSave: (patch: SettingsPatch) => Promise<void>
  onClose: () => void
}

type FormState = Omit<PublicSettings, 'telegramConfigured' | 'whatsappConfigured'> & {
  /** Пусто = не менять сохранённый секрет */
  telegramBotToken: string
  greenApiToken: string
}

function toForm(settings: PublicSettings): FormState {
  const { telegramConfigured: _tg, whatsappConfigured: _wa, ...rest } = settings
  return { ...rest, telegramBotToken: '', greenApiToken: '' }
}

function secretPlaceholder(configured: boolean, empty: string): string {
  return configured ? '••••••••  (сохранён, введите новый чтобы заменить)' : empty
}

function errorText(error: unknown): string {
  // Ошибка из main приходит как «Error invoking remote method …: Error: <текст>»
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^.*Error: /, '') || 'Не удалось сохранить настройки'
}

export function SettingsDialog({ settings, onSave, onClose }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(settings))
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<ChannelCheck | null>(null)

  const set = (part: Partial<FormState>): void => {
    setForm((current) => ({ ...current, ...part }))
    setCheckResult(null)
  }

  function buildPatch(): SettingsPatch {
    const { telegramBotToken, greenApiToken, ...rest } = form
    const patch: SettingsPatch = { ...rest }
    // Секреты уходят в main только если пользователь что-то ввёл
    if (telegramBotToken.trim()) patch.telegramBotToken = telegramBotToken.trim()
    if (greenApiToken.trim()) patch.greenApiToken = greenApiToken.trim()
    return patch
  }

  async function check(channel: 'telegram' | 'whatsapp'): Promise<void> {
    setChecking(true)
    try {
      await window.crm.saveSettings(buildPatch())
      setCheckResult(await window.crm.checkChannel(channel))
    } catch (error) {
      setCheckResult({ ok: false, text: errorText(error) })
    }
    setChecking(false)
  }

  async function save(): Promise<void> {
    try {
      await onSave(buildPatch())
    } catch (error) {
      setCheckResult({ ok: false, text: errorText(error) })
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal modal-narrow" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Настройки</h2>
          <button type="button" className="icon-btn" onClick={onClose} title="Закрыть (Esc)">
            <IconClose />
          </button>
        </header>

        <div className="modal-body form">
          <h3 className="field-wide form-section">Telegram</h3>
          <label className="field field-wide">
            <span>Токен бота CRM (от @BotFather; отдельный бот, не бот сайта)</span>
            <input
              type="password"
              value={form.telegramBotToken}
              autoComplete="off"
              placeholder={secretPlaceholder(settings.telegramConfigured, '123456789:AA…')}
              onChange={(e) => set({ telegramBotToken: e.target.value })}
            />
          </label>

          <h3 className="field-wide form-section">WhatsApp (Green-API)</h3>
          <label className="field">
            <span>idInstance</span>
            <input
              value={form.greenApiIdInstance}
              inputMode="numeric"
              placeholder="1101234567"
              onChange={(e) => set({ greenApiIdInstance: e.target.value })}
            />
          </label>
          <label className="field">
            <span>apiTokenInstance</span>
            <input
              type="password"
              value={form.greenApiToken}
              autoComplete="off"
              placeholder={secretPlaceholder(settings.whatsappConfigured, 'из личного кабинета')}
              onChange={(e) => set({ greenApiToken: e.target.value })}
            />
          </label>
          <label className="field field-wide">
            <span>apiUrl инстанса</span>
            <input
              value={form.greenApiUrl}
              placeholder="https://api.green-api.com"
              onChange={(e) => set({ greenApiUrl: e.target.value })}
            />
          </label>

          <h3 className="field-wide form-section">Напоминания</h3>
          <label className="field">
            <span>Название в тексте</span>
            <input value={form.serviceName} onChange={(e) => set({ serviceName: e.target.value })} />
          </label>
          <label className="field">
            <span>Телефон для переноса</span>
            <input value={form.servicePhone} onChange={(e) => set({ servicePhone: e.target.value })} />
          </label>
          <label className="field">
            <span>За сколько часов до визита</span>
            <input
              type="number"
              min={1}
              max={48}
              value={form.reminderHours}
              onChange={(e) => {
                const hours = Number(e.target.value)
                if (hours > 0) set({ reminderHours: hours })
              }}
            />
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={form.minimizeToTray}
              onChange={(e) => set({ minimizeToTray: e.target.checked })}
            />
            <span>Крестик сворачивает в трей</span>
          </label>
          <label className="switch field-wide">
            <input
              type="checkbox"
              checked={form.launchAtLogin}
              onChange={(e) => set({ launchAtLogin: e.target.checked })}
            />
            <span>Запускать вместе с Windows (сразу в трей)</span>
          </label>

          <h3 className="field-wide form-section">Расписание</h3>
          <label className="field">
            <span>Начало дня</span>
            <input
              type="time"
              value={form.dayStart ?? DEFAULT_GRID.day_start}
              onChange={(e) => set({ dayStart: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Конец дня</span>
            <input
              type="time"
              value={form.dayEnd ?? DEFAULT_GRID.day_end}
              onChange={(e) => set({ dayEnd: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Шаг слота, минут</span>
            <select
              value={String(form.slotMinutes ?? DEFAULT_GRID.slot_minutes)}
              onChange={(e) => set({ slotMinutes: Number(e.target.value) })}
            >
              {[15, 20, 30, 60].map((step) => (
                <option key={step} value={step}>
                  {step}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Автообновление, секунд</span>
            <input
              type="number"
              min={0}
              step={10}
              value={form.autoRefreshSec}
              onChange={(e) => set({ autoRefreshSec: Number(e.target.value) })}
            />
          </label>

          <label className="field field-wide">
            <span>Кнопка «Удалить» по умолчанию</span>
            <select
              value={form.defaultDeleteMode}
              onChange={(e) => set({ defaultDeleteMode: e.target.value as DeleteMode })}
            >
              <option value="cancel">Отменить заявку (остаётся в списке со статусом «Отменена»)</option>
              <option value="purge">Удалить навсегда</option>
            </select>
          </label>

          {checkResult ? (
            <p className={`field-wide check ${checkResult.ok ? 'is-ok' : 'is-bad'}`}>{checkResult.text}</p>
          ) : (
            <p className="field-wide hint">
              Заявки и токены хранятся только на этом компьютере, токены зашифрованы и в окне не показываются.
              Часовой пояс — Москва.
            </p>
          )}
        </div>

        <footer className="modal-foot">
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={() => void check('telegram')} disabled={checking}>
              Проверить Telegram
            </button>
            <button type="button" className="ghost-btn" onClick={() => void check('whatsapp')} disabled={checking}>
              Проверить WhatsApp
            </button>
          </div>
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="primary-btn" onClick={() => void save()}>
              Сохранить
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

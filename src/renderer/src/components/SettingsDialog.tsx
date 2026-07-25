import { useState } from 'react'
import { DEFAULT_GRID } from '../../../shared/constants'
import type { ConnectionMode, DeleteMode, PublicSettings, SettingsPatch } from '../../../shared/types'
import { IconClose } from './Icons'

interface Props {
  settings: PublicSettings
  onSave: (patch: SettingsPatch) => Promise<void>
  onClose: () => void
}

interface FormState {
  mode: ConnectionMode
  serverUrl: string
  /** Пусто = не менять сохранённый токен */
  token: string
  tokenTouched: boolean
  slotMinutes: number | null
  dayStart: string | null
  dayEnd: string | null
  defaultDeleteMode: DeleteMode
  autoRefreshSec: number
}

function toForm(settings: PublicSettings): FormState {
  return {
    mode: settings.mode,
    serverUrl: settings.serverUrl,
    token: '',
    tokenTouched: false,
    slotMinutes: settings.slotMinutes,
    dayStart: settings.dayStart,
    dayEnd: settings.dayEnd,
    defaultDeleteMode: settings.defaultDeleteMode,
    autoRefreshSec: settings.autoRefreshSec
  }
}

export function SettingsDialog({ settings, onSave, onClose }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(settings))
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ ok: boolean; text: string } | null>(null)

  const set = (part: Partial<FormState>): void => {
    setForm((current) => ({ ...current, ...part }))
    setCheckResult(null)
  }

  function buildPatch(): SettingsPatch {
    const patch: SettingsPatch = {
      mode: form.mode,
      serverUrl: form.serverUrl,
      slotMinutes: form.slotMinutes,
      dayStart: form.dayStart,
      dayEnd: form.dayEnd,
      defaultDeleteMode: form.defaultDeleteMode,
      autoRefreshSec: form.autoRefreshSec
    }
    // Токен уходит в main только если пользователь что-то ввёл
    if (form.tokenTouched && form.token.trim()) patch.token = form.token.trim()
    return patch
  }

  async function testConnection(): Promise<void> {
    setChecking(true)
    try {
      await window.crm.saveSettings(buildPatch())
      const result = await window.crm.ping()
      setCheckResult(
        result.ok
          ? {
              ok: true,
              text: form.mode === 'mock' ? 'Демо-режим работает.' : 'Сервер отвечает, токен принят.'
            }
          : { ok: false, text: result.error }
      )
    } catch (error) {
      setCheckResult({
        ok: false,
        text: error instanceof Error ? error.message : 'Не удалось сохранить настройки'
      })
    }
    setChecking(false)
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
          <label className="field field-wide">
            <span>Источник данных</span>
            <select value={form.mode} onChange={(e) => set({ mode: e.target.value as ConnectionMode })}>
              <option value="mock">Демо-режим (без сервера, данные на этом компьютере)</option>
              <option value="server">Сервер сервиса (Flask /api/crm)</option>
            </select>
          </label>

          <label className="field field-wide">
            <span>Адрес сервера</span>
            <input
              value={form.serverUrl}
              placeholder="http://127.0.0.1:5000"
              disabled={form.mode === 'mock'}
              onChange={(e) => set({ serverUrl: e.target.value })}
            />
          </label>

          <label className="field field-wide">
            <span>Токен владельца (CRM_TOKEN из .env сервера)</span>
            <input
              type="password"
              value={form.token}
              autoComplete="off"
              placeholder={
                settings.tokenConfigured && !form.tokenTouched
                  ? '••••••••  (сохранён, введите новый чтобы заменить)'
                  : 'вставьте токен'
              }
              disabled={form.mode === 'mock'}
              onChange={(e) => set({ token: e.target.value, tokenTouched: true })}
            />
          </label>

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
              <option value="cancel">Отменить заявку (status=cancelled, клиент видит отмену)</option>
              <option value="purge">Удалить из хранилища навсегда</option>
            </select>
          </label>

          {checkResult ? (
            <p className={`field-wide check ${checkResult.ok ? 'is-ok' : 'is-bad'}`}>{checkResult.text}</p>
          ) : (
            <p className="field-wide hint">
              Токен хранится только в профиле Windows и не показывается в окне повторно. Часовой пояс —
              Москва.
            </p>
          )}
        </div>

        <footer className="modal-foot">
          <button type="button" className="ghost-btn" onClick={() => void testConnection()} disabled={checking}>
            {checking ? 'Проверяем…' : 'Проверить связь'}
          </button>
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Отмена
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                void onSave(buildPatch())
              }}
            >
              Сохранить
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

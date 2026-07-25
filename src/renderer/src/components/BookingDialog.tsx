import { useEffect, useMemo, useRef, useState } from 'react'
import { STATUS_LABEL, STATUS_ORDER } from '../../../shared/constants'
import { isValidPhone, maskPhoneInput, normalizePhone } from '../../../shared/phone'
import {
  buildSlots,
  composeVisitAt,
  isValidClock,
  isValidIsoDate,
  splitVisitAt
} from '../../../shared/time'
import type { Booking, BookingInput, BookingStatus } from '../../../shared/types'
import { IconClose } from './Icons'

export interface DialogSeed {
  /** Заявка для редактирования; null — создаём новую */
  booking: Booking | null
  date: string
  time: string
}

interface Props {
  seed: DialogSeed
  services: string[]
  dayStart: string
  dayEnd: string
  slotMinutes: number
  saving: boolean
  onSubmit: (input: BookingInput) => void
  onClose: () => void
}

interface FormState {
  name: string
  phone: string
  service: string
  comment: string
  date: string
  time: string
  status: BookingStatus
  called: boolean
  reminderSent: boolean
}

function initialState(seed: DialogSeed, services: string[]): FormState {
  const booking = seed.booking
  const parts = booking ? splitVisitAt(booking.visit_at) : null
  return {
    name: booking?.name ?? '',
    phone: booking ? maskPhoneInput(booking.phone) : '+7 ',
    service: booking?.service ?? services[0] ?? '',
    comment: booking?.comment ?? '',
    date: parts?.date ?? (booking ? '' : seed.date),
    time: parts?.time ?? (booking ? '' : seed.time),
    status: booking?.status ?? (seed.time ? 'confirmed' : 'new'),
    called: booking?.called ?? false,
    reminderSent: booking?.reminder_sent ?? false
  }
}

export function BookingDialog({
  seed,
  services,
  dayStart,
  dayEnd,
  slotMinutes,
  saving,
  onSubmit,
  onClose
}: Props) {
  const [form, setForm] = useState<FormState>(() => initialState(seed, services))
  const [touched, setTouched] = useState(false)
  const nameRef = useRef<HTMLInputElement | null>(null)
  const servicesRef = useRef(services)
  servicesRef.current = services

  // Зависимость только от seed: фоновое обновление дня меняет массив услуг,
  // и по нему форма сбрасывала бы наполовину введённую заявку.
  useEffect(() => {
    setForm(initialState(seed, servicesRef.current))
    setTouched(false)
    // Курсор сразу в поле имени: заявку заводят на слух, во время звонка
    window.setTimeout(() => nameRef.current?.focus(), 0)
  }, [seed])

  const slots = useMemo(() => buildSlots(dayStart, dayEnd, slotMinutes), [dayStart, dayEnd, slotMinutes])
  const set = (part: Partial<FormState>): void => setForm((current) => ({ ...current, ...part }))

  const nameError = form.name.trim() ? '' : 'Укажите имя'
  const phoneError = isValidPhone(form.phone) ? '' : 'Нужен российский номер из 10 цифр'
  const dateError = !form.date || isValidIsoDate(form.date) ? '' : 'Дата в формате ГГГГ-ММ-ДД'
  const timeError = !form.time || isValidClock(form.time) ? '' : 'Время в формате ЧЧ:ММ'
  const pairError = form.time && !form.date ? 'Для времени нужна дата' : ''
  const invalid = Boolean(nameError || phoneError || dateError || timeError || pairError)

  function submit(): void {
    setTouched(true)
    if (invalid || saving) return
    const visitAt = form.date && form.time ? composeVisitAt(form.date, form.time) : ''
    onSubmit({
      name: form.name.trim(),
      phone: normalizePhone(form.phone),
      service: form.service,
      comment: form.comment.trim(),
      visit_at: visitAt,
      status: form.status,
      called: form.called,
      reminder_sent: form.reminderSent
    })
  }

  const editing = Boolean(seed.booking)

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <h2>{editing ? `Заявка ${seed.booking?.code}` : 'Новый клиент'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} title="Закрыть (Esc)">
            <IconClose />
          </button>
        </header>

        <form
          className="modal-body form"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <label className="field">
            <span>Имя</span>
            <input
              ref={nameRef}
              value={form.name}
              onChange={(event) => set({ name: event.target.value })}
              placeholder="Как записать клиента"
            />
            {touched && nameError ? <em className="field-error">{nameError}</em> : null}
          </label>

          <label className="field">
            <span>Телефон</span>
            <input
              value={form.phone}
              inputMode="tel"
              onChange={(event) => set({ phone: maskPhoneInput(event.target.value) })}
              placeholder="+7 (___) ___-__-__"
            />
            {touched && phoneError ? <em className="field-error">{phoneError}</em> : null}
          </label>

          <label className="field">
            <span>Услуга</span>
            <select value={form.service} onChange={(event) => set({ service: event.target.value })}>
              {services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Статус</span>
            <select
              value={form.status}
              onChange={(event) => set({ status: event.target.value as BookingStatus })}
            >
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="field field-wide">
            <span>Комментарий</span>
            <textarea
              rows={2}
              value={form.comment}
              onChange={(event) => set({ comment: event.target.value })}
              placeholder="Размер, диски, пожелания"
            />
          </label>

          <fieldset className="field field-wide visit">
            <legend>Визит</legend>
            <div className="visit-row">
              <input
                type="date"
                value={form.date}
                onChange={(event) => set({ date: event.target.value })}
              />
              <select value={form.time} onChange={(event) => set({ time: event.target.value })}>
                <option value="">— без времени —</option>
                {slots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
                {form.time && !slots.includes(form.time) ? (
                  <option value={form.time}>{form.time} (вне графика)</option>
                ) : null}
              </select>
              <button type="button" className="ghost-btn" onClick={() => set({ date: '', time: '' })}>
                Убрать время
              </button>
            </div>
            {touched && (dateError || timeError || pairError) ? (
              <em className="field-error">{dateError || timeError || pairError}</em>
            ) : null}
            <p className="hint">
              Несколько клиентов на один слот — это нормально. Перенос времени сбрасывает флаг SMS.
            </p>
          </fieldset>

          <div className="field field-wide toggles">
            <label className="switch">
              <input
                type="checkbox"
                checked={form.called}
                onChange={(event) => set({ called: event.target.checked })}
              />
              <span>Обзвонили</span>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={form.reminderSent}
                onChange={(event) => set({ reminderSent: event.target.checked })}
              />
              <span>SMS-напоминание отправлено</span>
            </label>
          </div>
        </form>

        <footer className="modal-foot">
          <span className="hint">
            {editing ? 'Код и дата создания не меняются' : 'Код заявки сгенерирует сервер, источник — CRM'}
          </span>
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="primary-btn" onClick={submit} disabled={saving}>
              {saving ? 'Сохраняем…' : editing ? 'Сохранить' : 'Создать заявку'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

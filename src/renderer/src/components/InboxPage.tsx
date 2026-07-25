import { useMemo } from 'react'
import { applyFilters, type Filters } from '../lib/filters'
import { formatPhone, telHref } from '../../../shared/phone'
import { formatDateHuman } from '../../../shared/time'
import type { Booking } from '../../../shared/types'
import { STATUS_LABEL } from '../../../shared/constants'
import { IconMail, IconPhone, IconPlus } from './Icons'

interface Props {
  bookings: Booking[]
  filters: Filters
  selectedCode: string | null
  onSelect: (code: string) => void
  onEdit: (booking: Booking) => void
  onContextMenu: (booking: Booking, x: number, y: number) => void
  onSchedule: (booking: Booking) => void
  onToggleCalled: (booking: Booking) => void
  onCreate: () => void
}

/**
 * Отдельная страница: заявки без назначенного времени (обычно с сайта / бота).
 * На расписании дня их нет — сюда приходят «новые», пока не обзвонили и не поставили слот.
 */
export function InboxPage({
  bookings,
  filters,
  selectedCode,
  onSelect,
  onEdit,
  onContextMenu,
  onSchedule,
  onToggleCalled,
  onCreate
}: Props) {
  const visible = useMemo(() => applyFilters(bookings, filters), [bookings, filters])
  const toCall = visible.filter((b) => !b.called).length

  return (
    <section className="inbox">
      <header className="inbox-head">
        <div>
          <h1>Необработанные заявки</h1>
          <p>
            Заявки без времени визита. Обзвоните клиента и назначьте слот — после этого запись
            появится в расписании дня.
          </p>
        </div>
        <div className="inbox-stats">
          <span className="inbox-stat">
            всего <b>{visible.length}</b>
          </span>
          <span className="inbox-stat inbox-stat-warn">
            <IconPhone size={12} /> не обзвонены <b>{toCall}</b>
          </span>
          <button type="button" className="primary-btn" onClick={onCreate}>
            <IconPlus size={14} />
            Новый клиент
          </button>
        </div>
      </header>

      {visible.length === 0 ? (
        <div className="inbox-empty">
          <p>Очереди нет. Новые заявки с сайта появятся здесь после обновления (F5).</p>
        </div>
      ) : (
        <div className="inbox-table" role="table">
          <div className="inbox-row inbox-row-head" role="row">
            <span>Клиент</span>
            <span>Телефон</span>
            <span>Услуга</span>
            <span>Источник</span>
            <span>Создана</span>
            <span>Обзвон / SMS</span>
            <span>Действия</span>
          </div>
          {visible.map((booking) => {
            const selected = booking.code === selectedCode
            return (
              <div
                key={booking.code}
                className={`inbox-row status-${booking.status}${selected ? ' is-selected' : ''}`}
                role="row"
                tabIndex={0}
                onClick={() => onSelect(booking.code)}
                onDoubleClick={() => onEdit(booking)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  onSelect(booking.code)
                  onContextMenu(booking, event.clientX, event.clientY)
                }}
                onFocus={() => onSelect(booking.code)}
              >
                <div className="inbox-cell inbox-name">
                  <strong>{booking.name}</strong>
                  <code>{booking.code}</code>
                  <span className="inbox-status">{STATUS_LABEL[booking.status]}</span>
                </div>
                <div className="inbox-cell">
                  <a
                    href={telHref(booking.phone)}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      void window.crm.openExternal(telHref(booking.phone))
                    }}
                  >
                    {formatPhone(booking.phone)}
                  </a>
                </div>
                <div className="inbox-cell">{booking.service}</div>
                <div className="inbox-cell inbox-source">{booking.source || '—'}</div>
                <div className="inbox-cell inbox-created">
                  {booking.created_at
                    ? formatDateHuman(booking.created_at.slice(0, 10))
                    : '—'}
                  {booking.created_at?.includes(' ') ? (
                    <span> · {booking.created_at.slice(-5)}</span>
                  ) : null}
                </div>
                <div className="inbox-cell inbox-flags">
                  <span
                    className={`flag ${booking.called ? 'flag-on' : 'flag-off'}`}
                    title={booking.called ? 'Обзвонили' : 'Не обзвонили'}
                  >
                    <IconPhone size={12} />
                  </span>
                  <span
                    className={`flag ${booking.reminder_sent ? 'flag-on' : 'flag-off'}`}
                    title={booking.reminder_sent ? 'SMS отправлено' : 'SMS не отправлено'}
                  >
                    <IconMail size={12} />
                  </span>
                </div>
                <div className="inbox-cell inbox-actions">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleCalled(booking)
                    }}
                  >
                    {booking.called ? 'Снять обзвон' : 'Обзвонили'}
                  </button>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={(event) => {
                      event.stopPropagation()
                      onSchedule(booking)
                    }}
                  >
                    Назначить время
                  </button>
                </div>
                {booking.comment ? (
                  <div className="inbox-comment" role="cell">
                    {booking.comment}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

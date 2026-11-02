import { CHANNEL_LABEL, CHANNEL_ORDER, STATUS_LABEL, STATUS_ORDER } from '../../../shared/constants'
import { formatPhone, telHref } from '../../../shared/phone'
import { formatVisitHuman } from '../../../shared/time'
import type { Booking, BookingStatus, ChannelAvailability, NotifyChannel } from '../../../shared/types'
import { IconClose, IconEdit, IconMail, IconPhone, IconTrash } from './Icons'
import { channelUsable, defaultChannel } from './MessageDialog'

interface Props {
  booking: Booking | null
  channels: ChannelAvailability
  onChannelChange: (booking: Booking, channel: NotifyChannel | '') => void
  onMessage: (booking: Booking) => void
  onClose: () => void
  onEdit: (booking: Booking) => void
  onDelete: (booking: Booking) => void
  onToggleCalled: (booking: Booking) => void
  onToggleSms: (booking: Booking) => void
  onStatusChange: (booking: Booking, status: BookingStatus) => void
  onClearVisit: (booking: Booking) => void
}

function reminderLabel(booking: Booking): string {
  if (!booking.reminder_sent) return 'Напоминание не отправлено'
  if (booking.reminder_error) return 'Напоминание не дошло'
  if (booking.reminder_channel) return `Напоминание · ${CHANNEL_LABEL[booking.reminder_channel]}`
  return 'Напоминание отправлено'
}

export function DetailsPanel({
  booking,
  channels,
  onChannelChange,
  onMessage,
  onClose,
  onEdit,
  onDelete,
  onToggleCalled,
  onToggleSms,
  onStatusChange,
  onClearVisit
}: Props) {
  if (!booking) {
    return (
      <aside className="details is-empty">
        <p className="empty">
          Выберите карточку, чтобы увидеть детали.
          <br />
          <kbd>N</kbd> новый · <kbd>Enter</kbd> изменить · <kbd>C</kbd> обзвон · <kbd>S</kbd> напоминание ·{' '}
          <kbd>M</kbd> написать · <kbd>Del</kbd> отменить
        </p>
      </aside>
    )
  }

  return (
    <aside className="details">
      <header className="details-head">
        <div>
          <h2>{booking.name}</h2>
          <span className="details-code">
            {booking.code} · {booking.source}
          </span>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} title="Закрыть (Esc)">
          <IconClose />
        </button>
      </header>

      <dl className="details-list">
        <div>
          <dt>Телефон</dt>
          <dd>
            <a
              href={telHref(booking.phone)}
              onClick={(event) => {
                event.preventDefault()
                void window.crm.openExternal(telHref(booking.phone))
              }}
            >
              {formatPhone(booking.phone)}
            </a>
          </dd>
        </div>
        <div>
          <dt>Услуга</dt>
          <dd>{booking.service}</dd>
        </div>
        <div>
          <dt>Визит</dt>
          <dd>{formatVisitHuman(booking.visit_at)}</dd>
        </div>
        <div>
          <dt>Создана</dt>
          <dd>{booking.created_at}</dd>
        </div>
        {booking.comment ? (
          <div className="details-comment">
            <dt>Комментарий</dt>
            <dd>{booking.comment}</dd>
          </div>
        ) : null}
      </dl>

      <div className="details-flags">
        <button
          type="button"
          className={`flag-btn ${booking.called ? 'is-on' : ''}`}
          onClick={() => onToggleCalled(booking)}
          title="Переключить отметку обзвона (C)"
        >
          <IconPhone size={14} />
          {booking.called ? `Обзвонили${booking.called_at ? ` · ${booking.called_at.slice(-5)}` : ''}` : 'Не обзвонили'}
        </button>
        <button
          type="button"
          className={`flag-btn ${booking.reminder_sent && !booking.reminder_error ? 'is-on' : ''}`}
          onClick={() => onToggleSms(booking)}
          title={booking.reminder_error || 'Переключить отметку напоминания (S)'}
        >
          <IconMail size={14} />
          {reminderLabel(booking)}
        </button>
      </div>
      {booking.reminder_error ? <p className="field-error">{booking.reminder_error}</p> : null}

      <div className="details-status">
        <span className="details-label">Канал связи</span>
        <div className="status-row details-channel">
          <select
            value={booking.notify_channel}
            onChange={(event) => onChannelChange(booking, event.target.value as NotifyChannel | '')}
          >
            <option value="">
              Авто{(() => {
                const auto = defaultChannel({ ...booking, notify_channel: '' }, channels)
                return auto ? ` (${CHANNEL_LABEL[auto]})` : ''
              })()}
            </option>
            {CHANNEL_ORDER.map((channel) => (
              <option key={channel} value={channel} disabled={!channelUsable(booking, channels, channel)}>
                {CHANNEL_LABEL[channel]}
                {channel === 'telegram' && !booking.tg_linked ? ' — клиент не открывал бота' : ''}
                {channel !== 'telegram' && !channels[channel] ? ' — не подключено' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => onMessage(booking)}
            disabled={!defaultChannel(booking, channels)}
            title="Написать клиенту (M)"
          >
            <IconMail size={14} />
            Написать
          </button>
        </div>
      </div>

      <div className="details-status">
        <span className="details-label">Статус заявки</span>
        <div className="status-row">
          {STATUS_ORDER.map((status) => (
            <button
              key={status}
              type="button"
              className={`status-btn status-${status}${booking.status === status ? ' is-on' : ''}`}
              onClick={() => onStatusChange(booking, status)}
            >
              {STATUS_LABEL[status]}
            </button>
          ))}
        </div>
      </div>

      <div className="details-actions">
        <button type="button" className="primary-btn" onClick={() => onEdit(booking)}>
          <IconEdit size={14} />
          Редактировать
        </button>
        {booking.visit_at ? (
          <button type="button" className="ghost-btn" onClick={() => onClearVisit(booking)}>
            Убрать время
          </button>
        ) : null}
        <button type="button" className="danger-btn" onClick={() => onDelete(booking)}>
          <IconTrash size={14} />
          Удалить
        </button>
      </div>
    </aside>
  )
}

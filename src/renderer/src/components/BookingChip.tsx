import { SERVICE_SHORT, STATUS_LABEL } from '../../../shared/constants'
import { formatPhone, telHref } from '../../../shared/phone'
import { visitTime } from '../../../shared/time'
import type { Booking } from '../../../shared/types'
import { IconMail, IconPhone } from './Icons'

interface Props {
  booking: Booking
  selected: boolean
  /** Показывать точное время визита — нужно в слоте с шагом крупнее минуты */
  showTime?: boolean
  onSelect: (code: string) => void
  onEdit: (booking: Booking) => void
  onContextMenu: (booking: Booking, x: number, y: number) => void
  onDragStart: (code: string) => void
  onDragEnd: () => void
}

export function BookingChip({
  booking,
  selected,
  showTime = false,
  onSelect,
  onEdit,
  onContextMenu,
  onDragStart,
  onDragEnd
}: Props) {
  const service = SERVICE_SHORT[booking.service] ?? booking.service
  const time = visitTime(booking.visit_at)

  return (
    <article
      className={`chip status-${booking.status}${selected ? ' is-selected' : ''}`}
      draggable
      tabIndex={0}
      role="button"
      aria-label={`${booking.name}, ${booking.service}, код ${booking.code}`}
      onClick={() => onSelect(booking.code)}
      onDoubleClick={() => onEdit(booking)}
      onContextMenu={(event) => {
        event.preventDefault()
        onSelect(booking.code)
        onContextMenu(booking, event.clientX, event.clientY)
      }}
      onFocus={() => onSelect(booking.code)}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', booking.code)
        event.dataTransfer.effectAllowed = 'move'
        onDragStart(booking.code)
      }}
      onDragEnd={onDragEnd}
    >
      <header className="chip-head">
        <span className="chip-name" title={booking.name}>
          {booking.name}
        </span>
        <span className="chip-flags">
          <span
            className={`flag ${booking.called ? 'flag-on' : 'flag-off'}`}
            title={booking.called ? `Обзвонили${booking.called_at ? ` · ${booking.called_at}` : ''}` : 'Не обзвонили'}
          >
            <IconPhone size={12} />
          </span>
          <span
            className={`flag ${booking.reminder_sent ? 'flag-on' : 'flag-off'}`}
            title={booking.reminder_sent ? 'SMS-напоминание отправлено' : 'SMS-напоминание не отправлено'}
          >
            <IconMail size={12} />
          </span>
        </span>
      </header>

      <a
        className="chip-phone"
        href={telHref(booking.phone)}
        // Ссылки Chromium тащит сам — иначе перетаскивание карточки срывается
        draggable={false}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void window.crm.openExternal(telHref(booking.phone))
        }}
      >
        {formatPhone(booking.phone)}
      </a>

      <footer className="chip-foot">
        <span className="chip-service" title={booking.service}>
          {service}
        </span>
        {showTime && time ? <span className="chip-time">{time}</span> : null}
        <span className="chip-code" title={`Статус: ${STATUS_LABEL[booking.status]}`}>
          {booking.code}
        </span>
      </footer>
    </article>
  )
}

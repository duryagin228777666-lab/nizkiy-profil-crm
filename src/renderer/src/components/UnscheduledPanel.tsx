import { useMemo } from 'react'
import { applyFilters, type Filters } from '../lib/filters'
import type { Booking } from '../../../shared/types'
import { BookingChip } from './BookingChip'
import { IconPhone } from './Icons'

interface Props {
  bookings: Booking[]
  filters: Filters
  selectedCode: string | null
  dragCode: string | null
  isDropTarget: boolean
  onSelect: (code: string) => void
  onEdit: (booking: Booking) => void
  onContextMenu: (booking: Booking, x: number, y: number) => void
  onDragStart: (code: string) => void
  onDragEnd: () => void
  onDropHere: () => void
  onHover: (over: boolean) => void
}

export function UnscheduledPanel({
  bookings,
  filters,
  selectedCode,
  dragCode,
  isDropTarget,
  onSelect,
  onEdit,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDropHere,
  onHover
}: Props) {
  const visible = useMemo(() => applyFilters(bookings, filters), [bookings, filters])
  const toCall = visible.filter((booking) => !booking.called).length

  return (
    <aside
      className={`queue${isDropTarget ? ' is-drop' : ''}`}
      onDragOver={(event) => {
        if (!dragCode) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onHover(true)
      }}
      onDragLeave={() => onHover(false)}
      onDrop={(event) => {
        event.preventDefault()
        onDropHere()
      }}
    >
      <header className="queue-head">
        <h2>Без времени</h2>
        <span className="queue-total">{visible.length}</span>
      </header>
      <p className="queue-hint">
        {toCall > 0 ? (
          <>
            <IconPhone size={12} /> нужно обзвонить: <b>{toCall}</b>
          </>
        ) : (
          'Все обзвонены'
        )}
      </p>

      <div className="queue-list">
        {visible.length === 0 ? (
          <p className="empty">Пусто. Заявки с сайта появятся здесь.</p>
        ) : (
          visible.map((booking) => (
            <BookingChip
              key={booking.code}
              booking={booking}
              selected={booking.code === selectedCode}
              onSelect={onSelect}
              onEdit={onEdit}
              onContextMenu={onContextMenu}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>

      <p className="queue-foot">Перетащите карточку в слот, чтобы назначить время.</p>
    </aside>
  )
}

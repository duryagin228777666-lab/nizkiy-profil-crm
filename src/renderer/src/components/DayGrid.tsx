import { useEffect, useMemo, useRef } from 'react'
import { applyFilters, type Filters } from '../lib/filters'
import { currentSlot, groupIntoSlots } from '../lib/grid'
import { nowClock, todayIso } from '../../../shared/time'
import type { Booking } from '../../../shared/types'
import { IconPlus } from './Icons'
import { BookingChip } from './BookingChip'

interface Props {
  date: string
  bookings: Booking[]
  filters: Filters
  dayStart: string
  dayEnd: string
  slotMinutes: number
  selectedCode: string | null
  dragCode: string | null
  dropTarget: string | null
  onSelect: (code: string) => void
  onEdit: (booking: Booking) => void
  onContextMenu: (booking: Booking, x: number, y: number) => void
  onDragStart: (code: string) => void
  onDragEnd: () => void
  onDropOnSlot: (time: string) => void
  onHoverSlot: (time: string | null) => void
  onAddToSlot: (time: string) => void
}

export function DayGrid({
  date,
  bookings,
  filters,
  dayStart,
  dayEnd,
  slotMinutes,
  selectedCode,
  dragCode,
  dropTarget,
  onSelect,
  onEdit,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDropOnSlot,
  onHoverSlot,
  onAddToSlot
}: Props) {
  const visible = useMemo(() => applyFilters(bookings, filters), [bookings, filters])
  const rows = useMemo(
    () => groupIntoSlots(visible, dayStart, dayEnd, slotMinutes),
    [visible, dayStart, dayEnd, slotMinutes]
  )

  const isToday = date === todayIso()
  const nowSlot = isToday ? currentSlot(nowClock(), slotMinutes) : null
  const nowRef = useRef<HTMLDivElement | null>(null)

  // При открытии сегодняшнего дня сразу показываем текущий час, а не 09:00
  useEffect(() => {
    if (isToday) nowRef.current?.scrollIntoView({ block: 'center' })
  }, [isToday, date])

  return (
    <div className="grid" role="table" aria-label={`Расписание на ${date}`}>
      {rows.map((row) => {
        const count = row.bookings.length
        const isNow = row.time === nowSlot
        const isDropTarget = dropTarget === row.time
        return (
          <div
            key={row.time}
            ref={isNow ? nowRef : undefined}
            className={[
              'slot',
              count === 0 ? 'is-empty' : '',
              count >= 3 ? 'is-crowded' : '',
              row.offHours ? 'is-offhours' : '',
              isNow ? 'is-now' : '',
              isDropTarget ? 'is-drop' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            role="row"
            onDragOver={(event) => {
              if (!dragCode) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              onHoverSlot(row.time)
            }}
            onDragLeave={() => onHoverSlot(null)}
            onDrop={(event) => {
              event.preventDefault()
              onDropOnSlot(row.time)
            }}
          >
            <div className="slot-time" role="rowheader">
              <span className="slot-clock">{row.time}</span>
              {count > 1 ? <span className="slot-count">{count}</span> : null}
              {row.offHours ? <span className="slot-tag">вне графика</span> : null}
            </div>

            <div className="slot-body" role="cell">
              {row.bookings.map((booking) => (
                <BookingChip
                  key={booking.code}
                  booking={booking}
                  selected={booking.code === selectedCode}
                  showTime={booking.visit_at.slice(-5) !== row.time}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onContextMenu={onContextMenu}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              ))}

              <button
                type="button"
                className="slot-add"
                title={`Добавить клиента на ${row.time}`}
                onClick={() => onAddToSlot(row.time)}
              >
                <IconPlus size={13} />
                <span>{count === 0 ? `Добавить на ${row.time}` : 'Ещё клиент'}</span>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

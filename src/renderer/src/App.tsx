import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookingDialog, type DialogSeed } from './components/BookingDialog'
import { ContextMenu, type MenuAction } from './components/ContextMenu'
import { DayGrid } from './components/DayGrid'
import { DetailsPanel } from './components/DetailsPanel'
import { IconAlert, IconSettings } from './components/Icons'
import { InboxPage } from './components/InboxPage'
import { SettingsDialog } from './components/SettingsDialog'
import { Toasts } from './components/Toasts'
import { Toolbar } from './components/Toolbar'
import { useDay } from './hooks/useDay'
import { useHotkeys } from './hooks/useHotkeys'
import { useToasts } from './hooks/useToasts'
import { applyFilters, EMPTY_FILTERS, type Filters } from './lib/filters'
import { STATUS_LABEL } from '../../shared/constants'
import { composeVisitAt, shiftDate, todayIso, visitTime } from '../../shared/time'
import type {
  AppPage,
  Booking,
  BookingInput,
  BookingStatus,
  DeleteMode,
  MenuCommand,
  PublicSettings
} from '../../shared/types'

export default function App() {
  const { toasts, push, dismiss } = useToasts()
  const onError = useCallback((message: string) => push('error', message), [push])

  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [bootError, setBootError] = useState('')
  const [page, setPage] = useState<AppPage>('day')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogSeed | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ booking: Booking; x: number; y: number } | null>(null)
  const [dragCode, setDragCode] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const searchRef = useRef<HTMLInputElement | null>(null)
  const day = useDay(settings, onError)

  useEffect(() => {
    if (!window.crm) {
      setBootError('Мост Electron не загрузился. Закройте окно и снова запустите npm run dev.')
      return
    }
    void window.crm
      .getSettings()
      .then(setSettings)
      .catch((error: unknown) => {
        setBootError(error instanceof Error ? error.message : 'Не удалось прочитать настройки')
      })
  }, [])

  const grid = useMemo(
    () => ({
      dayStart: settings?.dayStart || day.day.settings.day_start,
      dayEnd: settings?.dayEnd || day.day.settings.day_end,
      slotMinutes: settings?.slotMinutes || day.day.settings.slot_minutes
    }),
    [settings, day.day.settings]
  )

  const inboxBookings = day.day.unscheduled
  const dayBookings = day.day.scheduled
  const pageBookings = page === 'inbox' ? inboxBookings : dayBookings

  const shownCount = useMemo(() => applyFilters(pageBookings, filters).length, [pageBookings, filters])
  const selected = useMemo(
    () => [...dayBookings, ...inboxBookings].find((booking) => booking.code === selectedCode) ?? null,
    [dayBookings, inboxBookings, selectedCode]
  )

  const navigationOrder = useMemo(
    () => applyFilters(pageBookings, filters).map((b) => b.code),
    [pageBookings, filters]
  )

  const openCreate = useCallback(
    (time = '') => {
      setContextMenu(null)
      setDialog({ booking: null, date: day.date, time })
    },
    [day.date]
  )

  const openEdit = useCallback((booking: Booking) => {
    setContextMenu(null)
    setSelectedCode(booking.code)
    setDialog({ booking, date: booking.visit_at.slice(0, 10), time: visitTime(booking.visit_at) })
  }, [])

  /** Из очереди — открыть форму с датой сегодня и пустым временем, чтобы выбрать слот. */
  const openSchedule = useCallback(
    (booking: Booking) => {
      setContextMenu(null)
      setSelectedCode(booking.code)
      setPage('day')
      setDialog({ booking, date: day.date, time: '' })
    },
    [day.date]
  )

  const submitDialog = useCallback(
    async (input: BookingInput) => {
      if (!dialog) return
      setSaving(true)
      const result = dialog.booking
        ? await day.update(dialog.booking.code, input)
        : await day.create(input)
      setSaving(false)
      if (!result) return
      setSelectedCode(result.code)
      setDialog(null)
      // После назначения времени заявка уходит из очереди на расписание
      if (result.visit_at) setPage('day')
      push('success', dialog.booking ? `Заявка ${result.code} сохранена` : `Создана заявка ${result.code}`)
    },
    [dialog, day, push]
  )

  const toggleCalled = useCallback(
    async (booking: Booking) => {
      const next = !booking.called
      const patch: BookingInput = { called: next }
      if (next && booking.status === 'new') {
        const confirmed = await window.crm.confirm({
          message: `Отметить ${booking.name} как обзвоненного?`,
          detail: 'Заодно перевести заявку в статус «Подтверждена»?',
          confirmLabel: 'Да, подтвердить'
        })
        if (confirmed) patch.status = 'confirmed'
      }
      const result = await day.update(booking.code, patch)
      if (result) push('success', next ? `${result.name}: обзвонили` : `${result.name}: отметка обзвона снята`)
    },
    [day, push]
  )

  const toggleSms = useCallback(
    async (booking: Booking) => {
      const next = !booking.reminder_sent
      const result = await day.update(booking.code, { reminder_sent: next })
      if (result) push('success', next ? 'Отмечено: SMS отправлено' : 'Отметка SMS снята')
    },
    [day, push]
  )

  const changeStatus = useCallback(
    async (booking: Booking, status: BookingStatus) => {
      if (booking.status === status) return
      const result = await day.update(booking.code, { status })
      if (result) push('success', `${result.code}: ${STATUS_LABEL[status].toLowerCase()}`)
    },
    [day, push]
  )

  const assignSlot = useCallback(
    async (booking: Booking, time: string) => {
      const visitAt = composeVisitAt(day.date, time)
      if (booking.visit_at === visitAt) return
      const result = await day.update(booking.code, { visit_at: visitAt })
      if (result) {
        setPage('day')
        push('success', `${result.name} → ${time}`)
      }
    },
    [day, push]
  )

  const clearVisit = useCallback(
    async (booking: Booking) => {
      if (!booking.visit_at) return
      const result = await day.update(booking.code, { visit_at: '' })
      if (result) {
        setPage('inbox')
        push('success', `${result.name} перенесён в необработанные`)
      }
    },
    [day, push]
  )

  const deleteBooking = useCallback(
    async (booking: Booking, mode: DeleteMode) => {
      const confirmed = await window.crm.confirm({
        message:
          mode === 'purge'
            ? `Удалить заявку ${booking.code} навсегда?`
            : `Отменить заявку ${booking.code} (${booking.name})?`,
        detail:
          mode === 'purge'
            ? 'Запись исчезнет из хранилища. Отменить это действие нельзя.'
            : 'Статус станет «Отменена». Запись останется в истории.',
        confirmLabel: mode === 'purge' ? 'Удалить навсегда' : 'Отменить заявку',
        danger: mode === 'purge'
      })
      if (!confirmed) return
      const ok = await day.remove(booking.code, mode)
      if (!ok) return
      if (mode === 'purge') setSelectedCode(null)
      push('success', mode === 'purge' ? `Заявка ${booking.code} удалена` : `Заявка ${booking.code} отменена`)
    },
    [day, push]
  )

  const handleDrop = useCallback(
    (target: string) => {
      const code = dragCode
      setDragCode(null)
      setDropTarget(null)
      if (!code) return
      const booking = [...dayBookings, ...inboxBookings].find((b) => b.code === code)
      if (!booking) return
      void assignSlot(booking, target)
    },
    [dragCode, dayBookings, inboxBookings, assignSlot]
  )

  const handleMenuCommand = useCallback(
    (command: MenuCommand) => {
      switch (command) {
        case 'new-booking':
          openCreate()
          break
        case 'refresh':
          void day.refresh()
          break
        case 'settings':
          setSettingsOpen(true)
          break
        case 'today':
          setPage('day')
          day.setDate(todayIso())
          break
        case 'prev-day':
          setPage('day')
          day.setDate(shiftDate(day.date, -1))
          break
        case 'next-day':
          setPage('day')
          day.setDate(shiftDate(day.date, 1))
          break
        case 'focus-search':
          searchRef.current?.focus()
          break
        case 'page-day':
          setPage('day')
          break
        case 'page-inbox':
          setPage('inbox')
          break
        default:
          break
      }
    },
    [day, openCreate]
  )

  useEffect(() => {
    if (!window.crm) return undefined
    return window.crm.onMenuCommand(handleMenuCommand)
  }, [handleMenuCommand])

  const modalOpen = dialog !== null || settingsOpen

  useHotkeys(
    {
      newBooking: () => openCreate(),
      edit: () => selected && openEdit(selected),
      remove: () => selected && void deleteBooking(selected, settings?.defaultDeleteMode ?? 'cancel'),
      toggleCalled: () => selected && void toggleCalled(selected),
      toggleSms: () => selected && void toggleSms(selected),
      refresh: () => void day.refresh(),
      prevDay: () => {
        setPage('day')
        day.setDate(shiftDate(day.date, -1))
      },
      nextDay: () => {
        setPage('day')
        day.setDate(shiftDate(day.date, 1))
      },
      today: () => {
        setPage('day')
        day.setDate(todayIso())
      },
      focusSearch: () => searchRef.current?.focus(),
      moveSelection: (delta) => {
        if (navigationOrder.length === 0) return
        const current = selectedCode ? navigationOrder.indexOf(selectedCode) : -1
        const next = current === -1 ? (delta > 0 ? 0 : navigationOrder.length - 1) : current + delta
        setSelectedCode(navigationOrder[Math.max(0, Math.min(navigationOrder.length - 1, next))])
      },
      escape: () => {
        if (contextMenu) setContextMenu(null)
        else if (dialog) setDialog(null)
        else if (settingsOpen) setSettingsOpen(false)
        else setSelectedCode(null)
      }
    },
    modalOpen
  )

  const contextActions = useMemo((): MenuAction[] => {
    const booking = contextMenu?.booking
    if (!booking) return []
    return [
      { label: 'Редактировать', onClick: () => openEdit(booking) },
      {
        label: booking.called ? 'Снять отметку обзвона' : 'Отметить: обзвонили',
        onClick: () => void toggleCalled(booking)
      },
      {
        label: booking.reminder_sent ? 'Снять отметку SMS' : 'Отметить: SMS отправлено',
        onClick: () => void toggleSms(booking)
      },
      {
        label: booking.visit_at ? 'В необработанные (убрать время)' : 'Назначить время…',
        separatorBefore: true,
        onClick: () => (booking.visit_at ? void clearVisit(booking) : openSchedule(booking))
      },
      {
        label: 'Отменить заявку',
        separatorBefore: true,
        onClick: () => void deleteBooking(booking, 'cancel')
      },
      { label: 'Удалить навсегда', danger: true, onClick: () => void deleteBooking(booking, 'purge') }
    ]
  }, [contextMenu, openEdit, toggleCalled, toggleSms, clearVisit, openSchedule, deleteBooking])

  if (bootError) {
    return (
      <div className="boot boot-error">
        <h1>CRM не запустилась</h1>
        <p>{bootError}</p>
      </div>
    )
  }

  if (!settings) return <div className="boot">Загрузка…</div>

  return (
    <div className="app">
      <Toolbar
        ref={searchRef}
        page={page}
        onPageChange={setPage}
        inboxCount={inboxBookings.filter((b) => b.status !== 'cancelled' && b.status !== 'done').length}
        date={day.date}
        onDateChange={(date) => {
          setPage('day')
          day.setDate(date)
        }}
        filters={filters}
        onFiltersChange={setFilters}
        services={day.day.services}
        loading={day.loading}
        mode={settings.mode}
        lastSync={day.lastSync}
        shownCount={shownCount}
        totalCount={pageBookings.length}
        onRefresh={() => void day.refresh()}
        onCreate={() => openCreate()}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {day.error ? (
        <div className="banner">
          <IconAlert size={15} />
          <span>{day.error}</span>
          <button type="button" className="ghost-btn" onClick={() => setSettingsOpen(true)}>
            <IconSettings size={13} />
            Настройки
          </button>
          <button type="button" className="ghost-btn" onClick={() => void day.refresh()}>
            Повторить
          </button>
        </div>
      ) : null}

      {page === 'inbox' ? (
        <main className="workspace workspace-inbox">
          <InboxPage
            bookings={inboxBookings}
            filters={filters}
            selectedCode={selectedCode}
            onSelect={setSelectedCode}
            onEdit={openEdit}
            onContextMenu={(booking, x, y) => setContextMenu({ booking, x, y })}
            onSchedule={openSchedule}
            onToggleCalled={(booking) => void toggleCalled(booking)}
            onCreate={() => openCreate()}
          />
          <DetailsPanel
            booking={selected}
            onClose={() => setSelectedCode(null)}
            onEdit={openEdit}
            onDelete={(booking) => void deleteBooking(booking, settings.defaultDeleteMode)}
            onToggleCalled={(booking) => void toggleCalled(booking)}
            onToggleSms={(booking) => void toggleSms(booking)}
            onStatusChange={(booking, status) => void changeStatus(booking, status)}
            onClearVisit={(booking) => void clearVisit(booking)}
          />
        </main>
      ) : (
        <main className="workspace workspace-day">
          <section className="board">
            <DayGrid
              date={day.date}
              bookings={dayBookings}
              filters={filters}
              dayStart={grid.dayStart}
              dayEnd={grid.dayEnd}
              slotMinutes={grid.slotMinutes}
              selectedCode={selectedCode}
              dragCode={dragCode}
              dropTarget={dropTarget}
              onSelect={setSelectedCode}
              onEdit={openEdit}
              onContextMenu={(booking, x, y) => setContextMenu({ booking, x, y })}
              onDragStart={setDragCode}
              onDragEnd={() => {
                setDragCode(null)
                setDropTarget(null)
              }}
              onDropOnSlot={handleDrop}
              onHoverSlot={setDropTarget}
              onAddToSlot={openCreate}
            />
          </section>

          <DetailsPanel
            booking={selected}
            onClose={() => setSelectedCode(null)}
            onEdit={openEdit}
            onDelete={(booking) => void deleteBooking(booking, settings.defaultDeleteMode)}
            onToggleCalled={(booking) => void toggleCalled(booking)}
            onToggleSms={(booking) => void toggleSms(booking)}
            onStatusChange={(booking, status) => void changeStatus(booking, status)}
            onClearVisit={(booking) => void clearVisit(booking)}
          />
        </main>
      )}

      {dialog ? (
        <BookingDialog
          seed={dialog}
          services={day.day.services}
          dayStart={grid.dayStart}
          dayEnd={grid.dayEnd}
          slotMinutes={grid.slotMinutes}
          saving={saving}
          onSubmit={(input) => void submitDialog(input)}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsDialog
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={async (patch) => {
            const next = await window.crm.saveSettings(patch)
            setSettings(next)
            setSettingsOpen(false)
            push('success', 'Настройки сохранены')
          }}
        />
      ) : null}

      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextActions}
          onClose={() => setContextMenu(null)}
        />
      ) : null}

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

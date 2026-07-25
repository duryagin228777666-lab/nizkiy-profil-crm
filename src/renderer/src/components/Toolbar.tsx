import { forwardRef } from 'react'
import { countActiveFilters, EMPTY_FILTERS, type Filters } from '../lib/filters'
import { formatDateShort, relativeDayLabel, shiftDate, todayIso } from '../../../shared/time'
import type { AppPage, ConnectionMode } from '../../../shared/types'
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings
} from './Icons'

interface Props {
  page: AppPage
  onPageChange: (page: AppPage) => void
  inboxCount: number
  date: string
  onDateChange: (date: string) => void
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  services: string[]
  loading: boolean
  mode: ConnectionMode
  lastSync: Date | null
  shownCount: number
  totalCount: number
  onRefresh: () => void
  onCreate: () => void
  onOpenSettings: () => void
}

export const Toolbar = forwardRef<HTMLInputElement, Props>(function Toolbar(
  {
    page,
    onPageChange,
    inboxCount,
    date,
    onDateChange,
    filters,
    onFiltersChange,
    services,
    loading,
    mode,
    lastSync,
    shownCount,
    totalCount,
    onRefresh,
    onCreate,
    onOpenSettings
  },
  searchRef
) {
  const relative = relativeDayLabel(date)
  const activeFilters = countActiveFilters(filters)
  const patch = (part: Partial<Filters>): void => onFiltersChange({ ...filters, ...part })

  return (
    <header className="toolbar">
      <div className="toolbar-row">
        <nav className="page-tabs" aria-label="Разделы">
          <button
            type="button"
            className={`page-tab${page === 'day' ? ' is-on' : ''}`}
            onClick={() => onPageChange('day')}
            title="Расписание дня (Ctrl+1)"
          >
            Расписание
          </button>
          <button
            type="button"
            className={`page-tab${page === 'inbox' ? ' is-on' : ''}`}
            onClick={() => onPageChange('inbox')}
            title="Необработанные заявки (Ctrl+2)"
          >
            Необработанные
            {inboxCount > 0 ? <span className="page-tab-badge">{inboxCount}</span> : null}
          </button>
        </nav>

        {page === 'day' ? (
          <div className="daynav">
            <button
              type="button"
              className="icon-btn"
              title="Предыдущий день (←)"
              onClick={() => onDateChange(shiftDate(date, -1))}
            >
              <IconChevronLeft />
            </button>
            <div className="daynav-label">
              <input
                type="date"
                className="daynav-date"
                value={date}
                onChange={(event) => event.target.value && onDateChange(event.target.value)}
              />
              <span className="daynav-text">
                {formatDateShort(date)}
                {relative ? <em>{relative}</em> : null}
              </span>
            </div>
            <button
              type="button"
              className="icon-btn"
              title="Следующий день (→)"
              onClick={() => onDateChange(shiftDate(date, 1))}
            >
              <IconChevronRight />
            </button>
            <button
              type="button"
              className="ghost-btn"
              title="Сегодня (T)"
              disabled={date === todayIso()}
              onClick={() => onDateChange(todayIso())}
            >
              Сегодня
            </button>
          </div>
        ) : null}

        <div className="toolbar-spacer" />

        <label className="search">
          <IconSearch size={14} />
          <input
            ref={searchRef}
            type="search"
            placeholder="Имя, телефон или код…  (Ctrl+F)"
            value={filters.query}
            onChange={(event) => patch({ query: event.target.value })}
          />
          {filters.query ? (
            <button type="button" className="search-clear" title="Очистить" onClick={() => patch({ query: '' })}>
              <IconClose size={13} />
            </button>
          ) : null}
        </label>

        <button type="button" className="primary-btn" title="Новый клиент (N)" onClick={onCreate}>
          <IconPlus size={15} />
          Новый клиент
        </button>
        <button type="button" className="icon-btn" title="Обновить (F5)" onClick={onRefresh} disabled={loading}>
          <IconRefresh className={loading ? 'spin' : undefined} />
        </button>
        <button type="button" className="icon-btn" title="Настройки (Ctrl+,)" onClick={onOpenSettings}>
          <IconSettings />
        </button>
      </div>

      <div className="toolbar-row toolbar-filters">
        <button
          type="button"
          className={`chip-btn${filters.onlyNotCalled ? ' is-on' : ''}`}
          onClick={() => patch({ onlyNotCalled: !filters.onlyNotCalled })}
        >
          Не обзвонены
        </button>
        {page === 'day' ? (
          <button
            type="button"
            className={`chip-btn${filters.onlyNoSms ? ' is-on' : ''}`}
            onClick={() => patch({ onlyNoSms: !filters.onlyNoSms })}
          >
            Без SMS
          </button>
        ) : null}
        <button
          type="button"
          className={`chip-btn${filters.onlyActive ? ' is-on' : ''}`}
          onClick={() => patch({ onlyActive: !filters.onlyActive })}
        >
          Только активные
        </button>

        <select
          className="select-sm"
          value={filters.service}
          onChange={(event) => patch({ service: event.target.value })}
        >
          <option value="">Все услуги</option>
          {services.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>

        {activeFilters > 0 ? (
          <button type="button" className="link-btn" onClick={() => onFiltersChange(EMPTY_FILTERS)}>
            Сбросить фильтры ({activeFilters})
          </button>
        ) : null}

        <div className="toolbar-spacer" />

        <span className="counter">
          показано <b>{shownCount}</b> из {totalCount}
        </span>
        <span
          className={`conn conn-${mode}`}
          title={mode === 'mock' ? 'Демо-данные на этом компьютере' : 'Заявки с сервера сервиса'}
        >
          {mode === 'mock' ? 'Демо-режим' : 'Сервер'}
        </span>
        <span className="sync">
          {loading ? 'обновление…' : lastSync ? `обновлено ${lastSync.toLocaleTimeString('ru-RU')}` : '—'}
        </span>
      </div>
    </header>
  )
})

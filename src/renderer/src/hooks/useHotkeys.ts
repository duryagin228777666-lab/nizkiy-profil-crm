import { useEffect, useRef } from 'react'

export interface HotkeyHandlers {
  newBooking: () => void
  edit: () => void
  remove: () => void
  toggleCalled: () => void
  toggleSms: () => void
  refresh: () => void
  prevDay: () => void
  nextDay: () => void
  today: () => void
  focusSearch: () => void
  moveSelection: (delta: number) => void
  escape: () => void
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Горячие клавиши рабочего места. Пока курсор в поле ввода, работают только
 * Esc и Ctrl-сочетания: иначе имя клиента невозможно было бы напечатать.
 */
export function useHotkeys(handlers: HotkeyHandlers, blocked: boolean): void {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const h = ref.current
      const typing = isTyping(event.target)
      const mod = event.ctrlKey || event.metaKey

      if (event.key === 'Escape') {
        h.escape()
        return
      }

      if (mod && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        h.focusSearch()
        return
      }
      if (event.key === 'F5' || (mod && event.key.toLowerCase() === 'r')) {
        event.preventDefault()
        h.refresh()
        return
      }

      if (typing || blocked) return

      switch (event.key) {
        case 'n':
        case 'N':
        case 'т':
        case 'Т':
          event.preventDefault()
          h.newBooking()
          break
        case 'Enter':
          event.preventDefault()
          h.edit()
          break
        case 'Delete':
          event.preventDefault()
          h.remove()
          break
        case 'c':
        case 'C':
        case 'с':
        case 'С':
          event.preventDefault()
          h.toggleCalled()
          break
        case 's':
        case 'S':
        case 'ы':
        case 'Ы':
          event.preventDefault()
          h.toggleSms()
          break
        case 't':
        case 'T':
        case 'е':
        case 'Е':
          event.preventDefault()
          h.today()
          break
        case 'ArrowLeft':
          event.preventDefault()
          h.prevDay()
          break
        case 'ArrowRight':
          event.preventDefault()
          h.nextDay()
          break
        case 'ArrowDown':
          event.preventDefault()
          h.moveSelection(1)
          break
        case 'ArrowUp':
          event.preventDefault()
          h.moveSelection(-1)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [blocked])
}

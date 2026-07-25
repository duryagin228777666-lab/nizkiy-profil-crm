import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface MenuAction {
  label: string
  onClick: () => void
  danger?: boolean
  separatorBefore?: boolean
}

interface Props {
  x: number
  y: number
  actions: MenuAction[]
  onClose: () => void
}

export function ContextMenu({ x, y, actions, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ x, y })

  // Меню у правого/нижнего края окна разворачиваем внутрь, чтобы оно не обрезалось
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    setPos({
      x: Math.min(x, window.innerWidth - box.width - 8),
      y: Math.min(y, window.innerHeight - box.height - 8)
    })
  }, [x, y, actions.length])

  useEffect(() => {
    const close = (): void => onClose()
    window.addEventListener('mousedown', close)
    window.addEventListener('resize', close)
    window.addEventListener('wheel', close, { passive: true })
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('wheel', close)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="ctxmenu"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(event) => event.stopPropagation()}
      role="menu"
    >
      {actions.map((action, index) => (
        <div key={action.label}>
          {action.separatorBefore && index > 0 ? <hr /> : null}
          <button
            type="button"
            role="menuitem"
            className={action.danger ? 'is-danger' : undefined}
            onClick={() => {
              action.onClick()
              onClose()
            }}
          >
            {action.label}
          </button>
        </div>
      ))}
    </div>
  )
}

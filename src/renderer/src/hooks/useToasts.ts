import { useCallback, useRef, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  text: string
}

const LIFETIME: Record<ToastKind, number> = {
  success: 2500,
  info: 3000,
  // Ошибку показываем дольше: администратор может смотреть не на экран
  error: 8000
}

export function useToasts(): {
  toasts: Toast[]
  push: (kind: ToastKind, text: string) => void
  dismiss: (id: number) => void
} {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, text: string) => {
      const id = nextId.current
      nextId.current += 1
      setToasts((current) => [...current.slice(-3), { id, kind, text }])
      window.setTimeout(() => dismiss(id), LIFETIME[kind])
    },
    [dismiss]
  )

  return { toasts, push, dismiss }
}

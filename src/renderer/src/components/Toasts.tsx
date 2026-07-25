import type { Toast } from '../hooks/useToasts'
import { IconAlert, IconCheck, IconClose } from './Icons'

interface Props {
  toasts: Toast[]
  onDismiss: (id: number) => void
}

export function Toasts({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
          {toast.kind === 'error' ? <IconAlert size={15} /> : <IconCheck size={15} />}
          <span>{toast.text}</span>
          <button type="button" onClick={() => onDismiss(toast.id)} title="Скрыть">
            <IconClose size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}

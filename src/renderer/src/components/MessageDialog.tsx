import { useEffect, useRef, useState } from 'react'
import { CHANNEL_LABEL, CHANNEL_ORDER } from '../../../shared/constants'
import { formatVisitHuman } from '../../../shared/time'
import type { Booking, ChannelAvailability, NotifyChannel } from '../../../shared/types'
import { IconClose } from './Icons'

const MAX_LENGTH = 1000

interface Props {
  booking: Booking
  channels: ChannelAvailability
  sending: boolean
  /** Готовый текст и канал — например, приглашение в Telegram через WhatsApp */
  draft?: { text: string; channel: NotifyChannel }
  onSend: (text: string, channel: NotifyChannel) => void
  onClose: () => void
}

/** Telegram доступен только тем, кто сам открыл бота. */
export function channelUsable(booking: Booking, channels: ChannelAvailability, channel: NotifyChannel): boolean {
  if (!channels[channel]) return false
  return channel !== 'telegram' || booking.tg_linked
}

/** Канал по умолчанию — как messaging.resolve_channel на сервере. */
export function defaultChannel(booking: Booking, channels: ChannelAvailability): NotifyChannel | null {
  if (booking.notify_channel && channelUsable(booking, channels, booking.notify_channel)) {
    return booking.notify_channel
  }
  return CHANNEL_ORDER.find((channel) => channelUsable(booking, channels, channel)) ?? null
}

function templates(booking: Booking): Array<{ label: string; text: string }> {
  const when = booking.visit_at ? formatVisitHuman(booking.visit_at) : 'в удобное вам время'
  return [
    {
      label: 'Ждём вас',
      text: `Здравствуйте, ${booking.name}! Шиномонтаж «Низкий профиль» ждёт вас ${when} (${booking.service}).`
    },
    {
      label: 'Машина готова',
      text: `Здравствуйте, ${booking.name}! Работы по услуге «${booking.service}» завершены — можно забирать.`
    },
    {
      label: 'Перенос',
      text: `Здравствуйте, ${booking.name}! К сожалению, придётся перенести визит. Подскажите, когда вам удобно?`
    }
  ]
}

export function MessageDialog({ booking, channels, sending, draft, onSend, onClose }: Props) {
  const [text, setText] = useState(draft?.text ?? '')
  const [channel, setChannel] = useState<NotifyChannel | null>(() =>
    draft && channelUsable(booking, channels, draft.channel) ? draft.channel : defaultChannel(booking, channels)
  )
  const textRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  const trimmed = text.trim()
  const canSend = Boolean(channel) && trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !sending

  function submit(): void {
    if (canSend && channel) onSend(trimmed, channel)
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <h2>Сообщение · {booking.name}</h2>
          <button type="button" className="icon-btn" onClick={onClose} title="Закрыть (Esc)">
            <IconClose />
          </button>
        </header>

        <form
          className="modal-body form"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <label className="field field-wide">
            <span>Канал</span>
            <select
              value={channel ?? ''}
              onChange={(event) => setChannel((event.target.value || null) as NotifyChannel | null)}
            >
              {channel ? null : <option value="">— нет доступного канала —</option>}
              {CHANNEL_ORDER.map((option) => (
                <option key={option} value={option} disabled={!channelUsable(booking, channels, option)}>
                  {CHANNEL_LABEL[option]}
                  {option === 'telegram' && !booking.tg_linked ? ' (клиент не открывал бота)' : ''}
                  {option !== 'telegram' && !channels[option] ? ' (не подключено)' : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="field field-wide template-row">
            {templates(booking).map((template) => (
              <button key={template.label} type="button" className="ghost-btn" onClick={() => setText(template.text)}>
                {template.label}
              </button>
            ))}
          </div>

          <label className="field field-wide">
            <span>Текст</span>
            <textarea
              ref={textRef}
              rows={5}
              value={text}
              maxLength={MAX_LENGTH}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault()
                  submit()
                }
              }}
              placeholder="Текст сообщения клиенту"
            />
          </label>
        </form>

        <footer className="modal-foot">
          <span className="hint">
            {trimmed.length}/{MAX_LENGTH} · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> отправить
          </span>
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="primary-btn" onClick={submit} disabled={!canSend}>
              {sending ? 'Отправляем…' : 'Отправить'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

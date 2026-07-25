import type { ReactElement, ReactNode } from 'react'

interface IconProps {
  size?: number
  className?: string
}

function svg(path: ReactNode, { size = 16, className }: IconProps): ReactElement {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  )
}

export const IconPhone = (p: IconProps): ReactElement =>
  svg(
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />,
    p
  )

export const IconMail = (p: IconProps): ReactElement =>
  svg(
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </>,
    p
  )

export const IconPlus = (p: IconProps): ReactElement => svg(<path d="M12 5v14M5 12h14" />, p)

export const IconRefresh = (p: IconProps): ReactElement =>
  svg(
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
    </>,
    p
  )

export const IconChevronLeft = (p: IconProps): ReactElement => svg(<path d="m15 18-6-6 6-6" />, p)
export const IconChevronRight = (p: IconProps): ReactElement => svg(<path d="m9 18 6-6-6-6" />, p)

export const IconSearch = (p: IconProps): ReactElement =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>,
    p
  )

export const IconClose = (p: IconProps): ReactElement => svg(<path d="M18 6 6 18M6 6l12 12" />, p)

export const IconEdit = (p: IconProps): ReactElement =>
  svg(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>,
    p
  )

export const IconTrash = (p: IconProps): ReactElement =>
  svg(
    <>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </>,
    p
  )

export const IconClock = (p: IconProps): ReactElement =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
    p
  )

export const IconSettings = (p: IconProps): ReactElement =>
  svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>,
    p
  )

export const IconCheck = (p: IconProps): ReactElement => svg(<path d="m20 6-11 11-5-5" />, p)

export const IconAlert = (p: IconProps): ReactElement =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </>,
    p
  )

export const IconUser = (p: IconProps): ReactElement =>
  svg(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>,
    p
  )

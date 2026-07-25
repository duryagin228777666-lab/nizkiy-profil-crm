/** Нормализация и показ российских номеров телефона. */

export function phoneDigits(value: string): string {
  return (value || '').replace(/\D/g, '')
}

/**
 * Привести номер к 11 цифрам с ведущей 7: '8 (999) 123-45-67', '9991234567',
 * '+7 999 1234567' → '79991234567'. Возвращает '' если номер непохож на российский.
 */
export function normalizePhone(value: string): string {
  let digits = phoneDigits(value)
  if (digits.length === 10) digits = `7${digits}`
  else if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`
  if (digits.length !== 11 || !digits.startsWith('7')) return ''
  return digits
}

export function isValidPhone(value: string): boolean {
  return normalizePhone(value) !== ''
}

/** '79991234567' → '+7 (999) 123-45-67'. Неразобранный номер возвращаем как есть. */
export function formatPhone(value: string): string {
  const digits = normalizePhone(value)
  if (!digits) return (value || '').trim()
  const d = digits.slice(1)
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`
}

/** Ссылка для звонка с рабочего компьютера / софтфона. */
export function telHref(value: string): string {
  const digits = normalizePhone(value)
  return digits ? `tel:+${digits}` : `tel:${phoneDigits(value)}`
}

/** Маска для набора по мере ввода в форме. */
export function maskPhoneInput(value: string): string {
  let digits = phoneDigits(value)
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`
  if (!digits.startsWith('7')) digits = `7${digits}`
  digits = digits.slice(0, 11)
  const rest = digits.slice(1)
  if (!rest) return '+7 '
  if (rest.length <= 3) return `+7 (${rest}`
  if (rest.length <= 6) return `+7 (${rest.slice(0, 3)}) ${rest.slice(3)}`
  if (rest.length <= 8) return `+7 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`
  return `+7 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 8)}-${rest.slice(8, 10)}`
}

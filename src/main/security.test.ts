import { describe, expect, test } from 'vitest'
import { sanitizeApiPath, sanitizeGreenApiUrl } from './security'

describe('sanitizeGreenApiUrl', () => {
  test.each([
    ['https://api.green-api.com', 'https://api.green-api.com'],
    ['https://7103.api.greenapi.com/', 'https://7103.api.greenapi.com'],
    ['https://7103.API.GREENAPI.com/waInstance1', 'https://7103.api.greenapi.com']
  ])('accepts %s', (raw, expected) => {
    expect(sanitizeGreenApiUrl(raw)).toBe(expected)
  })

  test.each([
    'http://api.green-api.com',
    'https://api.green-api.com.evil.ru',
    'https://evil.ru/api.green-api.com',
    'https://user:pass@api.green-api.com',
    'https://api.green-api.com:8443',
    'not a url'
  ])('rejects %s so the instance token cannot leak', (raw) => {
    expect(sanitizeGreenApiUrl(raw)).toBeNull()
  })
})

describe('sanitizeApiPath', () => {
  test('allows the local API routes', () => {
    expect(sanitizeApiPath('/bookings?date=2026-11-03')).toBe('/bookings?date=2026-11-03')
    expect(sanitizeApiPath('/bookings/AB3K9/message')).toBe('/bookings/AB3K9/message')
  })

  test('rejects traversal and unknown routes', () => {
    expect(sanitizeApiPath('/bookings/../settings')).toBeNull()
    expect(sanitizeApiPath('/secrets')).toBeNull()
  })
})

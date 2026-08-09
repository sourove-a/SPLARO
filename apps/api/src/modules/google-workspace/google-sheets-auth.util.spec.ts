import { isSheetsAuthFailure, parseServiceAccountEnabled } from './google-sheets-auth.util'

describe('isSheetsAuthFailure', () => {
  it('detects missing refresh token', () => {
    expect(isSheetsAuthFailure('Google refresh token missing. Reconnect your Google account.')).toBe(true)
  })

  it('detects service-account key problems', () => {
    expect(isSheetsAuthFailure('Google service account key file not found.')).toBe(true)
  })

  it('does not treat transient API errors as auth failure', () => {
    expect(isSheetsAuthFailure('Quota exceeded for quota metric')).toBe(false)
    expect(isSheetsAuthFailure('The service is currently unavailable')).toBe(false)
  })
})

describe('parseServiceAccountEnabled', () => {
  it('treats explicit false as off', () => {
    expect(parseServiceAccountEnabled('false')).toBe(false)
    expect(parseServiceAccountEnabled('OFF')).toBe(false)
  })

  it('treats true / unset distinctly', () => {
    expect(parseServiceAccountEnabled('true')).toBe(true)
    expect(parseServiceAccountEnabled(undefined)).toBeNull()
  })
})

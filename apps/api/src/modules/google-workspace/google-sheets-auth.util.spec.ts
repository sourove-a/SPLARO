import {
  isSheetsAuthFailure,
  parseServiceAccountEnabled,
  readEncryptedRefreshToken,
  REFRESH_TOKEN_MISSING,
  resolveSheetsDisplayHealth,
  withinSheetsHealthWindow,
} from './google-sheets-auth.util'

describe('isSheetsAuthFailure', () => {
  it('detects missing refresh token', () => {
    expect(isSheetsAuthFailure('Google refresh token missing. Reconnect your Google account.')).toBe(true)
  })

  it('detects invalid_grant and expired tokens', () => {
    expect(isSheetsAuthFailure('invalid_grant')).toBe(true)
    expect(isSheetsAuthFailure('Token has been expired or revoked.')).toBe(true)
  })

  it('detects service-account key problems', () => {
    expect(isSheetsAuthFailure('Google service account key file not found.')).toBe(true)
  })

  it('does not treat transient API errors as auth failure', () => {
    expect(isSheetsAuthFailure('Quota exceeded for quota metric')).toBe(false)
    expect(isSheetsAuthFailure('The service is currently unavailable')).toBe(false)
  })
})

describe('readEncryptedRefreshToken', () => {
  it('rejects ciphertext that decrypts to empty', () => {
    expect(readEncryptedRefreshToken('enc:blob', () => '   ')).toEqual({
      ok: false,
      reason: REFRESH_TOKEN_MISSING,
    })
  })

  it('returns the decrypted token', () => {
    expect(readEncryptedRefreshToken('enc:blob', (v) => `plain-${v}`)).toEqual({
      ok: true,
      token: 'plain-enc:blob',
    })
  })
})

describe('resolveSheetsDisplayHealth', () => {
  it('uses job log auth failures over a stored healthy flag', () => {
    const result = resolveSheetsDisplayHealth({
      storedHealth: 'healthy',
      oauthDecryptable: true,
      recentJobs: Array.from({ length: 30 }, () => ({
        status: 'failed',
        errorMsg: 'Google refresh token missing. Reconnect your Google account.',
      })),
    })
    expect(result.health).toBe('needs_reconnect')
    expect(result.recentFailed).toBe(30)
    expect(result.recentSucceeded).toBe(0)
  })

  it('marks non-auth majority failures as degraded', () => {
    const result = resolveSheetsDisplayHealth({
      storedHealth: 'healthy',
      oauthDecryptable: true,
      recentJobs: [
        { status: 'failed', errorMsg: 'Quota exceeded' },
        { status: 'failed', errorMsg: 'The service is currently unavailable' },
      ],
    })
    expect(result.health).toBe('degraded')
  })

  it('does not treat ciphertext-only as healthy when oauth is not decryptable', () => {
    const result = resolveSheetsDisplayHealth({
      storedHealth: 'healthy',
      oauthDecryptable: false,
      recentJobs: [],
    })
    expect(result.health).toBe('needs_reconnect')
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

describe('sheets health window', () => {
  const DAY = 24 * 60 * 60 * 1000
  const now = Date.UTC(2026, 7, 20, 12, 0, 0)

  it('drops jobs older than the window so a dead failure cannot pin the badge red', () => {
    const jobs = [
      { status: 'failed', errorMsg: 'old guard', createdAt: new Date(now - 5 * DAY) },
      { status: 'failed', errorMsg: 'ancient', createdAt: new Date(now - 30 * DAY) },
    ]
    expect(withinSheetsHealthWindow(jobs, now)).toHaveLength(1)
  })

  it('keeps rows with no timestamp rather than silently discarding them', () => {
    expect(
      withinSheetsHealthWindow([{ status: 'completed', createdAt: null }], now),
    ).toHaveLength(1)
  })

  it('reports healthy once every failure has aged out of the window', () => {
    const stale = [{ status: 'failed', errorMsg: 'gone', createdAt: new Date(now - 20 * DAY) }]
    const health = resolveSheetsDisplayHealth({
      storedHealth: 'healthy',
      saMode: true,
      recentJobs: withinSheetsHealthWindow(stale, now),
    })
    expect(health.recentTotal).toBe(0)
    expect(health.health).not.toBe('degraded')
  })
})

describe('stale failure vs newer success', () => {
  const DAY = 24 * 60 * 60 * 1000
  const now = Date.UTC(2026, 7, 20, 12, 0, 0)

  it('is not degraded when the store synced after the last failure', () => {
    const health = resolveSheetsDisplayHealth({
      storedHealth: 'healthy',
      saMode: true,
      recentJobs: [{ status: 'failed', errorMsg: 'old guard', createdAt: new Date(now - 5 * DAY) }],
      lastSuccessAt: new Date(now - 2 * DAY),
    })
    expect(health.staleFailure).toBe(true)
    expect(health.health).toBe('healthy')
  })

  it('stays degraded when the failure is the newest signal', () => {
    const health = resolveSheetsDisplayHealth({
      storedHealth: 'healthy',
      saMode: true,
      recentJobs: [{ status: 'failed', errorMsg: 'real', createdAt: new Date(now - 1 * DAY) }],
      lastSuccessAt: new Date(now - 5 * DAY),
    })
    expect(health.staleFailure).toBe(false)
    expect(health.health).toBe('degraded')
  })

  it('counts a successful job row as a success even with no connection timestamp', () => {
    const health = resolveSheetsDisplayHealth({
      storedHealth: 'healthy',
      saMode: true,
      recentJobs: [
        { status: 'failed', errorMsg: 'older', createdAt: new Date(now - 3 * DAY) },
        { status: 'completed', createdAt: new Date(now - 1 * DAY) },
      ],
    })
    expect(health.staleFailure).toBe(true)
    expect(health.health).toBe('healthy')
  })
})

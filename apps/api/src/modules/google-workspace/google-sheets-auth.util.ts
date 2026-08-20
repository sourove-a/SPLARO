/** Auth failures that retrying will never fix — pause live sync instead of spamming. */
const AUTH_FAILURE_SNIPPETS = [
  'refresh token missing',
  'refresh token could not be decrypted',
  'google account not connected',
  'reconnect your google account',
  'gmail oauth not connected',
  'service account key',
  'service account not configured',
  'did not return a refresh token',
  'invalid_grant',
  'token has been expired or revoked',
  'token expired or revoked',
  'invalid credentials',
]

export function isSheetsAuthFailure(message: string | null | undefined): boolean {
  if (!message?.trim()) return false
  const lower = message.toLowerCase()
  return AUTH_FAILURE_SNIPPETS.some((snippet) => lower.includes(snippet))
}

export function parseServiceAccountEnabled(raw: string | undefined | null): boolean | null {
  const flag = raw?.trim().toLowerCase()
  if (!flag) return null
  if (['false', '0', 'off', 'no'].includes(flag)) return false
  if (['true', '1', 'on', 'yes'].includes(flag)) return true
  return null
}

export const REFRESH_TOKEN_MISSING =
  'Google refresh token missing. Reconnect your Google account.'
export const REFRESH_TOKEN_DECRYPT_FAILED =
  'Google refresh token could not be decrypted. Reconnect your Google account.'

export function readEncryptedRefreshToken(
  ciphertext: string | null | undefined,
  decrypt: (value: string) => string,
): { ok: true; token: string } | { ok: false; reason: string } {
  if (!ciphertext?.trim()) {
    return { ok: false, reason: REFRESH_TOKEN_MISSING }
  }
  try {
    const token = decrypt(ciphertext).trim()
    if (!token) return { ok: false, reason: REFRESH_TOKEN_MISSING }
    return { ok: true, token }
  } catch {
    return { ok: false, reason: REFRESH_TOKEN_DECRYPT_FAILED }
  }
}

export type SheetsDisplayHealth = 'healthy' | 'needs_reconnect' | 'degraded' | 'missing'

export interface RecentSyncJobLike {
  status: string
  errorMsg?: string | null
  /** Used to drop jobs older than the health window — see withinSheetsHealthWindow. */
  createdAt?: Date | string | null
}

function jobFailed(status: string): boolean {
  const s = status.toLowerCase()
  return s === 'failed' || s === 'error'
}

function jobSucceeded(status: string): boolean {
  const s = status.toLowerCase()
  return s === 'success' || s === 'completed' || s === 'ok'
}

function storedHealth(
  raw: string | null | undefined,
): SheetsDisplayHealth | null {
  const value = raw?.trim().toLowerCase()
  if (!value) return null
  if (value === 'healthy' || value === 'ok') return 'healthy'
  if (value === 'degraded') return 'degraded'
  if (value === 'missing') return 'missing'
  if (
    value === 'needs_reconnect' ||
    value === 'expired' ||
    value === 'revoked' ||
    value === 'unhealthy'
  ) {
    return 'needs_reconnect'
  }
  return null
}

/**
 * Displayed token health. Recent job failures always win over a stored
 * "healthy" flag or a ciphertext-only OAuth row.
 */
/**
 * A job older than this stops counting toward "is sync healthy right now".
 *
 * Without a window the card was permanently red: the store's last twenty jobs
 * were failures from five days earlier, thrown by a guard that no longer exists
 * in the code, and nothing had run since. "0/20 last jobs succeeded" was true
 * and useless — it described a version of the system that is gone.
 */
export const SHEETS_HEALTH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/** Jobs inside the health window, newest first. Rows with no date are kept. */
export function withinSheetsHealthWindow<T extends { createdAt?: Date | string | null }>(
  jobs: T[],
  now: number = Date.now(),
): T[] {
  return jobs.filter((job) => {
    if (!job.createdAt) return true
    const at = job.createdAt instanceof Date ? job.createdAt : new Date(job.createdAt)
    if (Number.isNaN(at.getTime())) return true
    return now - at.getTime() <= SHEETS_HEALTH_WINDOW_MS
  })
}

/** Newest `createdAt` among the given jobs, or null when none carry one. */
function newestJobAt(jobs: RecentSyncJobLike[], match: (job: RecentSyncJobLike) => boolean): number | null {
  let newest: number | null = null
  for (const job of jobs) {
    if (!match(job) || !job.createdAt) continue
    const at = job.createdAt instanceof Date ? job.createdAt : new Date(job.createdAt)
    if (Number.isNaN(at.getTime())) continue
    if (newest === null || at.getTime() > newest) newest = at.getTime()
  }
  return newest
}

export function resolveSheetsDisplayHealth(input: {
  storedHealth?: string | null
  oauthDecryptable?: boolean | null
  saMode?: boolean
  recentJobs: RecentSyncJobLike[]
  /**
   * When the store last completed a sync — from the connection row or the
   * per-tab log. Job rows only record failures on some paths, so without this
   * a store whose tabs all synced yesterday still looked broken because the
   * newest *job* row was an old failure.
   */
  lastSuccessAt?: Date | string | null
}): {
  health: SheetsDisplayHealth
  lastJobError: string | null
  recentFailed: number
  recentSucceeded: number
  recentTotal: number
  /** True when the newest failure is older than the newest success. */
  staleFailure: boolean
} {
  const jobs = input.recentJobs
  const recentTotal = jobs.length
  const recentFailed = jobs.filter((j) => jobFailed(j.status)).length
  const recentSucceeded = jobs.filter((j) => jobSucceeded(j.status)).length
  const lastFailed = jobs.find((j) => jobFailed(j.status))
  const lastJobError = lastFailed?.errorMsg?.trim() || null
  const successAt = (() => {
    if (!input.lastSuccessAt) return null
    const at = input.lastSuccessAt instanceof Date ? input.lastSuccessAt : new Date(input.lastSuccessAt)
    return Number.isNaN(at.getTime()) ? null : at.getTime()
  })()
  const jobSuccessAt = newestJobAt(jobs, (j) => jobSucceeded(j.status))
  const newestSuccess = Math.max(successAt ?? 0, jobSuccessAt ?? 0) || null
  const newestFailure = newestJobAt(jobs, (j) => jobFailed(j.status))
  // A failure only describes the present while nothing has succeeded since.
  const staleFailure =
    newestFailure !== null && newestSuccess !== null && newestSuccess > newestFailure

  const majorityFailed = !staleFailure && recentTotal > 0 && recentFailed * 2 >= recentTotal
  const authFailing =
    majorityFailed &&
    jobs.some((j) => jobFailed(j.status) && isSheetsAuthFailure(j.errorMsg))

  if (authFailing) {
    return {
      health: 'needs_reconnect',
      lastJobError,
      recentFailed,
      recentSucceeded,
      recentTotal,
      staleFailure,
    }
  }
  if (majorityFailed) {
    return {
      health: 'degraded',
      lastJobError,
      recentFailed,
      recentSucceeded,
      recentTotal,
      staleFailure,
    }
  }

  if (!input.saMode && input.oauthDecryptable === false) {
    return {
      health: storedHealth(input.storedHealth) === 'missing' ? 'missing' : 'needs_reconnect',
      lastJobError,
      recentFailed,
      recentSucceeded,
      recentTotal,
      staleFailure,
    }
  }

  const stored = storedHealth(input.storedHealth)
  if (stored && stored !== 'healthy') {
    return { health: stored, lastJobError, recentFailed, recentSucceeded, recentTotal, staleFailure }
  }

  return {
    health: stored ?? 'healthy',
    lastJobError,
    staleFailure,
    recentFailed,
    recentSucceeded,
    recentTotal,
  }
}

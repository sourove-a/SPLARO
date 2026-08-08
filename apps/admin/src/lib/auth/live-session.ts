import { getServerApiBaseUrl } from '@splaro/config'

export type LiveAdminSessionProbe = 'ok' | 'rejected' | 'unreachable'

/**
 * Re-validate an HMAC admin cookie against live API state (isActive + staff role).
 * Network / 5xx → unreachable so a brief API blip does not lock the shell.
 */
export async function probeLiveAdminSession(token: string): Promise<LiveAdminSessionProbe> {
  try {
    const base = getServerApiBaseUrl().replace(/\/+$/, '')
    const res = await fetch(`${base}/admin/auth/me`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) return 'ok'
    if (res.status === 401 || res.status === 403) return 'rejected'
    return 'unreachable'
  } catch {
    return 'unreachable'
  }
}

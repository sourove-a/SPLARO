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

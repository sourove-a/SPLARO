/** Persist Google One Tap dismiss so closing the prompt does not nag again. */

const STORAGE_KEY = 'splaro.googleOneTap.dismissed.v1'

export function isGoogleOneTapDismissed(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissGoogleOneTap(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Private mode / quota — ignore; prompt may reappear this session only.
  }
}

export function clearGoogleOneTapDismiss(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Durable Google phone-completion URL — survives remount / soft nav. */

export function buildSignupPhonePath(nextPath = '/account'): string {
  const params = new URLSearchParams()
  params.set('phone', '1')
  if (nextPath && nextPath !== '/account') {
    params.set('next', nextPath)
  }
  return `/signup?${params.toString()}`
}

export function isSignupPhoneQuery(phoneParam: string | null): boolean {
  return phoneParam === '1' || phoneParam === 'true'
}

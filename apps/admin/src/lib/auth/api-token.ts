export const ADMIN_API_TOKEN_KEY = 'splaro_admin_api_token'

export function setAdminApiToken(token: string) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(ADMIN_API_TOKEN_KEY, token)
}

export function getAdminApiToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ADMIN_API_TOKEN_KEY)
}

export function clearAdminApiToken() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(ADMIN_API_TOKEN_KEY)
}

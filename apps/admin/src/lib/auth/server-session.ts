import { cookies } from 'next/headers'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from './session'

/** Returns a valid admin session token from the httpOnly cookie, or null. */
export async function getAdminSessionToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!token) return null
  const session = await verifyAdminSessionToken(token)
  return session ? token : null
}

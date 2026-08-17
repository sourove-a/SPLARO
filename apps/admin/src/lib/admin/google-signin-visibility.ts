/**
 * Google sign-in visibility on the admin login screen.
 *
 * Hidden for now — the Telegram one-time code is the only sign-in path shown.
 * Nothing was removed: GoogleAdminSignIn, /api/auth/google, the Nest
 * `admin/auth/google` endpoint and its allowlist checks all still work, so
 * flipping this to `true` brings the button back exactly as it was.
 */
export const ADMIN_GOOGLE_SIGNIN_VISIBLE = false

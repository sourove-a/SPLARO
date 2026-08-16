import { NextResponse } from 'next/server'

/**
 * Auth options the login screen may offer.
 *
 * An OAuth *client id* is public by design. Reading the server-side
 * GOOGLE_OAUTH_CLIENT_ID as a fallback means enabling Google sign-in on the VPS
 * needs an env value and a restart, not an admin rebuild.
 */
export async function GET() {
  const googleClientId =
    process.env['NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID']?.trim() ||
    process.env['GOOGLE_OAUTH_CLIENT_ID']?.trim() ||
    ''

  return NextResponse.json({
    googleClientId,
    googleSignInEnabled: Boolean(googleClientId),
  })
}

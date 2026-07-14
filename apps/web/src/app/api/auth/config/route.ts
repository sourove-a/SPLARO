import { NextResponse } from 'next/server'

/**
 * Single source of truth for storefront auth feature flags (client + BFF).
 *
 * OAuth *client id* is public by design (safe to return to the browser).
 * Nest verifies ID tokens with GOOGLE_OAUTH_CLIENT_ID from root `.env`.
 * Prefer NEXT_PUBLIC_* for the browser bake-in; fall back to server OAuth id
 * so production doesn't flash-then-hide Google when apps/web wasn't rebuilt
 * with NEXT_PUBLIC after env was added on the VPS.
 */
export async function GET() {
  const phoneOtpEnabled = process.env.STOREFRONT_PHONE_OTP_ENABLED === 'true'
  const googlePublicClientId =
    process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    ''
  const googleServerClientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    ''
  // Same public client id — storefront + API must share it.
  const googleClientId = googlePublicClientId || googleServerClientId

  return NextResponse.json({
    phoneOtpEnabled,
    googleClientId,
    googleSignInEnabled: Boolean(googleClientId),
    googleConfiguredOnApi: Boolean(googleServerClientId),
    googleConfiguredOnWeb: Boolean(googlePublicClientId),
  })
}

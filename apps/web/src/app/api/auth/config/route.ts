import { NextResponse } from 'next/server'

/**
 * Single source of truth for storefront auth feature flags (client + BFF).
 *
 * OAuth *client id* is public by design (safe to return to the browser).
 * Nest verifies ID tokens with GOOGLE_OAUTH_CLIENT_ID from root `.env`.
 * Button enablement follows NEXT_PUBLIC_* only (avoids flash-then-vanish when
 * the web process can't see root server env). Runtime client id may still
 * fall back to GOOGLE_OAUTH_CLIENT_ID so GIS works after VPS env without rebuild.
 */
export async function GET() {
  const phoneOtpEnabled = process.env.STOREFRONT_PHONE_OTP_ENABLED === 'true'
  const googlePublicClientId =
    process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    ''
  const googleServerClientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || ''
  // Prefer public bake-in; OAuth id (not admin GOOGLE_CLIENT_ID) as runtime fallback.
  const googleClientId = googlePublicClientId || googleServerClientId

  return NextResponse.json({
    phoneOtpEnabled,
    googleClientId,
    googleSignInEnabled: Boolean(googlePublicClientId),
    googleConfiguredOnApi: Boolean(googleServerClientId),
    googleConfiguredOnWeb: Boolean(googlePublicClientId),
  })
}

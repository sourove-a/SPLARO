import { NextResponse } from 'next/server'

/** Single source of truth for storefront auth feature flags (client + BFF). */
export async function GET() {
  const phoneOtpEnabled = process.env.STOREFRONT_PHONE_OTP_ENABLED === 'true'
  const googleClientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    ''
  const googlePublicClientId =
    process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    ''

  return NextResponse.json({
    phoneOtpEnabled,
    // Button needs only the PUBLIC client id — credential verification happens
    // in the Nest API (root .env), which the web process can't see. Requiring
    // the server-side id here made the button vanish after config load.
    googleSignInEnabled: Boolean(googlePublicClientId),
    googleConfiguredOnApi: Boolean(googleClientId),
    googleConfiguredOnWeb: Boolean(googlePublicClientId),
  })
}

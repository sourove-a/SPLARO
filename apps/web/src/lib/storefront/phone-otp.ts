/** Phone OTP for track-order — must match API STOREFRONT_PHONE_OTP_ENABLED. */
export function isStorefrontPhoneOtpEnabled(): boolean {
  if (typeof window === 'undefined') {
    return process.env.STOREFRONT_PHONE_OTP_ENABLED === 'true'
  }
  return process.env.NEXT_PUBLIC_STOREFRONT_PHONE_OTP_ENABLED === 'true'
}

/** Client-only: fetch BFF config so UI matches API flags. */
export async function fetchStorefrontAuthConfig(): Promise<{
  phoneOtpEnabled: boolean
  googleSignInEnabled: boolean
}> {
  try {
    const res = await fetch('/api/auth/config', { cache: 'no-store' })
    if (!res.ok) throw new Error('config unavailable')
    const payload = (await res.json()) as {
      phoneOtpEnabled?: boolean
      googleSignInEnabled?: boolean
    }
    return {
      phoneOtpEnabled: Boolean(payload.phoneOtpEnabled),
      googleSignInEnabled: Boolean(payload.googleSignInEnabled),
    }
  } catch {
    return {
      phoneOtpEnabled: isStorefrontPhoneOtpEnabled(),
      googleSignInEnabled: Boolean(process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID),
    }
  }
}

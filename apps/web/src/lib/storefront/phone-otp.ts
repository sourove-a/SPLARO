/** Phone OTP for track-order — must match API STOREFRONT_PHONE_OTP_ENABLED. */
export function isStorefrontPhoneOtpEnabled(): boolean {
  if (typeof window === 'undefined') {
    return process.env.STOREFRONT_PHONE_OTP_ENABLED === 'true'
  }
  return process.env.NEXT_PUBLIC_STOREFRONT_PHONE_OTP_ENABLED === 'true'
}

export type StorefrontAuthConfigPayload = {
  phoneOtpEnabled: boolean
  googleSignInEnabled: boolean
  googleClientId: string
}

/** Client-only: fetch BFF config so UI matches API flags. */
export async function fetchStorefrontAuthConfig(): Promise<StorefrontAuthConfigPayload> {
  const bakedGoogle =
    process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    ''
  try {
    const res = await fetch('/api/auth/config', { cache: 'no-store' })
    if (!res.ok) throw new Error('config unavailable')
    const payload = (await res.json()) as {
      phoneOtpEnabled?: boolean
      googleSignInEnabled?: boolean
      googleClientId?: string
    }
    const googleClientId = (payload.googleClientId ?? bakedGoogle).trim()
    return {
      phoneOtpEnabled: Boolean(payload.phoneOtpEnabled),
      googleClientId,
      // Enable from NEXT_PUBLIC bake-in / config flag only — never admin GOOGLE_CLIENT_ID.
      googleSignInEnabled: Boolean(payload.googleSignInEnabled) || Boolean(bakedGoogle),
    }
  } catch {
    return {
      phoneOtpEnabled: isStorefrontPhoneOtpEnabled(),
      googleClientId: bakedGoogle,
      googleSignInEnabled: Boolean(bakedGoogle),
    }
  }
}

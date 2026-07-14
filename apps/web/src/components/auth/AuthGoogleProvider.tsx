'use client'

import type { ReactNode } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthGoogleBridgeProvider } from '@/components/auth/auth-google-bridge'
import { useStorefrontAuthConfig } from '@/hooks/useStorefrontAuthConfig'

const BAKED_GOOGLE =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
  ''

export function AuthGoogleProvider({ children }: { children: ReactNode }) {
  const { googleClientId } = useStorefrontAuthConfig()
  const clientId = googleClientId || BAKED_GOOGLE
  const inner = <AuthGoogleBridgeProvider>{children}</AuthGoogleBridgeProvider>

  if (!clientId) return inner

  return <GoogleOAuthProvider clientId={clientId}>{inner}</GoogleOAuthProvider>
}

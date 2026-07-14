'use client'

import type { ReactNode } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthGoogleBridgeProvider } from '@/components/auth/auth-google-bridge'

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
  ''

export function AuthGoogleProvider({ children }: { children: ReactNode }) {
  const inner = <AuthGoogleBridgeProvider>{children}</AuthGoogleBridgeProvider>

  if (!GOOGLE_CLIENT_ID) return inner

  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{inner}</GoogleOAuthProvider>
}

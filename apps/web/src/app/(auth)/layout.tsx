import '@/styles/pages/auth.css'
import { AuthLayoutClient } from '@/components/auth/AuthLayoutClient'
import { createNoIndexMetadata } from '@/lib/seo/route-metadata'

export const metadata = createNoIndexMetadata('Sign in to SPLARO')

export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayoutClient>{children}</AuthLayoutClient>
}

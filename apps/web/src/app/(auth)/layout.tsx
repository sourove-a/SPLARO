import { AuthLayoutClient } from '@/components/auth/AuthLayoutClient'

export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayoutClient>{children}</AuthLayoutClient>
}

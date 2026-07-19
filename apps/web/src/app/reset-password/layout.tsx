import '@/styles/pages/auth.css'
import { createNoIndexMetadata } from '@/lib/seo/route-metadata'

export const metadata = createNoIndexMetadata('Reset Password')

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}

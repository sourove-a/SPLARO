import '@/styles/pages/auth.css'
import { createNoIndexMetadata } from '@/lib/seo/route-metadata'

export const metadata = createNoIndexMetadata('Forgot Password')

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}

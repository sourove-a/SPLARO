import '@/styles/pages/account.css'
import { createNoIndexMetadata } from '@/lib/seo/route-metadata'

export const metadata = createNoIndexMetadata('Your Account')

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children
}

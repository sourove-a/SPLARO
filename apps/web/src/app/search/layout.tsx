import '@/styles/pages/account.css'
import '@/styles/pages/content.css'
import '@/styles/pages/pdp.css'
import '@/styles/pages/shop.css'
import { createNoIndexMetadata } from '@/lib/seo/route-metadata'

export const metadata = createNoIndexMetadata('Search')

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}

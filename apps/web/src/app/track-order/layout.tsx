import '@/styles/pages/checkout.css'
import { createNoIndexMetadata } from '@/lib/seo/route-metadata'

export const metadata = createNoIndexMetadata('Track Order')

export default function TrackOrderLayout({ children }: { children: React.ReactNode }) {
  return children
}

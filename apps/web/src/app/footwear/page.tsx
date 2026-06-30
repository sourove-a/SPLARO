import type { Metadata } from 'next'
import { FootwearPage, type FootwearConfig } from '@/components/footwear/FootwearPage'
import configJson from '@/data/footwear-page-config.json'

export const metadata: Metadata = {
  title: 'Footwear | SPLARO',
  description: 'Luxury handcrafted footwear — loafers, sandals, heels and more.',
}

export const revalidate = 60

export default function FootwearRoute() {
  return <FootwearPage config={configJson as unknown as FootwearConfig} />
}

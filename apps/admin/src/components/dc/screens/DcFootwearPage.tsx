'use client'

import { useRouter } from 'next/navigation'

import { FootwearPagePanel } from '@/components/content/FootwearPagePanel'
import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { FONT } from '@/components/dc/tokens'

/** Content-tab Footwear screen — real config panel, no soft-lock. */
export function DcFootwearPage() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="footwear" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPageHead
        crumbGroup="Content"
        title="Footwear Page"
        statusLabel="LIVE"
        statusTone="ok"
        syncLabel="config"
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 32px' }}>
        <DcContentNav active="footwear" />
        <p style={{ margin: 0, font: `400 13px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
          Footwear page sections, banners, and visibility — saves via the content footwear API.
        </p>
        <FootwearPagePanel />
      </div>
    </DcScreenProvider>
  )
}

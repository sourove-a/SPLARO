'use client'

import dynamic from 'next/dynamic'

const IntelligencePanelClient = dynamic(
  () => import('@/components/layout/IntelligencePanel').then((m) => m.IntelligencePanel),
  {
    ssr: false,
    loading: () => null,
  },
)

export function IntelligencePanel() {
  return <IntelligencePanelClient />
}

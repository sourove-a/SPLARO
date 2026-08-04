'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable } from '@/components/dc/screens/DcHubKit'
import { useDeveloper } from '@/lib/api/hooks'

export function DcWebhooks() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="webhooks" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcWebhooksBody />
    </DcScreenProvider>
  )
}

function DcWebhooksBody() {
  const developer = useDeveloper()
  const webhooks = developer.data?.webhooks ?? []
  const rows = useMemo(
    () => webhooks.map((w) => [w.name, w.trigger, w.status, w.updated]),
    [webhooks],
  )

  return (
    <DcHubFrame
      crumbGroup="Integrations"
      title="Webhooks"
      queries={[developer]}
      empty={rows.length === 0}
      errorHint="GET /admin/platform/developer failed."
    >
      <HubKpis
        items={[
          { label: 'Webhooks', value: developer.data?.kpis.webhooks ?? webhooks.length },
          { label: 'API keys', value: developer.data?.kpis.apiKeys ?? '—' },
        ]}
      />
      <HubTable columns={['Name', 'Trigger', 'Status', 'Updated']} rows={rows} />
    </DcHubFrame>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { useDeveloper, useObservability } from '@/lib/api/hooks'

export type PlatformDevTab = 'developer' | 'observability'

export function DcPlatformDev({ tab = 'developer' }: { tab?: PlatformDevTab }) {
  const router = useRouter()
  return (
    <DcScreenProvider screen="platform-dev" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPlatformDevBody initial={tab} />
    </DcScreenProvider>
  )
}

function DcPlatformDevBody({ initial }: { initial: PlatformDevTab }) {
  const router = useRouter()
  const [tab, setTab] = useState<PlatformDevTab>(initial)
  const developer = useDeveloper()
  const observability = useObservability()
  const active = tab === 'developer' ? developer : observability

  const rows = useMemo(() => {
    if (tab === 'developer') {
      return (developer.data?.apiKeys ?? []).map((k) => [k.name, k.prefix, k.status, k.scopes, k.lastUsed])
    }
    return (observability.data?.services ?? []).map((s) => [s.name, s.status, s.latency, s.updated])
  }, [tab, developer.data, observability.data])

  return (
    <DcHubFrame
      crumbGroup="Developer"
      title={tab === 'developer' ? 'API Developer Center' : 'Observability'}
      queries={[active]}
      empty={rows.length === 0}
      emptyState={{
        icon: 'icon-terminal',
        title: 'No platform activity recorded',
        body:
          "Deploys, migrations and background job runs are logged here. Nothing has run since the last reset.",
      }}
    >
      <HubTabs
        tabs={[
          { id: 'developer', label: 'API center' },
          { id: 'observability', label: 'Observability' },
        ]}
        active={tab}
        onChange={(id) => {
          const next = id as PlatformDevTab
          setTab(next)
          router.replace(
            next === 'developer' ? '/dashboard/developer/api-center' : '/dashboard/observability/center',
          )
        }}
      />
      <HubKpis
        items={
          tab === 'developer'
            ? [
                { label: 'API keys', value: developer.data?.kpis.apiKeys ?? 0 },
                { label: 'Webhooks', value: developer.data?.kpis.webhooks ?? 0 },
                { label: 'Sandbox', value: developer.data?.kpis.sandbox ? 'On' : 'Off' },
              ]
            : [
                { label: 'Uptime', value: observability.data?.kpis.uptime ?? '—' },
                { label: 'API p95', value: observability.data?.kpis.apiP95 ?? '—' },
                { label: 'Errors / hr', value: observability.data?.kpis.errorsPerHour ?? '—' },
              ]
        }
      />
      <HubTable
        columns={
          tab === 'developer'
            ? ['Name', 'Prefix', 'Status', 'Scopes', 'Last used']
            : ['Service', 'Status', 'Latency', 'Updated']
        }
        rows={rows}
      />
    </DcHubFrame>
  )
}

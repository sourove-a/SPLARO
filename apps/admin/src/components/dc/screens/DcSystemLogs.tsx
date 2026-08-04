'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { fetchFinanceAuditLogs } from '@/lib/api/finance'
import { useSystemLogs } from '@/lib/api/hooks'

export function DcSystemLogs() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="system-logs" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcSystemLogsBody />
    </DcScreenProvider>
  )
}

function DcSystemLogsBody() {
  const [tab, setTab] = useState<'app' | 'finance'>('app')
  const system = useSystemLogs()
  const finance = useQuery({
    queryKey: ['finance-audit-logs'],
    queryFn: () => fetchFinanceAuditLogs(1),
    staleTime: 20_000,
    retry: 1,
  })

  const rows = useMemo(() => {
    if (tab === 'finance') {
      const items = (finance.data?.items ?? []) as Record<string, unknown>[]
      return items.slice(0, 50).map((row) => [
        String(row.action ?? row.type ?? '—'),
        String(row.actor ?? row.user ?? '—'),
        String(row.target ?? row.resource ?? '—'),
        String(row.createdAt ?? row.time ?? '—'),
      ])
    }
    return (system.data?.logs ?? []).map((row) => [row.level, row.msg, row.time])
  }, [tab, system.data, finance.data])

  return (
    <DcHubFrame
      crumbGroup="System"
      title="System logs"
      queries={[tab === 'app' ? system : finance]}
      empty={rows.length === 0}
      emptyState={{
        icon: 'icon-file-text',
        title: 'No log entries',
        body:
          "API errors, failed jobs and security events are written here. An empty log means nothing has failed in the retained window.",
      }}
    >
      <HubTabs
        tabs={[
          { id: 'app', label: 'Application' },
          { id: 'finance', label: 'Finance audit' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as 'app' | 'finance')}
      />
      <HubKpis
        items={[
          { label: 'App rows', value: system.data?.logs?.length ?? 0 },
          { label: 'Finance rows', value: finance.data?.total ?? 0 },
        ]}
      />
      <HubTable
        columns={tab === 'finance' ? ['Action', 'Actor', 'Target', 'When'] : ['Level', 'Message', 'When']}
        rows={rows}
      />
    </DcHubFrame>
  )
}

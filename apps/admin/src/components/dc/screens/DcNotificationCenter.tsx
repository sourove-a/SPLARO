'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable } from '@/components/dc/screens/DcHubKit'
import { useNotificationsOverview } from '@/lib/api/hooks'

export function DcNotificationCenter() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="notifications" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcNotificationCenterBody />
    </DcScreenProvider>
  )
}

function DcNotificationCenterBody() {
  const notifications = useNotificationsOverview()
  const logs = notifications.data?.logs
  const summary = notifications.data?.summary

  const rows = useMemo(
    () =>
      (logs ?? []).slice(0, 50).map((e) => [
        e.channel,
        e.subject ?? e.recipient,
        e.status,
        e.createdAt,
      ]),
    [logs],
  )

  return (
    <DcHubFrame
      crumbGroup="Executive"
      title="Notification Center"
      queries={[notifications]}
      empty={rows.length === 0}
      emptyState={{
        icon: 'icon-bell',
        title: 'No notifications',
        body: 'Order, stock and system alerts collect here. Nothing needs your attention right now.',
      }}
    >
      <HubKpis
        items={[
          { label: 'Total', value: summary?.total ?? 0 },
          { label: 'Sent', value: summary?.sent ?? 0, tone: 'ok' },
          { label: 'Pending', value: summary?.pending ?? 0, tone: 'warn' },
          { label: 'Failed', value: summary?.failed ?? 0, tone: 'bad' },
        ]}
      />
      <HubTable columns={['Channel', 'Subject', 'Status', 'When']} rows={rows} />
    </DcHubFrame>
  )
}

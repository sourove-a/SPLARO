'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { useProductionOverview } from '@/lib/api/hooks'
import { formatBDT } from '@/lib/format/currency'

export function DcProduction() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="production" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcProductionBody />
    </DcScreenProvider>
  )
}

function DcProductionBody() {
  const production = useProductionOverview()
  const [tab, setTab] = useState<'batches' | 'fabric'>('batches')

  const rows = useMemo(() => {
    const fabrics = production.data?.fabrics ?? []
    const batches = production.data?.batches ?? []
    if (tab === 'fabric') {
      return fabrics.map((f) => [
        f.name,
        f.color ?? '—',
        `${f.quantity} ${f.unit}`,
        formatBDT(Number(f.costPerUnit || 0)),
      ])
    }
    return batches.map((b) => [b.productName, b.quantity, b.status, b.createdAt])
  }, [tab, production.data])

  return (
    <DcHubFrame
      crumbGroup="Production"
      title="Production"
      queries={[production]}
      empty={rows.length === 0}
      emptyState={{
        icon: 'icon-scissors',
        title: 'No production batches yet',
        body: 'Production tracks fabric inventory through cutting, sewing and QC. Create a batch to begin following it through the line.',
      }}
    >
      <HubTabs
        tabs={[
          { id: 'batches', label: 'Batches' },
          { id: 'fabric', label: 'Fabric inventory' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as 'batches' | 'fabric')}
      />
      <HubKpis
        items={[
          { label: 'Batches', value: production.data?.batches?.length ?? 0 },
          { label: 'Fabrics', value: production.data?.fabrics?.length ?? 0 },
        ]}
      />
      <HubTable
        columns={
          tab === 'fabric'
            ? ['Fabric', 'Color', 'Qty', 'Cost / unit']
            : ['Product', 'Qty', 'Status', 'Created']
        }
        rows={rows}
      />
    </DcHubFrame>
  )
}

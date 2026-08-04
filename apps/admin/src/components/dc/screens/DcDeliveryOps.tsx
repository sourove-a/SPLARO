'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcField, DcModal } from '@/components/dc/DcModal'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { ApiError } from '@/lib/api/client'
import { createDeliveryAgent } from '@/lib/api/commerce-os'
import { useDeliveryOverview } from '@/lib/api/hooks'
import { formatBDT } from '@/lib/format/currency'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function DcDeliveryOps() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="delivery" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcDeliveryOpsBody />
    </DcScreenProvider>
  )
}

function DcDeliveryOpsBody() {
  const { toast } = useDcScreen()
  const delivery = useDeliveryOverview()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'agents' | 'assignments'>('agents')
  const [agentOpen, setAgentOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const createAgent = useMutation({
    mutationFn: createDeliveryAgent,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['delivery-overview'] }),
  })

  const rows = useMemo(() => {
    const agents = delivery.data?.agents ?? []
    const assignments = delivery.data?.assignments ?? []
    if (tab === 'agents') {
      return agents.map((a) => [
        a.name,
        a.phone,
        a.vehicleType ?? '—',
        a.isActive ? 'Active' : 'Off',
        formatBDT(Number(a.totalEarned || 0)),
      ])
    }
    return assignments.map((a) => [
      a.order?.invoiceNumber ?? a.orderId.slice(0, 8),
      a.agent?.name ?? '—',
      a.status,
      a.updatedAt ?? '—',
    ])
  }, [tab, delivery.data])

  return (
    <>
      <DcHubFrame
        crumbGroup="Delivery"
        title="Delivery ops"
        queries={[delivery]}
        empty={rows.length === 0}
        actions={[
          {
            label: 'Add agent',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => setAgentOpen(true),
          },
        ]}
      >
        <HubTabs
          tabs={[
            { id: 'agents', label: 'Agents' },
            { id: 'assignments', label: 'Assignments' },
          ]}
          active={tab}
          onChange={(id) => setTab(id as 'agents' | 'assignments')}
        />
        <HubKpis
          items={[
            { label: 'Agents', value: delivery.data?.agents?.length ?? 0 },
            { label: 'Assignments', value: delivery.data?.assignments?.length ?? 0 },
          ]}
        />
        <HubTable
          columns={
            tab === 'agents'
              ? ['Name', 'Phone', 'Vehicle', 'Status', 'Earned']
              : ['Order', 'Agent', 'Status', 'Updated']
          }
          rows={rows}
        />
      </DcHubFrame>

      <DcModal
        open={agentOpen}
        title="Add delivery agent"
        confirmLabel="Create"
        busy={createAgent.isPending}
        onClose={() => setAgentOpen(false)}
        onConfirm={() => {
          void (async () => {
            try {
              await createAgent.mutateAsync({ name: name.trim(), phone: phone.trim() })
              toast('ok', 'Agent created', name.trim())
              setAgentOpen(false)
              setName('')
              setPhone('')
            } catch (err) {
              const msg =
                err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Create failed'
              toast('bad', 'Agent not saved', msg)
            }
          })()
        }}
      >
        <DcField label="Name" value={name} onChange={setName} />
        <DcField label="Phone" value={phone} onChange={setPhone} />
      </DcModal>
    </>
  )
}

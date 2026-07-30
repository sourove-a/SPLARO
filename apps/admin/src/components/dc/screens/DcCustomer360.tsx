'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

import { CustomerProfileClient } from '@/components/customers/CustomerProfileClient'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { dcPageStatus } from '@/components/dc/page-status'
import { useCustomer } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

/**
 * Customer 360 in DC chrome. Live profile + mutations stay in CustomerProfileClient.
 */
export function DcCustomer360({ customerId }: { customerId: string }) {
  const router = useRouter()
  const { api } = useAdminConnection(30_000)
  const customer = useCustomer(customerId)
  const data = customer.data
  const pageStatus = data?.isBlocked
    ? { label: 'BLOCKED' as const, tone: 'bad' as const }
    : dcPageStatus([customer], api.pulse)
  const title = useMemo(() => {
    if (!data) return 'Customer 360°'
    return `${data.firstName} ${data.lastName}`.trim() || 'Customer 360°'
  }, [data])

  return (
    <DcScreenProvider screen="customer" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPageHead
        crumbGroup="Customers"
        title={title}
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          customer.isFetching
            ? 'syncing…'
            : api.latencyMs != null
              ? `GET /customers/${customerId} · ${api.latencyMs}ms`
              : `GET /customers/${customerId}`
        }
        syncing={customer.isFetching}
        onBack={() => router.push('/dashboard/customers')}
        onSync={() => void customer.refetch()}
      />
      <div className="dc-detail-host dc-customer-360">
        <CustomerProfileClient customerId={customerId} />
      </div>
    </DcScreenProvider>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'

import { CustomerProfileClient } from '@/components/customers/CustomerProfileClient'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { dcPageStatus } from '@/components/dc/page-status'
import { useCustomer } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { customerPublicId } from '@/lib/format/customer-code'

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
  const publicRef = data ? customerPublicId(data) : customerId
  const syncRef = data?.customerCode ? publicRef : customerId

  useEffect(() => {
    if (!data?.customerCode) return
    const next = customerPublicId(data)
    if (customerId === data.id && next !== data.id) {
      router.replace(`/dashboard/customers/${encodeURIComponent(next)}`)
    }
  }, [customerId, data, router])

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
              ? `GET /customers/${syncRef} · ${api.latencyMs}ms`
              : `GET /customers/${syncRef}`
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

'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { dcConnectionChip, dcPageStatus } from '@/components/dc/page-status'
import { OrderDetailPanel } from '@/components/modules/OrdersModulePanel'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { useOrder } from '@/lib/api/hooks'

/** Order detail — DC head + live OrderDetailPanel (no AdminPageShell). */
export function DcOrderDetail({
  recordId,
  moduleHref,
}: {
  recordId: string
  moduleHref: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { api } = useAdminConnection(25_000)
  const orderQuery = useOrder(recordId)
  const connChip = dcConnectionChip(api.pulse)
  const status = connChip ?? dcPageStatus([orderQuery])
  const title = orderQuery.data?.invoiceNumber
    ? `Order ${orderQuery.data.invoiceNumber}`
    : 'Order detail'

  return (
    <DcScreenProvider screen="order-detail" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPageHead
        crumbGroup="Commerce · Orders"
        title={title}
        statusLabel={status.label}
        statusTone={status.tone}
        syncLabel={
          api.pulse === 'offline'
            ? 'API offline — order may be unavailable'
            : orderQuery.isLoading
              ? 'Loading order…'
              : api.latencyMs != null
                ? `API · ${api.latencyMs}ms · live order`
                : 'Live order · verified API only'
        }
        onSync={() => {
          void queryClient.invalidateQueries()
          void orderQuery.refetch()
          router.refresh()
        }}
        onBack={() => router.push(moduleHref)}
      />
      <div className="dc-detail-host dc-live-module dc-order-detail">
        <OrderDetailPanel recordId={recordId} moduleHref={moduleHref} />
      </div>
    </DcScreenProvider>
  )
}

'use client'

import { useRouter } from 'next/navigation'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { dcConnectionChip } from '@/components/dc/page-status'
import { OrderCreatePanel } from '@/components/modules/OrderCreatePanel'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

/** Create order — DC head + live OrderCreatePanel (no AdminPageShell). */
export function DcOrderNew({ moduleHref }: { moduleHref: string }) {
  const router = useRouter()
  const { api } = useAdminConnection(30_000)
  const connChip = dcConnectionChip(api.pulse)

  return (
    <DcScreenProvider screen="order-new" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPageHead
        crumbGroup="Commerce · Orders"
        title="Create Order"
        statusLabel={connChip?.label ?? 'DRAFT'}
        statusTone={connChip?.tone ?? 'mute'}
        syncLabel="Not saved until verified create"
        onBack={() => router.push(moduleHref)}
      />
      <div className="dc-detail-host dc-live-module dc-order-new">
        <OrderCreatePanel moduleHref={moduleHref} />
      </div>
    </DcScreenProvider>
  )
}

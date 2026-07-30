'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { ProductEditPanel } from '@/components/modules/ProductEditPanel'
import { useProduct } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

/**
 * Product edit in DC chrome. Save / variants / media stay in ProductEditPanel.
 */
export function DcProductEdit({
  productId,
  moduleHref,
}: {
  productId: string
  moduleHref: string
}) {
  const router = useRouter()
  const { api } = useAdminConnection(30_000)
  const { data: product } = useProduct(productId)
  const online = api.pulse === 'online' || api.pulse === 'degraded'
  const title = useMemo(() => product?.name?.trim() || 'Edit product', [product?.name])
  const statusLabel = product?.isPublished
    ? 'LIVE'
    : product
      ? 'DRAFT'
      : online
        ? 'LOADING'
        : 'API OFFLINE'
  const statusTone = !online ? 'bad' : product?.isPublished ? 'ok' : 'mute'

  return (
    <DcScreenProvider screen="product-edit" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPageHead
        crumbGroup="Catalog · Products"
        title={title}
        statusLabel={statusLabel}
        statusTone={statusTone}
        syncLabel={
          api.latencyMs != null
            ? `GET /products/${productId} · ${api.latencyMs}ms`
            : `GET /products/${productId}`
        }
        onBack={() => router.push(moduleHref)}
        onSync={() => router.refresh()}
      />
      <div className="dc-detail-host dc-product-edit">
        <ProductEditPanel productId={productId} moduleHref={moduleHref} />
      </div>
    </DcScreenProvider>
  )
}

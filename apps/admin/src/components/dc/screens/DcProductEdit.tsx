'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { dcConnectionChip, dcPageStatus } from '@/components/dc/page-status'
import { ProductEditPanel } from '@/components/modules/ProductEditPanel'
import { toastFail } from '@/lib/admin/feedback'
import { productStorefrontUrl } from '@/lib/admin/product-storefront-url'
import { useProduct } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

/**
 * Product edit — DC page head only. Body is ProductEditPanel embedded (no legacy topbar).
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
  const productQuery = useProduct(productId)
  const { data: product, isFetching, refetch } = productQuery
  const connChip = dcConnectionChip(api.pulse)
  const title = useMemo(() => product?.name?.trim() || 'Edit product', [product?.name])
  const queryStatus = dcPageStatus([productQuery])
  const statusLabel = connChip?.label ??
    (product?.isPublished ? 'LIVE' : product ? 'DRAFT' : queryStatus.label)
  const statusTone = connChip?.tone ??
    (product?.isPublished ? 'ok' : product ? 'mute' : queryStatus.tone)

  const triggerSave = useCallback(() => {
    if (api.pulse === 'offline') {
      toastFail('API offline — cannot save until :4000 is up.')
      return
    }
    const btn = document.querySelector(
      '.dc-product-create.product-edit-page--dc [data-dc-publish-primary="1"], .product-edit-page--dc [data-dc-publish-primary="1"]',
    ) as HTMLButtonElement | null
    if (!btn || btn.disabled) {
      toastFail('Nothing to save, or your role cannot edit products.')
      return
    }
    btn.click()
  }, [api.pulse])

  return (
    <DcScreenProvider screen="product-edit" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPageHead
        crumbGroup="Catalog · Products"
        title={title}
        statusLabel={statusLabel}
        statusTone={statusTone}
        syncLabel={
          isFetching
            ? 'syncing…'
            : api.latencyMs != null
              ? `GET /products/${productId} · ${api.latencyMs}ms`
              : `GET /products/${productId}`
        }
        onBack={() => router.push(moduleHref)}
        onSync={() => void refetch()}
        actions={[
          {
            label: 'Preview',
            icon: 'icon-external-link',
            variant: 'ghost',
            onClick: () => {
              const slug = product?.slug?.trim()
              if (!slug || !product?.isPublished) {
                toastFail(
                  !product?.isPublished
                    ? 'Publish first to preview on the live storefront.'
                    : 'Save a URL slug first.',
                )
                return
              }
              window.open(productStorefrontUrl(slug), '_blank', 'noopener,noreferrer')
            },
          },
          {
            label: 'Save changes',
            icon: 'icon-check',
            variant: 'primary',
            onClick: triggerSave,
          },
        ]}
      />
      <div className="dc-detail-host dc-product-edit">
        <ProductEditPanel productId={productId} moduleHref={moduleHref} embedded />
      </div>
    </DcScreenProvider>
  )
}

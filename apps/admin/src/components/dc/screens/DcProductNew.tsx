'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { dcConnectionChip } from '@/components/dc/page-status'
import { ProductCreatePanel } from '@/components/modules/ProductCreatePanel'
import { toastFail, toastInfo } from '@/lib/admin/feedback'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

/**
 * Add-product screen — handoff layout lives inside ProductCreatePanel.
 * Head CTAs never fake success: Preview = draft card only; Save = verified create.
 */
export function DcProductNew({ moduleHref }: { moduleHref: string }) {
  const router = useRouter()
  const { api } = useAdminConnection(30_000)
  const connChip = dcConnectionChip(api.pulse)

  const previewDraft = useCallback(() => {
    toastInfo('Draft card preview only — product is not live until verified create succeeds.')
    document.getElementById('np-publish')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const triggerSave = useCallback(() => {
    if (api.pulse === 'offline') {
      toastFail('API offline — cannot create product until :4000 is up.')
      return
    }
    const btn = document.querySelector(
      '.dc-product-create [data-dc-publish-primary="1"]',
    ) as HTMLButtonElement | null
    if (!btn || btn.disabled) {
      toastFail('Clear readiness blockers first — name, category, price, sizes required.')
      document.getElementById('np-publish')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    btn.click()
  }, [api.pulse])

  return (
    <DcScreenProvider screen="product-new" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPageHead
        crumbGroup="Catalog · Products"
        title="Add product"
        statusLabel={connChip?.label ?? 'DRAFT'}
        statusTone={connChip?.tone ?? 'mute'}
        syncLabel="Not saved until verified create"
        onBack={() => router.push(moduleHref)}
        actions={[
          { label: 'Preview', icon: 'icon-eye', onClick: previewDraft },
          { label: 'Save & publish', icon: 'icon-check', variant: 'primary', onClick: triggerSave },
        ]}
      />
      <div className="dc-detail-host dc-product-new">
        <ProductCreatePanel moduleHref={moduleHref} />
      </div>
    </DcScreenProvider>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcField, DcModal } from '@/components/dc/DcModal'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable } from '@/components/dc/screens/DcHubKit'
import { useBrands, useCreateBrand } from '@/lib/api/hooks'
import { ApiError } from '@/lib/api/client'

export function DcBrands() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="brands" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcBrandsBody />
    </DcScreenProvider>
  )
}

function DcBrandsBody() {
  const { toast } = useDcScreen()
  const brands = useBrands()
  const create = useCreateBrand()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [vendorLabel, setVendorLabel] = useState('')

  const rows = useMemo(
    () =>
      (brands.data?.brands ?? []).map((b) => [
        b.name,
        b.vendorLabel ?? '—',
        b.country ?? '—',
        b.isActive === false ? 'Inactive' : 'Active',
      ]),
    [brands.data],
  )

  return (
    <>
      <DcHubFrame
        crumbGroup="Catalog"
        title="Brands"
        queries={[brands]}
        empty={rows.length === 0}
        emptyState={{
          icon: 'icon-tag',
          title: 'No brands yet',
          body:
            "Brands group products under a manufacturer or label and drive the /brands storefront pages. Add your first one to start tagging products.",
        }}
        actions={[
          {
            label: 'Add brand',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => setOpen(true),
          },
        ]}
      >
        <HubKpis items={[{ label: 'Brands', value: brands.data?.total ?? brands.data?.brands?.length ?? 0 }]} />
        <HubTable columns={['Name', 'Vendor', 'Country', 'Status']} rows={rows} />
      </DcHubFrame>

      <DcModal
        open={open}
        title="Add brand"
        confirmLabel="Create"
        busy={create.isPending}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          if (!name.trim()) {
            toast('warn', 'Name required', 'Enter a brand name before creating.')
            return
          }
          void (async () => {
            try {
              const payload: { name: string; vendorLabel?: string } = { name: name.trim() }
              if (vendorLabel.trim()) payload.vendorLabel = vendorLabel.trim()
              await create.mutateAsync(payload)
              toast('ok', 'Brand created', name.trim())
              setOpen(false)
              setName('')
              setVendorLabel('')
            } catch (err) {
              const msg =
                err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Create failed'
              toast('bad', 'Brand not saved', msg)
            }
          })()
        }}
      >
        <DcField label="Name" value={name} onChange={setName} placeholder="Brand name" />
        <DcField label="Vendor label" value={vendorLabel} onChange={setVendorLabel} placeholder="Optional" />
      </DcModal>
    </>
  )
}

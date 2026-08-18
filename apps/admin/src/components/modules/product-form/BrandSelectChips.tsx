'use client'

import { useRef, useState } from 'react'
import { DcChip } from '@/components/dc/product/DcProductFormPrimitives'
import { FONT } from '@/components/dc/tokens'
import { toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import { verifyStringEquals } from '@/lib/admin/mutation-verify'
import { useUpdateBrand } from '@/lib/api/hooks'
import type { BrandRow } from '@/lib/api/brands'
import { uploadAdminImage } from '@/lib/api/upload'

interface BrandSelectChipsProps {
  brands: BrandRow[]
  brandId: string
  onBrandId: (id: string) => void
}

export function BrandSelectChips({ brands, brandId, onBrandId }: BrandSelectChipsProps) {
  const active = brands.filter((row) => row.isActive)
  const selected = active.find((row) => row.id === brandId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const updateBrand = useUpdateBrand()

  if (!active.length) return null

  const onLogoFile = async (file: File | undefined) => {
    if (!file) return
    if (!selected) {
      toastWarn('Pick a brand first, then add its logo.')
      return
    }
    setUploading(true)
    try {
      const uploaded = await uploadAdminImage(file, 'brands', { pipeline: false })
      const saved = await updateBrand.mutateAsync({ id: selected.id, logo: uploaded.url })
      if (!verifyStringEquals(saved.logo ?? '', uploaded.url, 'Brand logo')) return
      toastOk(`${selected.name} logo ready for PDP`)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Brand logo not saved')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span
        style={{
          font: '600 10.5px/1 var(--font-ui, inherit)',
          letterSpacing: '.09em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        Brand · optional
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {active.map((row) => (
          <DcChip
            key={row.id}
            on={brandId === row.id}
            onClick={() => onBrandId(brandId === row.id ? '' : row.id)}
          >
            {row.name}
          </DcChip>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {selected?.logo ? (
          <span
            aria-hidden
            style={{
              width: 88,
              height: 28,
              flex: 'none',
              backgroundColor: 'var(--surface-2)',
              backgroundImage: `url(${JSON.stringify(selected.logo)})`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'left center',
              backgroundSize: 'contain',
              border: '1px solid var(--line)',
              borderRadius: 6,
            }}
          />
        ) : null}
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            if (!selected) {
              toastWarn('Pick a brand first, then add its logo.')
              return
            }
            fileRef.current?.click()
          }}
          style={{
            height: 30,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid var(--line-2)',
            background: 'var(--surface)',
            color: 'var(--ink-2)',
            font: `600 11.5px/30px ${FONT}`,
            cursor: uploading ? 'wait' : 'pointer',
          }}
        >
          {uploading ? 'Uploading…' : selected?.logo ? 'Replace logo' : 'Add brand logo'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/webp,image/jpeg,image/svg+xml"
          hidden
          onChange={(e) => void onLogoFile(e.target.files?.[0])}
        />
      </div>
    </div>
  )
}

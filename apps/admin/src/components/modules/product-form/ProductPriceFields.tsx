'use client'

import { useState } from 'react'
import { DcField, DcInput } from '@/components/dc/product/DcProductFormPrimitives'
import {
  discountPercentFromPrices,
  salePriceFromDiscountPercent,
} from '@/lib/admin/product-form-utils'

export function ProductPriceFields({
  mainPrice,
  salePrice,
  onMainChange,
  onSaleChange,
}: {
  mainPrice: string
  salePrice: string
  onMainChange: (next: string) => void
  onSaleChange: (next: string) => void
}) {
  const autoPct = discountPercentFromPrices(mainPrice, salePrice)
  const [pctDraft, setPctDraft] = useState('')
  const [pctFocus, setPctFocus] = useState(false)
  const pctShown = pctFocus ? pctDraft : autoPct != null ? String(autoPct) : ''

  const applyPercent = (raw: string) => {
    setPctDraft(raw)
    onSaleChange(salePriceFromDiscountPercent(mainPrice, raw))
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
      <DcField label="Main price · ৳" hint="Original / MRP">
        <DcInput
          mono
          value={mainPrice}
          onChange={(e) => {
            const next = e.target.value
            onMainChange(next)
            const pct = pctFocus ? pctDraft : autoPct != null ? String(autoPct) : ''
            if (pct) onSaleChange(salePriceFromDiscountPercent(next, pct))
          }}
          placeholder="5000"
        />
      </DcField>
      <DcField label="Sale price · ৳" hint="What the customer pays">
        <DcInput
          mono
          value={salePrice}
          onChange={(e) => onSaleChange(e.target.value)}
          placeholder="Empty = same as main"
        />
      </DcField>
      <DcField label="Discount · %" hint="Type % or fill sale — the other follows">
        <DcInput
          mono
          value={pctShown}
          placeholder="Auto"
          onFocus={() => {
            setPctFocus(true)
            setPctDraft(autoPct != null ? String(autoPct) : '')
          }}
          onBlur={() => setPctFocus(false)}
          onChange={(e) => applyPercent(e.target.value.replace(/[^\d.]/g, ''))}
        />
      </DcField>
    </div>
  )
}

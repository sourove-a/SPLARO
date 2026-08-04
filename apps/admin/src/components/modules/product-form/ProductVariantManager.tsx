'use client'

import { useEffect, useMemo, useState } from 'react'
import { Archive, Loader2, Plus } from 'lucide-react'
import { useCreateProductVariant, useUpdateProductVariant, useArchiveProductVariant } from '@/lib/api/hooks'
import { toastFail, toastApiSaved, toastOk, toastWarn } from '@/lib/admin/feedback'
import {
  confirmVariantArchived,
  confirmVariantCreated,
  confirmVariantSaved,
} from '@/lib/admin/catalog-save'
import {
  verifyVariantCreated,
  verifyVariantPersisted,
  verifyVariantResponse,
} from '@/lib/admin/catalog-mutation-verify'
import { cn } from '@/lib/utils/cn'
import type { ApiProduct } from '@/lib/api/products'
import {
  colourInputValue,
  DEFAULT_COLOUR_HEX,
  eyeDropperSupported,
  nearestColourName,
  normalizeHex,
  pickColourWithEyeDropper,
  swatchCss,
} from '@/lib/admin/colour-names'
import { sizeChipsForDept, sizeDeptFromSlugOrName } from '@/lib/admin/size-presets'

type Variant = NonNullable<ApiProduct['variants']>[number]

interface ProductVariantManagerProps {
  productId: string
  variants: Variant[]
  productImages: string[]
  /** Menu slug/name so size chips switch (footwear ≠ M/L/XL). */
  departmentHint?: string
}

interface RowDraft {
  size: string
  color: string
  colorName: string
  colorHex: string
  image: string
  sku: string
  price: string
  compareAtPrice: string
  stock: string
  stockReason: string
  stockNote: string
}

const STOCK_REASONS = [
  'Admin manual update',
  'Received shipment',
  'Inventory correction',
  'Damage / loss',
  'Return restock',
] as const

const SIZE_CHIPS = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL',
  '36', '37', '38', '39', '40', '41', '42',
] as const

function serverStock(v: Variant): number {
  return Number(v.stock ?? v.stockQuantity ?? 0)
}

function draftFromVariant(v: Variant): RowDraft {
  return {
    size: v.size ?? '',
    color: v.color ?? '',
    colorName: v.colorName ?? '',
    colorHex: v.colorHex ?? '',
    image: v.image ?? '',
    sku: v.sku ?? '',
    price: v.price != null ? String(v.price) : '',
    compareAtPrice: v.compareAtPrice != null ? String(v.compareAtPrice) : '',
    stock: String(serverStock(v)),
    stockReason: 'Admin manual update',
    stockNote: '',
  }
}

const EMPTY_DRAFT: RowDraft = {
  size: '',
  color: '',
  colorName: 'Default',
  colorHex: DEFAULT_COLOUR_HEX,
  image: '',
  sku: '',
  price: '',
  compareAtPrice: '',
  stock: '10',
  stockReason: 'Admin manual update',
  stockNote: '',
}

function pendingVariantId(
  updatePending: boolean,
  updateVars: { variantId?: string } | undefined,
  archivePending: boolean,
  archiveVars: { variantId?: string } | undefined,
): string | null {
  if (updatePending && updateVars?.variantId) return updateVars.variantId
  if (archivePending && archiveVars?.variantId) return archiveVars.variantId
  return null
}

function existingSizeKey(size: string, colorHex: string) {
  return `${size.trim().toLowerCase()}::${colorHex.trim().toLowerCase() || 'default'}`
}

export function ProductVariantManager({
  productId,
  variants,
  productImages,
  departmentHint,
}: ProductVariantManagerProps) {
  const updateVariant = useUpdateProductVariant()
  const createVariant = useCreateProductVariant()
  const archiveVariant = useArchiveProductVariant()

  const sizeChips = useMemo(() => {
    const dept = sizeDeptFromSlugOrName(departmentHint)
    if (dept === 'default') return [...SIZE_CHIPS]
    return sizeChipsForDept(dept)
  }, [departmentHint])

  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(() => {
    const map: Record<string, RowDraft> = {}
    variants.forEach((v) => { if (v.id) map[v.id] = draftFromVariant(v) })
    return map
  })
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [customSize, setCustomSize] = useState('')
  const [bulk, setBulk] = useState({
    price: '',
    stock: '10',
    colorName: 'Default',
    colorHex: DEFAULT_COLOUR_HEX,
    image: '',
  })
  const [bulkBusy, setBulkBusy] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [addDraft, setAddDraft] = useState<RowDraft>(EMPTY_DRAFT)

  const busyId = pendingVariantId(
    updateVariant.isPending,
    updateVariant.variables as { variantId?: string } | undefined,
    archiveVariant.isPending,
    archiveVariant.variables as { variantId?: string } | undefined,
  )

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev }
      const liveIds = new Set<string>()
      variants.forEach((v) => {
        if (!v.id) return
        liveIds.add(v.id)
        if (v.id === busyId) return
        next[v.id] = draftFromVariant(v)
      })
      Object.keys(next).forEach((id) => {
        if (!liveIds.has(id)) delete next[id]
      })
      return next
    })
  }, [variants, busyId])

  const existingKeys = useMemo(() => {
    const keys = new Set<string>()
    variants.forEach((v) => {
      const size = (v.id && drafts[v.id]?.size) || v.size || ''
      const hex = (v.id && drafts[v.id]?.colorHex) || v.colorHex || ''
      if (size.trim()) keys.add(existingSizeKey(size, hex))
    })
    return keys
  }, [variants, drafts])

  const totalAvailable = useMemo(
    () => variants.reduce((sum, v) => sum + (v.id ? Number(drafts[v.id]?.stock ?? serverStock(v)) : serverStock(v)), 0),
    [variants, drafts],
  )

  const draftFor = (v: Variant): RowDraft => (v.id && drafts[v.id]) || draftFromVariant(v)
  const setField = (id: string, key: keyof RowDraft, value: string) =>
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || draftFromVariant(variants.find((row) => row.id === id)!)), [key]: value },
    }))

  const syncDraftFromServer = (variantId: string, row: Variant) => {
    setDrafts((prev) => ({ ...prev, [variantId]: draftFromVariant(row) }))
  }

  const toggleSizeChip = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
    )
  }

  const addCustomSize = () => {
    const size = customSize.trim().toUpperCase()
    if (!size) return
    setSelectedSizes((prev) => (prev.includes(size) ? prev : [...prev, size]))
    setCustomSize('')
  }

  const createSizesBulk = async () => {
    if (!selectedSizes.length) {
      toastFail('Select at least one size.')
      return
    }
    const price = Number(bulk.price)
    const stock = Number(bulk.stock || '0')
    if (!bulk.price.trim() || Number.isNaN(price) || price < 0) {
      toastFail('Enter a price for the new sizes.')
      return
    }
    if (Number.isNaN(stock) || stock < 0) {
      toastFail('Enter a valid quantity.')
      return
    }

    const colorName = bulk.colorName.trim() || 'Default'
    const colorHex = normalizeHex(bulk.colorHex) ?? DEFAULT_COLOUR_HEX
    const toCreate = selectedSizes.filter(
      (size) => !existingKeys.has(existingSizeKey(size, colorHex)),
    )
    if (!toCreate.length) {
      toastFail('Those sizes already exist for this colour.')
      return
    }

    setBulkBusy(true)
    let created = 0
    try {
      for (const size of toCreate) {
        const payload = {
          productId,
          price,
          stock,
          size,
          color: colorName,
          colorName,
          colorHex,
          ...(bulk.image.trim() ? { image: bulk.image.trim() } : {}),
        }
        try {
          const saved = await createVariant.mutateAsync(payload)
          if (!verifyVariantResponse(saved, { price, stock, size })) continue
          const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
          if (!id || !(await verifyVariantCreated(productId, id, { price, stock, size }))) continue
          created += 1
        } catch (err) {
          toastFail(err instanceof Error ? err.message : `Could not add size ${size}.`)
        }
      }
      if (created > 0) {
        toastApiSaved(`${created} variant${created === 1 ? '' : 's'} added`)
        setSelectedSizes([])
      }
    } finally {
      setBulkBusy(false)
    }
  }

  const applyStockToAll = async () => {
    const stock = Number(bulk.stock)
    if (Number.isNaN(stock) || stock < 0) {
      toastFail('Enter a valid quantity.')
      return
    }
    if (!variants.length) return
    if (!window.confirm(`Set available quantity to ${stock} for all variants?`)) return

    setBulkBusy(true)
    let saved = 0
    try {
      for (const v of variants) {
        if (!v.id || !(v.isActive ?? true)) continue
        const d = draftFor(v)
        const price = Number(d.price || v.price || 0)
        setField(v.id, 'stock', String(stock))
        try {
          const result = await updateVariant.mutateAsync({
            productId,
            variantId: v.id,
            stock,
            stockReason: 'Admin manual update',
            price,
            size: d.size.trim(),
            color: d.color.trim(),
            colorName: d.colorName.trim(),
            colorHex: d.colorHex.trim(),
            sku: d.sku.trim(),
            image: d.image.trim(),
          })
          if (!verifyVariantResponse(result, { price, stock, size: d.size.trim() })) continue
          if (!(await verifyVariantPersisted(productId, v.id, { price, stock, size: d.size.trim() }))) continue
          saved += 1
          syncDraftFromServer(v.id, { ...v, stock, stockQuantity: stock })
        } catch (err) {
          toastFail(err instanceof Error ? err.message : 'Quantity update failed.')
        }
      }
      if (saved > 0) toastApiSaved(`Quantity updated on ${saved} variant${saved === 1 ? '' : 's'}`)
    } finally {
      setBulkBusy(false)
    }
  }

  const applyPriceToAll = async () => {
    const price = Number(bulk.price)
    if (!bulk.price.trim() || Number.isNaN(price) || price < 0) {
      toastFail('Enter a valid price.')
      return
    }
    if (!variants.length) return
    if (!window.confirm(`Set price to ৳${price} for all variants?`)) return

    setBulkBusy(true)
    let saved = 0
    try {
      for (const v of variants) {
        if (!v.id || !(v.isActive ?? true)) continue
        const d = draftFor(v)
        const stock = Number(d.stock || serverStock(v))
        setField(v.id, 'price', String(price))
        try {
          const result = await updateVariant.mutateAsync({
            productId,
            variantId: v.id,
            price,
            stock,
            size: d.size.trim(),
            color: d.color.trim(),
            colorName: d.colorName.trim(),
            colorHex: d.colorHex.trim(),
            sku: d.sku.trim(),
            image: d.image.trim(),
          })
          if (!verifyVariantResponse(result, { price, stock, size: d.size.trim() })) continue
          if (!(await verifyVariantPersisted(productId, v.id, { price, stock, size: d.size.trim() }))) continue
          saved += 1
          syncDraftFromServer(v.id, { ...v, price })
        } catch (err) {
          toastFail(err instanceof Error ? err.message : 'Price update failed.')
        }
      }
      if (saved > 0) toastApiSaved(`Price updated on ${saved} variant${saved === 1 ? '' : 's'}`)
    } finally {
      setBulkBusy(false)
    }
  }

  const saveRow = async (v: Variant) => {
    if (!v.id) return
    const d = draftFor(v)
    const price = Number(d.price)
    const stock = Number(d.stock)
    if (Number.isNaN(price) || price < 0) { toastFail('Enter a valid price.'); return }
    if (Number.isNaN(stock) || stock < 0) { toastFail('Enter a valid quantity.'); return }
    const stockChanged = stock !== serverStock(v)
    const payload = {
      productId,
      variantId: v.id,
      size: d.size.trim(),
      color: d.color.trim() || d.colorName.trim(),
      colorName: d.colorName.trim(),
      colorHex: d.colorHex.trim(),
      image: d.image.trim(),
      sku: d.sku.trim(),
      price,
      compareAtPrice: d.compareAtPrice.trim() ? Number(d.compareAtPrice) : null,
      stock,
      ...(stockChanged
        ? {
            stockReason: d.stockReason.trim() || 'Admin manual update',
            ...(d.stockNote.trim() ? { stockNote: d.stockNote.trim() } : {}),
          }
        : {}),
    }
    const ok = await confirmVariantSaved(
      productId,
      v.id,
      { price, stock, size: d.size.trim() },
      () => updateVariant.mutateAsync(payload),
    )
    if (ok) {
      const fresh = variants.find((row) => row.id === v.id) ?? v
      syncDraftFromServer(v.id, fresh)
    }
  }

  const applyImageToColour = async (source: Variant) => {
    if (!source.id) return
    const d = draftFor(source)
    const hex = d.colorHex.trim().toLowerCase()
    const image = d.image.trim()
    if (!hex) {
      toastFail('Set a colour first.')
      return
    }
    if (!image) {
      toastFail('Choose an image first.')
      return
    }

    const siblings = variants.filter((row) => {
      if (!row.id) return false
      const rowHex = (drafts[row.id]?.colorHex ?? row.colorHex ?? '').trim().toLowerCase()
      return rowHex === hex
    })

    let saved = 0
    for (const row of siblings) {
      if (!row.id) continue
      setField(row.id, 'image', image)
      const price = Number(draftFor(row).price || row.price || 0)
      const stock = Number(draftFor(row).stock || serverStock(row))
      const ok = await confirmVariantSaved(
        productId,
        row.id,
        { price, stock, size: (draftFor(row).size || row.size || '').trim() },
        () =>
          updateVariant.mutateAsync({
            productId,
            variantId: row.id!,
            image,
            size: (draftFor(row).size || row.size || '').trim(),
            color: (draftFor(row).color || row.color || '').trim(),
            colorName: (draftFor(row).colorName || row.colorName || '').trim(),
            colorHex: (draftFor(row).colorHex || row.colorHex || '').trim(),
            sku: (draftFor(row).sku || row.sku || '').trim(),
            price,
            stock,
          }),
      )
      if (ok) {
        saved += 1
        syncDraftFromServer(row.id, { ...row, image })
      }
    }

    if (saved > 0) toastOk(`Image applied to ${saved} variant${saved === 1 ? '' : 's'}`)
  }

  const toggleActive = async (v: Variant) => {
    if (!v.id) return
    const next = !(v.isActive ?? true)
    const ok = await confirmVariantSaved(
      productId,
      v.id,
      { isActive: next },
      () => updateVariant.mutateAsync({ productId, variantId: v.id!, isActive: next }),
    )
    if (ok) syncDraftFromServer(v.id, { ...v, isActive: next })
  }

  const archiveRow = async (v: Variant) => {
    if (!v.id) return
    if (!window.confirm(`Archive variant ${v.size ?? '—'} / ${v.colorName ?? v.color ?? '—'}?`)) return
    const ok = await confirmVariantArchived(
      productId,
      v.id,
      () => archiveVariant.mutateAsync({ productId, variantId: v.id! }),
    )
    if (ok) syncDraftFromServer(v.id, { ...v, isActive: false })
  }

  const submitAdd = async () => {
    const price = Number(addDraft.price)
    const stock = Number(addDraft.stock || '0')
    if (!addDraft.price.trim() || Number.isNaN(price) || price < 0) { toastFail('Enter a valid price.'); return }
    if (Number.isNaN(stock) || stock < 0) { toastFail('Enter a valid quantity.'); return }
    const payload = {
      productId,
      price,
      stock,
      ...(addDraft.size.trim() ? { size: addDraft.size.trim() } : {}),
      ...(addDraft.color.trim() ? { color: addDraft.color.trim() } : {}),
      ...(addDraft.colorName.trim() ? { colorName: addDraft.colorName.trim() } : {}),
      ...(addDraft.colorHex.trim() ? { colorHex: addDraft.colorHex.trim() } : {}),
      ...(addDraft.image.trim() ? { image: addDraft.image.trim() } : {}),
      ...(addDraft.sku.trim() ? { sku: addDraft.sku.trim() } : {}),
      ...(addDraft.compareAtPrice.trim() ? { compareAtPrice: Number(addDraft.compareAtPrice) } : {}),
    }
    const id = await confirmVariantCreated(
      productId,
      { price, stock, ...(addDraft.size.trim() ? { size: addDraft.size.trim() } : {}) },
      () => createVariant.mutateAsync(payload),
    )
    if (id) {
      setAddDraft(EMPTY_DRAFT)
      setShowManual(false)
    }
  }

  const rowBusy = (id?: string) => id != null && busyId === id

  return (
    <div className="sf-variants">
      {/* Shopify-style option builder */}
      <section className="sf-variants__block">
        <header className="sf-variants__block-head">
          <div>
            <h4 className="sf-variants__block-title">Options</h4>
            <p className="sf-variants__block-desc">
              Select sizes once, set price & quantity, then generate variants — like Shopify.
            </p>
          </div>
        </header>

        <div className="sf-variants__option">
          <div className="sf-variants__option-label">
            <span className="sf-variants__option-name">Size</span>
            <span className="sf-variants__option-meta">Option values</span>
          </div>

          <div className="sf-variants__chips">
            {sizeChips.map((size) => {
              const taken = existingKeys.has(existingSizeKey(size, bulk.colorHex))
              const active = selectedSizes.includes(size)
              return (
                <button
                  key={size}
                  type="button"
                  disabled={taken || bulkBusy}
                  className={cn(
                    'sf-variants__chip',
                    active && 'sf-variants__chip--on',
                    taken && 'sf-variants__chip--taken',
                  )}
                  onClick={() => toggleSizeChip(size)}
                >
                  {size}
                </button>
              )
            })}
          </div>

          <div className="sf-variants__custom-row">
            <input
              className="sf-variants__input"
              placeholder="Custom size"
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustomSize()
                }
              }}
            />
            <button type="button" className="sf-variants__btn sf-variants__btn--ghost" onClick={addCustomSize} disabled={!customSize.trim()}>
              Add
            </button>
          </div>
        </div>

        <div className="sf-variants__defaults">
          <label className="sf-variants__field">
            <span>Price</span>
            <div className="sf-variants__input-affix">
              <span>৳</span>
              <input
                type="number"
                min={0}
                className="sf-variants__input"
                value={bulk.price}
                placeholder="0.00"
                onChange={(e) => setBulk((p) => ({ ...p, price: e.target.value }))}
              />
            </div>
          </label>
          <label className="sf-variants__field">
            <span>Quantity</span>
            <input
              type="number"
              min={0}
              className="sf-variants__input"
              value={bulk.stock}
              onChange={(e) => setBulk((p) => ({ ...p, stock: e.target.value }))}
            />
          </label>
          <label className="sf-variants__field">
            <span>Colour</span>
            <input
              className="sf-variants__input"
              value={bulk.colorName}
              onChange={(e) => setBulk((p) => ({ ...p, colorName: e.target.value }))}
            />
          </label>
          <label className="sf-variants__field">
            <span>Swatch</span>
            <div className="sf-variants__swatch-row">
              <span className="sf-variants__swatch" style={{ background: colourInputValue(bulk.colorHex) }} />
              <input
                type="color"
                className="sf-variants__color"
                value={colourInputValue(bulk.colorHex)}
                onChange={(e) =>
                  setBulk((p) => ({
                    ...p,
                    colorHex: normalizeHex(e.target.value) ?? e.target.value,
                    colorName:
                      !p.colorName.trim() || p.colorName === 'Default' || p.colorName === nearestColourName(p.colorHex)
                        ? nearestColourName(e.target.value)
                        : p.colorName,
                  }))
                }
              />
              <button
                type="button"
                className="sf-variants__link"
                title="Eyedropper — pick colour from product photo"
                onClick={() => {
                  void (async () => {
                    if (!eyeDropperSupported()) {
                      toastWarn('Eyedropper needs Chrome or Edge')
                      return
                    }
                    const picked = await pickColourWithEyeDropper()
                    if (!picked) return
                    setBulk((p) => ({
                      ...p,
                      colorHex: picked.hex,
                      colorName: picked.name,
                    }))
                    toastOk(`${picked.name} · ${picked.hex}`)
                  })()
                }}
              >
                Pen
              </button>
            </div>
          </label>
          <label className="sf-variants__field">
            <span>Image</span>
            <select
              className="sf-variants__input"
              value={bulk.image}
              onChange={(e) => setBulk((p) => ({ ...p, image: e.target.value }))}
            >
              <option value="">None</option>
              {productImages.map((url, idx) => (
                <option key={url} value={url}>Image {idx + 1}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="sf-variants__toolbar">
          <button
            type="button"
            className="sf-variants__btn sf-variants__btn--primary"
            disabled={bulkBusy || selectedSizes.length === 0}
            onClick={() => void createSizesBulk()}
          >
            {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {selectedSizes.length
              ? `Generate ${selectedSizes.length} variant${selectedSizes.length === 1 ? '' : 's'}`
              : 'Generate variants'}
          </button>
          <div className="sf-variants__toolbar-links">
            <button type="button" className="sf-variants__link" disabled={bulkBusy || !variants.length} onClick={() => void applyPriceToAll()}>
              Apply price to all
            </button>
            <button type="button" className="sf-variants__link" disabled={bulkBusy || !variants.length} onClick={() => void applyStockToAll()}>
              Apply quantity to all
            </button>
          </div>
        </div>
      </section>

      {/* Shopify-style variants table */}
      <section className="sf-variants__block">
        <header className="sf-variants__block-head sf-variants__block-head--row">
          <div>
            <h4 className="sf-variants__block-title">Variants</h4>
            <p className="sf-variants__block-desc">
              {variants.length} variant{variants.length === 1 ? '' : 's'} · {totalAvailable} available
            </p>
          </div>
        </header>

        {variants.length === 0 ? (
          <div className="sf-variants__empty">
            <p>No variants yet</p>
            <span>Select size values above and generate variants.</span>
          </div>
        ) : (
          <div className="sf-variants__table-wrap">
            <table className="sf-variants__table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Price</th>
                  <th>Available</th>
                  <th>SKU</th>
                  <th>Image</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {variants.map((v, i) => {
                  const d = draftFor(v)
                  const active = v.isActive ?? true
                  const busy = rowBusy(v.id)
                  const stockChanged = Number(d.stock) !== serverStock(v)
                  return (
                    <tr key={v.id ?? i} className={cn(!active && 'sf-variants__row--off')}>
                      <td>
                        <div className="sf-variants__variant-cell">
                          <button
                            type="button"
                            className={cn('sf-variants__status', active ? 'sf-variants__status--on' : 'sf-variants__status--off')}
                            disabled={busy}
                            onClick={() => void toggleActive(v)}
                            title={active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                          />
                          <span className="sf-variants__swatch" style={{ background: swatchCss(d.colorHex) }} />
                          <div className="sf-variants__variant-meta">
                            <strong>{d.size || '—'}</strong>
                            <span>{d.colorName || 'Default'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="sf-variants__input-affix sf-variants__input-affix--compact">
                          <span>৳</span>
                          <input
                            type="number"
                            min={0}
                            className="sf-variants__input"
                            value={d.price}
                            onChange={(e) => v.id && setField(v.id, 'price', e.target.value)}
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          className={cn('sf-variants__input sf-variants__input--qty', Number(d.stock) < 5 && 'sf-variants__input--warn')}
                          value={d.stock}
                          onChange={(e) => v.id && setField(v.id, 'stock', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="sf-variants__input sf-variants__input--sku"
                          placeholder="SKU"
                          value={d.sku}
                          onChange={(e) => v.id && setField(v.id, 'sku', e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="sf-variants__input"
                          value={d.image}
                          onChange={(e) => v.id && setField(v.id, 'image', e.target.value)}
                        >
                          <option value="">—</option>
                          {productImages.map((url, idx) => (
                            <option key={url} value={url}>Img {idx + 1}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="sf-variants__row-actions">
                          <button
                            type="button"
                            className="sf-variants__btn sf-variants__btn--small sf-variants__btn--primary"
                            disabled={busy}
                            onClick={() => void saveRow(v)}
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                          </button>
                          {d.image ? (
                            <button
                              type="button"
                              className="sf-variants__link"
                              disabled={busy}
                              onClick={() => void applyImageToColour(v)}
                            >
                              Apply image
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="sf-variants__icon-btn"
                            disabled={busy || !active}
                            title="Archive"
                            onClick={() => void archiveRow(v)}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {stockChanged ? (
                          <div className="sf-variants__stock-note">
                            <select
                              className="sf-variants__input"
                              value={d.stockReason}
                              onChange={(e) => v.id && setField(v.id, 'stockReason', e.target.value)}
                            >
                              {STOCK_REASONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <input
                              className="sf-variants__input"
                              placeholder="Note (optional)"
                              value={d.stockNote}
                              onChange={(e) => v.id && setField(v.id, 'stockNote', e.target.value)}
                            />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="sf-variants__footer">
          {showManual ? (
            <div className="sf-variants__manual">
              <p className="sf-variants__manual-title">Add one variant</p>
              <div className="sf-variants__manual-grid">
                <input className="sf-variants__input" placeholder="Size" value={addDraft.size} onChange={(e) => setAddDraft((p) => ({ ...p, size: e.target.value }))} />
                <input className="sf-variants__input" placeholder="Colour" value={addDraft.colorName} onChange={(e) => setAddDraft((p) => ({ ...p, colorName: e.target.value, color: e.target.value }))} />
                <input type="number" min={0} className="sf-variants__input" placeholder="Price" value={addDraft.price} onChange={(e) => setAddDraft((p) => ({ ...p, price: e.target.value }))} />
                <input type="number" min={0} className="sf-variants__input" placeholder="Qty" value={addDraft.stock} onChange={(e) => setAddDraft((p) => ({ ...p, stock: e.target.value }))} />
              </div>
              <div className="sf-variants__manual-actions">
                <button type="button" className="sf-variants__btn sf-variants__btn--primary" disabled={createVariant.isPending} onClick={() => void submitAdd()}>
                  {createVariant.isPending ? 'Adding…' : 'Add variant'}
                </button>
                <button type="button" className="sf-variants__btn sf-variants__btn--ghost" onClick={() => { setShowManual(false); setAddDraft(EMPTY_DRAFT) }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="sf-variants__add-one" onClick={() => setShowManual(true)}>
              <Plus className="h-4 w-4" />
              Add another variant
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

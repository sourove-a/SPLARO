'use client'

import { useEffect, useState } from 'react'
import { Plus, Archive, Loader2 } from 'lucide-react'
import { useCreateProductVariant, useUpdateProductVariant, useArchiveProductVariant } from '@/lib/api/hooks'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import { cn } from '@/lib/utils/cn'
import type { ApiProduct } from '@/lib/api/products'

type Variant = NonNullable<ApiProduct['variants']>[number]

interface ProductVariantManagerProps {
  productId: string
  variants: Variant[]
  productImages: string[]
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
  size: '', color: '', colorName: '', colorHex: '#111111', image: '', sku: '', price: '', compareAtPrice: '', stock: '0',
  stockReason: 'Admin manual update', stockNote: '',
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

export function ProductVariantManager({ productId, variants, productImages }: ProductVariantManagerProps) {
  const updateVariant = useUpdateProductVariant()
  const createVariant = useCreateProductVariant()
  const archiveVariant = useArchiveProductVariant()

  const [drafts, setDrafts] = useState<Record<string, RowDraft>>(() => {
    const map: Record<string, RowDraft> = {}
    variants.forEach((v) => { if (v.id) map[v.id] = draftFromVariant(v) })
    return map
  })
  const [addOpen, setAddOpen] = useState(false)
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

  const draftFor = (v: Variant): RowDraft => (v.id && drafts[v.id]) || draftFromVariant(v)
  const setField = (id: string, key: keyof RowDraft, value: string) =>
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || draftFromVariant(variants.find((v) => v.id === id)!)), [key]: value },
    }))

  const syncDraftFromServer = (variantId: string, row: Variant) => {
    setDrafts((prev) => ({ ...prev, [variantId]: draftFromVariant(row) }))
  }

  const saveRow = (v: Variant) => {
    if (!v.id) return
    const d = draftFor(v)
    const price = Number(d.price)
    const stock = Number(d.stock)
    if (Number.isNaN(price) || price < 0) { toastFail('Enter a valid, non-negative price.'); return }
    if (Number.isNaN(stock) || stock < 0) { toastFail('Enter a valid, non-negative stock number.'); return }
    const stockChanged = stock !== serverStock(v)
    updateVariant.mutate(
      {
        productId,
        variantId: v.id,
        size: d.size.trim(),
        color: d.color.trim(),
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
      },
      {
        onSuccess: (updated) => {
          syncDraftFromServer(v.id!, (updated as Variant) ?? v)
          toastOk('Variant saved to server.')
        },
        onError: (err) => toastFail(err instanceof Error ? err.message : 'Could not update variant.'),
      },
    )
  }

  const toggleActive = (v: Variant) => {
    if (!v.id) return
    updateVariant.mutate(
      { productId, variantId: v.id, isActive: !(v.isActive ?? true) },
      {
        onSuccess: (updated) => {
          syncDraftFromServer(v.id!, (updated as Variant) ?? v)
          toastOk(v.isActive ? 'Variant deactivated.' : 'Variant activated.')
        },
        onError: (err) => toastFail(err instanceof Error ? err.message : 'Could not update variant.'),
      },
    )
  }

  const archiveRow = (v: Variant) => {
    if (!v.id) return
    if (!window.confirm(`Archive this variant (${v.size ?? '—'} / ${v.colorName ?? v.color ?? '—'})? It will be hidden from the storefront. This does not delete stock or order history.`)) return
    archiveVariant.mutate(
      { productId, variantId: v.id },
      {
        onSuccess: () => toastOk('Variant archived.'),
        onError: (err) => toastFail(err instanceof Error ? err.message : 'Could not archive variant.'),
      },
    )
  }

  const submitAdd = () => {
    const price = Number(addDraft.price)
    const stock = Number(addDraft.stock || '0')
    if (!addDraft.price.trim() || Number.isNaN(price) || price < 0) { toastFail('Enter a valid, non-negative price.'); return }
    if (Number.isNaN(stock) || stock < 0) { toastFail('Enter a valid, non-negative stock number.'); return }
    createVariant.mutate(
      {
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
      },
      {
        onSuccess: () => {
          toastOk('Variant added to server.')
          setAddDraft(EMPTY_DRAFT)
          setAddOpen(false)
        },
        onError: (err) => toastFail(err instanceof Error ? err.message : 'Could not add variant.'),
      },
    )
  }

  const rowBusy = (id?: string) => id != null && busyId === id

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-[rgba(17,17,17,0.06)]">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-[rgba(17,17,17,0.05)] bg-[rgba(17,17,17,0.02)]">
              {['Status', 'Size', 'Color', 'Hex', 'SKU', 'Price', 'Compare', 'Stock', 'Stock note', 'Image', ''].map((h) => (
                <th key={h} className="whitespace-nowrap px-2.5 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.1em] text-[#6B6B6B]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {variants.map((v, i) => {
              const d = draftFor(v)
              const active = v.isActive ?? true
              const busy = rowBusy(v.id)
              const stockChanged = Number(d.stock) !== serverStock(v)
              return (
                <tr key={v.id ?? i} className={cn('border-b border-[rgba(17,17,17,0.04)] last:border-0 transition-colors', !active && 'opacity-50')}>
                  <td className="px-2.5 py-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleActive(v)}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] disabled:opacity-50',
                        active ? 'bg-emerald-500/15 text-emerald-600' : 'bg-[rgba(17,17,17,0.08)] text-[#6B6B6B]',
                      )}
                    >
                      {active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-2.5 py-2">
                    <input className="admin-input w-16 text-[11px]" value={d.size} onChange={(e) => v.id && setField(v.id, 'size', e.target.value)} />
                  </td>
                  <td className="px-2.5 py-2">
                    <input className="admin-input w-24 text-[11px]" value={d.colorName} placeholder="Color name" onChange={(e) => v.id && setField(v.id, 'colorName', e.target.value)} />
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-4 w-4 flex-shrink-0 rounded-full border border-[rgba(17,17,17,0.1)]" style={{ background: d.colorHex || '#ccc' }} />
                      <input type="color" className="h-6 w-8" value={d.colorHex || '#111111'} onChange={(e) => v.id && setField(v.id, 'colorHex', e.target.value)} />
                    </div>
                  </td>
                  <td className="px-2.5 py-2">
                    <input className="admin-input w-28 font-mono text-[11px]" placeholder="SKU" value={d.sku} onChange={(e) => v.id && setField(v.id, 'sku', e.target.value)} />
                  </td>
                  <td className="px-2.5 py-2">
                    <input type="number" min={0} className="admin-input w-20 text-[11px]" value={d.price} onChange={(e) => v.id && setField(v.id, 'price', e.target.value)} />
                  </td>
                  <td className="px-2.5 py-2">
                    <input type="number" min={0} className="admin-input w-20 text-[11px]" placeholder="—" value={d.compareAtPrice} onChange={(e) => v.id && setField(v.id, 'compareAtPrice', e.target.value)} />
                  </td>
                  <td className="px-2.5 py-2">
                    <input
                      type="number" min={0}
                      className={cn('admin-input w-16 text-center font-black', Number(d.stock) < 5 && '!border-red-200 !bg-red-50 !text-red-700')}
                      value={d.stock}
                      onChange={(e) => v.id && setField(v.id, 'stock', e.target.value)}
                    />
                  </td>
                  <td className="px-2.5 py-2">
                    {stockChanged ? (
                      <div className="flex min-w-[140px] flex-col gap-1">
                        <select
                          className="admin-input text-[10px]"
                          value={d.stockReason}
                          onChange={(e) => v.id && setField(v.id, 'stockReason', e.target.value)}
                        >
                          {STOCK_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <input
                          className="admin-input text-[10px]"
                          placeholder="Note (optional)"
                          value={d.stockNote}
                          onChange={(e) => v.id && setField(v.id, 'stockNote', e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="text-[10px] font-semibold text-[#6B6B6B]">—</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    <select
                      className="admin-input w-24 text-[11px]"
                      value={d.image}
                      onChange={(e) => v.id && setField(v.id, 'image', e.target.value)}
                    >
                      <option value="">No image</option>
                      {productImages.map((url, idx) => <option key={url} value={url}>Image {idx + 1}</option>)}
                    </select>
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => saveRow(v)}
                        disabled={busy}
                        className="rounded-lg bg-[rgba(200,169,126,0.12)] px-2.5 py-1 text-[11px] font-black text-[#9a7b52] transition-colors hover:bg-[rgba(200,169,126,0.22)] disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveRow(v)}
                        disabled={busy || !active}
                        title={active ? 'Archive variant (hide from storefront)' : 'Already inactive'}
                        className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-black text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="rounded-lg bg-[rgba(17,17,17,0.03)] px-3 py-2 text-[11px] font-semibold text-[#6B6B6B]">
        Hard delete is not available yet — archive hides a variant from the storefront without losing stock or order history.
      </p>

      {addOpen ? (
        <div className="rounded-xl border border-dashed border-[rgba(200,169,126,0.4)] p-3">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#9a7b52]">Add variant</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input className="admin-input text-[11px]" placeholder="Size (e.g. M)" value={addDraft.size} onChange={(e) => setAddDraft((p) => ({ ...p, size: e.target.value }))} />
            <input className="admin-input text-[11px]" placeholder="Color name" value={addDraft.colorName} onChange={(e) => setAddDraft((p) => ({ ...p, colorName: e.target.value, color: e.target.value }))} />
            <div className="flex items-center gap-1.5">
              <span className="h-4 w-4 flex-shrink-0 rounded-full border border-[rgba(17,17,17,0.1)]" style={{ background: addDraft.colorHex || '#ccc' }} />
              <input type="color" className="h-8 w-full" value={addDraft.colorHex || '#111111'} onChange={(e) => setAddDraft((p) => ({ ...p, colorHex: e.target.value }))} />
            </div>
            <select className="admin-input text-[11px]" value={addDraft.image} onChange={(e) => setAddDraft((p) => ({ ...p, image: e.target.value }))}>
              <option value="">No image</option>
              {productImages.map((url, idx) => <option key={url} value={url}>Image {idx + 1}</option>)}
            </select>
            <input className="admin-input font-mono text-[11px]" placeholder="SKU (optional)" value={addDraft.sku} onChange={(e) => setAddDraft((p) => ({ ...p, sku: e.target.value }))} />
            <input type="number" min={0} className="admin-input text-[11px]" placeholder="Price *" value={addDraft.price} onChange={(e) => setAddDraft((p) => ({ ...p, price: e.target.value }))} />
            <input type="number" min={0} className="admin-input text-[11px]" placeholder="Compare price" value={addDraft.compareAtPrice} onChange={(e) => setAddDraft((p) => ({ ...p, compareAtPrice: e.target.value }))} />
            <input type="number" min={0} className="admin-input text-[11px]" placeholder="Opening stock" value={addDraft.stock} onChange={(e) => setAddDraft((p) => ({ ...p, stock: e.target.value }))} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={submitAdd}
              disabled={createVariant.isPending}
              className="rounded-lg bg-[var(--admin-brand-gold)] px-3 py-1.5 text-[11px] font-black text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {createVariant.isPending ? 'Adding…' : 'Add variant'}
            </button>
            <button
              type="button"
              onClick={() => { setAddOpen(false); setAddDraft(EMPTY_DRAFT) }}
              className="rounded-lg px-3 py-1.5 text-[11px] font-black text-[#6B6B6B] transition-colors hover:bg-[rgba(17,17,17,0.04)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-[rgba(200,169,126,0.4)] px-3 py-2 text-[11px] font-black text-[#9a7b52] transition-colors hover:bg-[rgba(200,169,126,0.06)]"
        >
          <Plus className="h-3.5 w-3.5" /> Add variant
        </button>
      )}
    </div>
  )
}

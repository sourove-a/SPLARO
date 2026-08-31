'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcField, DcInput } from '@/components/dc/product/DcProductFormPrimitives'
import { FONT, MONO } from '@/components/dc/tokens'
import {
  useArchiveProductVariant,
  useCreateProductVariant,
  useDeleteProductVariant,
  useUpdateProductVariant,
} from '@/lib/api/hooks'
import { toastFail, toastApiSaved, toastOk, toastWarn } from '@/lib/admin/feedback'
import { printVariantStickers } from '@/lib/admin/variant-stickers'
import { displaySizeLabel } from '@splaro/config'
import {
  confirmVariantArchived,
  confirmVariantCreated,
  confirmVariantDeleted,
  confirmVariantSaved,
} from '@/lib/admin/catalog-save'
import {
  verifyVariantCreated,
  verifyVariantPersisted,
  verifyVariantResponse,
} from '@/lib/admin/catalog-mutation-verify'
import { fetchProductInventory, type ApiProduct, type ProductInventoryEntry } from '@/lib/api/products'
import { discountPercentFromPrices, resolveSellingPrices } from '@/lib/admin/product-form-utils'
import { resolveMediaUrl } from '@/lib/media-url'
import {
  colourInputValue,
  DEFAULT_COLOUR_HEX,
  eyeDropperSupported,
  isValidHex,
  nearestColourName,
  normalizeHex,
  pickColourWithEyeDropper,
  sanitizeHexTyping,
  swatchCss,
} from '@/lib/admin/colour-names'
import { sizeChipsForDept, sizeDeptFromSlugOrName } from '@/lib/admin/size-presets'

const btnPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  height: 36,
  padding: '0 14px',
  borderRadius: 9,
  border: '1px solid var(--violet-bd)',
  background: 'var(--violet-solid)',
  color: 'var(--on-violet)',
  cursor: 'pointer',
  font: `600 12.5px/1 ${FONT}`,
}

const btnGhost: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  height: 36,
  padding: '0 14px',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  color: 'var(--ink-2)',
  cursor: 'pointer',
  font: `600 12.5px/1 ${FONT}`,
}

const btnLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 32,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'var(--violet)',
  cursor: 'pointer',
  font: `600 12px/1 ${FONT}`,
}

const selectStyle: CSSProperties = {
  height: 38,
  padding: '0 11px',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  font: `500 13px/1 ${FONT}`,
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '9px 12px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  background: 'var(--surface-2)',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  whiteSpace: 'nowrap',
}

function SizeChip({
  label,
  on,
  taken,
  disabled,
  onClick,
}: {
  label: string
  on: boolean
  taken?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={taken ? 'Already exists for every selected colour' : undefined}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 34,
        padding: '0 13px',
        borderRadius: 9,
        border: `1px solid ${on ? 'var(--violet-bd)' : 'var(--line)'}`,
        background: on ? 'var(--violet-soft)' : taken ? 'var(--surface-2)' : 'var(--surface)',
        color: on ? 'var(--violet)' : taken ? 'var(--ink-3)' : 'var(--ink-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        font: `600 12px/1 ${FONT}`,
        opacity: taken ? 0.5 : 1,
      }}
    >
      {on ? <DcIcon name="icon-check" size={12} /> : null}
      {label}
    </button>
  )
}

function ImageThumb({ url }: { url: string }) {
  if (!url.trim()) return null
  return (
    <Image
      src={resolveMediaUrl(url)}
      alt=""
      width={28}
      height={36}
      unoptimized
      style={{
        width: 28,
        height: 36,
        objectFit: 'cover',
        borderRadius: 6,
        border: '1px solid var(--line)',
        flex: 'none',
        background: 'var(--surface-2)',
      }}
    />
  )
}

type Variant = NonNullable<ApiProduct['variants']>[number]

interface ProductVariantManagerProps {
  productId: string
  variants: Variant[]
  productImages: string[]
  productName?: string
  /** Menu slug/name so size chips switch (footwear ≠ M/L/XL). */
  departmentHint?: string
  /** Product-level main (MRP) and sale — empty row prices inherit these. */
  productMainPrice?: string
  productSalePrice?: string
  /**
   * Lets the product panel's own "Save changes" flush unsaved variant rows too,
   * and show them as unsaved — editing stock and saving the product used to
   * drop the variant edits silently.
   */
  onUnsavedChange?: (count: number, save: () => Promise<void>) => void
}

interface RowDraft {
  size: string
  color: string
  colorName: string
  colorHex: string
  image: string
  sku: string
  barcode: string
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
    size: displaySizeLabel(v.size) || '',
    color: v.color ?? '',
    colorName: v.colorName ?? '',
    colorHex: v.colorHex ?? '',
    image: v.image ?? '',
    sku: v.sku ?? '',
    barcode: v.barcode ?? '',
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
  barcode: '',
  price: '',
  compareAtPrice: '',
  stock: '10',
  stockReason: 'Admin manual update',
  stockNote: '',
}

function pendingVariantId(
  ...mutations: Array<[boolean, { variantId?: string } | undefined]>
): string | null {
  for (const [pending, vars] of mutations) {
    if (pending && vars?.variantId) return vars.variantId
  }
  return null
}

function existingSizeKey(size: string, colorHex: string) {
  return `${size.trim().toLowerCase()}::${colorHex.trim().toLowerCase() || 'default'}`
}

interface ColourDraft {
  id: string
  name: string
  hex: string
  image: string
}

let colourSeq = 0
function nextColourId(): string {
  colourSeq += 1
  return `c-${colourSeq}`
}

function colourRowsFromVariants(rows: Variant[]): ColourDraft[] {
  const seen = new Set<string>()
  const out: ColourDraft[] = []
  for (const v of rows) {
    const hex = normalizeHex(v.colorHex || '') ?? DEFAULT_COLOUR_HEX
    if (seen.has(hex)) continue
    seen.add(hex)
    out.push({
      id: `c-seed-${hex.replace('#', '')}`,
      name: (v.colorName || v.color || 'Default').trim() || 'Default',
      hex,
      image: (v.image || '').trim(),
    })
  }
  return out.length
    ? out
    : [{ id: 'c-seed-default', name: 'Default', hex: DEFAULT_COLOUR_HEX, image: '' }]
}

function isDraftEdited(d: RowDraft, base: RowDraft): boolean {
  return (
    d.size !== base.size ||
    d.colorName !== base.colorName ||
    d.colorHex !== base.colorHex ||
    d.image !== base.image ||
    d.sku !== base.sku ||
    d.barcode !== base.barcode ||
    d.price !== base.price ||
    d.compareAtPrice !== base.compareAtPrice ||
    d.stock !== base.stock
  )
}

function isRowDirty(v: Variant, d: RowDraft): boolean {
  const base = draftFromVariant(v)
  return (
    d.size !== base.size ||
    d.colorName !== base.colorName ||
    d.colorHex !== base.colorHex ||
    d.image !== base.image ||
    d.sku !== base.sku ||
    d.barcode !== base.barcode ||
    d.price !== base.price ||
    d.compareAtPrice !== base.compareAtPrice ||
    d.stock !== base.stock
  )
}

function stockStatus(qty: number): { label: string; fg: string; bg: string; bd: string } {
  if (qty <= 0) {
    return { label: 'Out', fg: 'var(--bad)', bg: 'var(--bad-soft)', bd: 'var(--bad-bd)' }
  }
  if (qty < 5) {
    return { label: 'Low', fg: 'var(--warn)', bg: 'var(--warn-soft)', bd: 'var(--warn-bd)' }
  }
  return { label: 'In', fg: 'var(--ok)', bg: 'var(--ok-soft)', bd: 'var(--ok-bd)' }
}

async function copyText(label: string, value: string) {
  const text = value.trim()
  if (!text) {
    toastFail(`No ${label.toLowerCase()} to copy.`)
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    toastOk(`${label} copied`)
  } catch {
    toastFail(`Could not copy ${label.toLowerCase()}.`)
  }
}

function formatLedgerWhen(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CodeChip({ label, value }: { label: string; value: string }) {
  const text = value.trim()
  return (
    <button
      type="button"
      title={text ? `Copy ${label}` : `No ${label}`}
      onClick={() => void copyText(label, text)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        maxWidth: 180,
        padding: '4px 8px',
        borderRadius: 7,
        border: '1px solid var(--line)',
        background: 'var(--surface-2)',
        color: text ? 'var(--ink)' : 'var(--ink-3)',
        cursor: text ? 'pointer' : 'default',
        font: `500 11px/1.2 ${MONO}`,
        textAlign: 'left',
      }}
    >
      <span style={{ font: `600 8.5px/1 ${FONT}`, letterSpacing: '.08em', color: 'var(--ink-3)' }}>
        {label}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {text || '—'}
      </span>
    </button>
  )
}

function rowPrices(
  d: RowDraft,
  productMainPrice: string,
  productSalePrice: string,
): { sale: string; main: string; pct: number | null } {
  const inherited = resolveSellingPrices(productMainPrice, productSalePrice)
  const sale = d.price.trim() || (inherited.sellingPrice ? String(inherited.sellingPrice) : '')
  const main =
    d.compareAtPrice.trim() ||
    (inherited.compareAt ? String(inherited.compareAt) : productMainPrice.trim())
  return { sale, main, pct: discountPercentFromPrices(main, sale) }
}

export function ProductVariantManager({
  productId,
  variants,
  productImages,
  productName,
  departmentHint,
  productMainPrice = '',
  productSalePrice = '',
  onUnsavedChange,
}: ProductVariantManagerProps) {
  const updateVariant = useUpdateProductVariant()
  const createVariant = useCreateProductVariant()
  const archiveVariant = useArchiveProductVariant()
  const deleteVariant = useDeleteProductVariant()

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
  const serverDraftRef = useRef<Record<string, RowDraft>>({})
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [customSize, setCustomSize] = useState('')
  const [colorRows, setColorRows] = useState<ColourDraft[]>(() => colourRowsFromVariants(variants))
  const [bulk, setBulk] = useState({ stock: '10' })
  const [bulkBusy, setBulkBusy] = useState(false)
  const [skuPrefix, setSkuPrefix] = useState('')
  const [bulkAllBusy, setBulkAllBusy] = useState<'sku' | 'save' | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [addDraft, setAddDraft] = useState<RowDraft>(EMPTY_DRAFT)
  const [query, setQuery] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all')
  const [colourFilter, setColourFilter] = useState('all')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [historyRows, setHistoryRows] = useState<ProductInventoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const busyId = pendingVariantId(
    [updateVariant.isPending, updateVariant.variables as { variantId?: string } | undefined],
    [archiveVariant.isPending, archiveVariant.variables as { variantId?: string } | undefined],
    [deleteVariant.isPending, deleteVariant.variables as { variantId?: string } | undefined],
  )

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev }
      const liveIds = new Set<string>()
      variants.forEach((v) => {
        if (!v.id) return
        liveIds.add(v.id)
        const fresh = draftFromVariant(v)
        const lastServer = serverDraftRef.current[v.id]
        serverDraftRef.current[v.id] = fresh
        if (v.id === busyId) return
        // Keep whatever the admin is typing: only take server values when the row
        // has no unsaved local edits (compared against the previous server snapshot).
        const local = prev[v.id]
        if (local && lastServer && isDraftEdited(local, lastServer)) return
        next[v.id] = fresh
      })
      Object.keys(next).forEach((id) => {
        if (!liveIds.has(id)) {
          delete next[id]
          delete serverDraftRef.current[id]
        }
      })
      return next
    })
  }, [variants, busyId])

  const openHistory = async (variantId: string) => {
    if (historyFor === variantId) {
      setHistoryFor(null)
      return
    }
    setHistoryFor(variantId)
    setHistoryLoading(true)
    try {
      const res = await fetchProductInventory(productId, { variantId, limit: 20 })
      setHistoryRows(res.items ?? [])
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not load stock history.')
      setHistoryRows([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const existingKeys = useMemo(() => {
    const keys = new Set<string>()
    variants.forEach((v) => {
      const size = (v.id && drafts[v.id]?.size) || displaySizeLabel(v.size) || ''
      const hex = (v.id && drafts[v.id]?.colorHex) || v.colorHex || ''
      if (size.trim()) keys.add(existingSizeKey(size, hex))
    })
    return keys
  }, [variants, drafts])

  const totalAvailable = useMemo(
    () => variants.reduce((sum, v) => sum + (v.id ? Number(drafts[v.id]?.stock ?? serverStock(v)) : serverStock(v)), 0),
    [variants, drafts],
  )
  const productSelling = resolveSellingPrices(productMainPrice, productSalePrice).sellingPrice

  const draftFor = (v: Variant): RowDraft => (v.id && drafts[v.id]) || draftFromVariant(v)
  const setField = (id: string, key: keyof RowDraft, value: string) =>
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || draftFromVariant(variants.find((row) => row.id === id)!)), [key]: value },
    }))

  const readyColours = useMemo(
    () =>
      colorRows.filter((row) => row.name.trim() && (normalizeHex(row.hex) || isValidHex(row.hex))),
    [colorRows],
  )

  const generatePlan = useMemo(() => {
    const combos = selectedSizes.flatMap((size) =>
      readyColours.map((colour) => ({
        size,
        colour,
        key: existingSizeKey(size, normalizeHex(colour.hex) ?? colour.hex),
      })),
    )
    const fresh = combos.filter((row) => !existingKeys.has(row.key))
    return { total: combos.length, fresh: fresh.length, skip: combos.length - fresh.length, rows: fresh }
  }, [selectedSizes, readyColours, existingKeys])

  const dirtyIds = useMemo(() => {
    const ids = new Set<string>()
    for (const v of variants) {
      if (!v.id) continue
      if (isRowDirty(v, drafts[v.id] || draftFromVariant(v))) ids.add(v.id)
    }
    return ids
  }, [variants, drafts])

  const colourOptions = useMemo(() => {
    const map = new Map<string, { hex: string; name: string }>()
    for (const v of variants) {
      const d = v.id && drafts[v.id] ? drafts[v.id] : draftFromVariant(v)
      const hex = (d?.colorHex || DEFAULT_COLOUR_HEX).trim().toLowerCase()
      if (!map.has(hex)) {
        map.set(hex, { hex, name: d?.colorName || v.colorName || v.color || 'Default' })
      }
    }
    return [...map.values()]
  }, [variants, drafts])

  const filteredVariants = useMemo(() => {
    const q = query.trim().toLowerCase()
    return variants.filter((v) => {
      const d = (v.id && drafts[v.id]) || draftFromVariant(v)
      const qty = Number(d.stock)
      if (stockFilter === 'out' && qty > 0) return false
      if (stockFilter === 'low' && (qty <= 0 || qty >= 5)) return false
      if (stockFilter === 'in' && qty < 5) return false
      if (colourFilter !== 'all' && d.colorHex.trim().toLowerCase() !== colourFilter) return false
      if (!q) return true
      const hay = [d.size, d.colorName, d.sku, d.barcode, d.price].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [variants, drafts, query, stockFilter, colourFilter])

  const groupedVariants = useMemo(() => {
    const groups: Array<{ key: string; hex: string; name: string; rows: Variant[] }> = []
    const index = new Map<string, number>()
    for (const v of filteredVariants) {
      const d = (v.id && drafts[v.id]) || draftFromVariant(v)
      const hex = (d.colorHex || DEFAULT_COLOUR_HEX).trim().toLowerCase()
      const name = d.colorName || 'Default'
      const key = hex || name.toLowerCase()
      const existing = index.get(key)
      if (existing == null) {
        index.set(key, groups.length)
        groups.push({ key, hex, name, rows: [v] })
      } else {
        groups[existing]?.rows.push(v)
      }
    }
    for (const group of groups) {
      group.rows.sort((a, b) => {
        const sa = ((a.id && drafts[a.id]) || draftFromVariant(a)).size
        const sb = ((b.id && drafts[b.id]) || draftFromVariant(b)).size
        const ia = sizeChips.indexOf(sa)
        const ib = sizeChips.indexOf(sb)
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || sa.localeCompare(sb)
      })
    }
    return groups
  }, [filteredVariants, drafts, sizeChips])

  const syncDraftFromServer = (variantId: string, row: Variant) => {
    const fresh = draftFromVariant(row)
    serverDraftRef.current[variantId] = fresh
    setDrafts((prev) => ({ ...prev, [variantId]: fresh }))
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

  const updateColourRow = (id: string, patch: Partial<ColourDraft>) => {
    setColorRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const addColourRow = () => {
    setColorRows((rows) => [
      ...rows,
      { id: nextColourId(), name: '', hex: DEFAULT_COLOUR_HEX, image: '' },
    ])
  }

  const removeColourRow = (id: string) => {
    setColorRows((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== id)))
  }

  const pickColourForRow = async (id: string) => {
    if (!eyeDropperSupported()) {
      toastWarn('Eyedropper needs Chrome or Edge')
      return
    }
    const picked = await pickColourWithEyeDropper()
    if (!picked) return
    updateColourRow(id, { hex: picked.hex, name: picked.name })
    toastOk(`${picked.name} · ${picked.hex}`)
  }

  const createSizesBulk = async () => {
    if (!selectedSizes.length) {
      toastFail('Select at least one size.')
      return
    }
    if (!readyColours.length) {
      toastFail('Add at least one named colour.')
      return
    }
    const inherited = resolveSellingPrices(productMainPrice, productSalePrice)
    const price = inherited.sellingPrice
    const stock = Number(bulk.stock || '0')
    const compareAt = inherited.compareAt ?? null
    if (!price) {
      toastFail('Set Main / Sale on the product first.')
      return
    }
    if (Number.isNaN(stock) || stock < 0) {
      toastFail('Enter a valid quantity.')
      return
    }
    if (compareAt != null && (Number.isNaN(compareAt) || compareAt < 0)) {
      toastFail('Compare-at must be a valid price.')
      return
    }
    if (!generatePlan.fresh) {
      toastFail('Those size × colour combos already exist.')
      return
    }

    setBulkBusy(true)
    let created = 0
    try {
      for (const row of generatePlan.rows) {
        const colorName = row.colour.name.trim() || 'Default'
        const colorHex = normalizeHex(row.colour.hex) ?? DEFAULT_COLOUR_HEX
        const payload = {
          productId,
          price,
          stock,
          size: row.size,
          color: colorName,
          colorName,
          colorHex,
          ...(row.colour.image.trim() ? { image: row.colour.image.trim() } : {}),
          ...(compareAt != null ? { compareAtPrice: compareAt } : {}),
        }
        try {
          const saved = await createVariant.mutateAsync(payload)
          if (!verifyVariantResponse(saved, { price, stock, size: row.size })) continue
          const id =
            saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
          if (!id || !(await verifyVariantCreated(productId, id, { price, stock, size: row.size }))) continue
          created += 1
        } catch (err) {
          toastFail(err instanceof Error ? err.message : `Could not add ${row.size} / ${colorName}.`)
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

  const saveAllDirty = async () => {
    const targets = variants.filter((v) => v.id && dirtyIds.has(v.id))
    if (!targets.length) return
    setBulkAllBusy('save')
    let saved = 0
    let failed = 0
    try {
      for (const v of targets) {
        if (!v.id) continue
        const d = draftFor(v)
        const priced = rowPrices(d, productMainPrice, productSalePrice)
        const price = Number(priced.sale)
        const stock = Number(d.stock)
        if (Number.isNaN(price) || price < 0 || Number.isNaN(stock) || stock < 0) {
          failed += 1
          continue
        }
        const stockChanged = stock !== serverStock(v)
        const compareAt = priced.main.trim() && Number(priced.main) > price ? Number(priced.main) : null
        try {
          const result = await updateVariant.mutateAsync({
            productId,
            variantId: v.id,
            size: d.size.trim(),
            color: d.color.trim() || d.colorName.trim(),
            colorName: d.colorName.trim(),
            colorHex: d.colorHex.trim(),
            image: d.image.trim(),
            sku: d.sku.trim(),
            barcode: d.barcode.trim(),
            price,
            compareAtPrice: compareAt,
            stock,
            ...(stockChanged
              ? {
                  stockReason: d.stockReason.trim() || 'Admin manual update',
                  ...(d.stockNote.trim() ? { stockNote: d.stockNote.trim() } : {}),
                }
              : {}),
          })
          if (!verifyVariantResponse(result, { price, stock, size: d.size.trim() })) {
            failed += 1
            continue
          }
          if (!(await verifyVariantPersisted(productId, v.id, { price, stock, size: d.size.trim() }))) {
            failed += 1
            continue
          }
          saved += 1
          syncDraftFromServer(v.id, {
            ...v,
            size: d.size.trim(),
            colorName: d.colorName.trim(),
            colorHex: d.colorHex.trim(),
            image: d.image.trim(),
            sku: d.sku.trim(),
            barcode: d.barcode.trim(),
            price,
            compareAtPrice: d.compareAtPrice.trim() ? Number(d.compareAtPrice) : null,
            stock,
            stockQuantity: stock,
          })
        } catch {
          failed += 1
        }
      }
      if (saved && failed) toastFail(`Saved ${saved}, ${failed} failed`)
      else if (saved) toastApiSaved(`${saved} variant${saved === 1 ? '' : 's'} saved`)
      else toastFail('Could not save unsaved variants.')
    } finally {
      setBulkAllBusy(null)
    }
  }

  const saveAllRef = useRef(saveAllDirty)
  useEffect(() => {
    saveAllRef.current = saveAllDirty
  })
  useEffect(() => {
    onUnsavedChange?.(dirtyIds.size, () => saveAllRef.current())
  }, [dirtyIds.size, onUnsavedChange])

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
    const inherited = resolveSellingPrices(productMainPrice, productSalePrice)
    const price = inherited.sellingPrice
    const compareAt = inherited.compareAt ?? null
    if (!price) {
      toastFail('Set Main / Sale on the product first.')
      return
    }
    if (!variants.length) return
    if (!window.confirm(`Set every variant to the product price (৳${price})?`)) return

    setBulkBusy(true)
    let saved = 0
    try {
      for (const v of variants) {
        if (!v.id || !(v.isActive ?? true)) continue
        const d = draftFor(v)
        const stock = Number(d.stock || serverStock(v))
        setField(v.id, 'price', String(price))
        if (compareAt) setField(v.id, 'compareAtPrice', String(compareAt))
        try {
          const result = await updateVariant.mutateAsync({
            productId,
            variantId: v.id,
            price,
            compareAtPrice: compareAt,
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
          syncDraftFromServer(v.id, { ...v, price, compareAtPrice: compareAt })
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
    const priced = rowPrices(d, productMainPrice, productSalePrice)
    const price = Number(priced.sale)
    const stock = Number(d.stock)
    if (Number.isNaN(price) || price < 0) { toastFail('Enter a valid price.'); return }
    if (Number.isNaN(stock) || stock < 0) { toastFail('Enter a valid quantity.'); return }
    const stockChanged = stock !== serverStock(v)
    const compareAt = priced.main.trim() && Number(priced.main) > price ? Number(priced.main) : null
    const payload = {
      productId,
      variantId: v.id,
      size: d.size.trim(),
      color: d.color.trim() || d.colorName.trim(),
      colorName: d.colorName.trim(),
      colorHex: d.colorHex.trim(),
      image: d.image.trim(),
      sku: d.sku.trim(),
      barcode: d.barcode.trim(),
      price,
      compareAtPrice: compareAt,
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
      if (historyFor === v.id) void openHistory(v.id)
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

  /**
   * Applies one value across every variant at once. Editing 50 rows by hand was
   * the only way to reprice a size/colour matrix.
   */
  const applyToAllVariants = async (
    label: string,
    valueFor: (row: Variant, index: number) => Partial<{ price: number; sku: string }>,
  ) => {
    const targets = variants.filter((row) => row.id)
    if (targets.length === 0) {
      toastFail('No variants to update yet.')
      return
    }

    let saved = 0
    let failed = 0
    for (const [index, row] of targets.entries()) {
      if (!row.id) continue
      const d = draftFor(row)
      const override = valueFor(row, index)
      const price = override.price ?? Number(d.price || row.price || 0)
      const sku = (override.sku ?? d.sku ?? row.sku ?? '').trim()
      const stock = Number(d.stock || serverStock(row))

      const ok = await confirmVariantSaved(
        productId,
        row.id,
        { price, stock, size: (d.size || row.size || '').trim() },
        () =>
          updateVariant.mutateAsync({
            productId,
            variantId: row.id!,
            size: (d.size || row.size || '').trim(),
            color: (d.color || row.color || '').trim(),
            colorName: (d.colorName || row.colorName || '').trim(),
            colorHex: (d.colorHex || row.colorHex || '').trim(),
            image: (d.image || row.image || '').trim(),
            sku,
            price,
            stock,
          }),
      )
      if (ok) {
        saved += 1
        if (override.price !== undefined) setField(row.id, 'price', String(price))
        if (override.sku !== undefined) setField(row.id, 'sku', sku)
        syncDraftFromServer(row.id, { ...row, price, sku })
      } else {
        failed += 1
      }
    }

    // Each row is its own request, so a partial result is real — report it.
    if (saved && failed) toastFail(`${label}: ${saved} updated, ${failed} failed`)
    else if (saved) toastOk(`${label} — ${saved} variant${saved === 1 ? '' : 's'} updated`)
  }

  const handleAutoSku = async () => {
    const prefix = (skuPrefix.trim() || 'SKU').toUpperCase().replace(/[^A-Z0-9]+/g, '')
    if (!prefix) {
      toastFail('Enter an SKU prefix.')
      return
    }
    const seen = new Set<string>()
    setBulkAllBusy('sku')
    try {
      await applyToAllVariants('SKUs generated', (row, index) => {
        const d = draftFor(row)
        const part = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '')
        const size = part(d.size || row.size || '')
        const colour = part(d.colorName || row.colorName || d.color || row.color || '')
        let sku = [prefix, size, colour].filter(Boolean).join('-')
        if (sku === prefix) sku = `${prefix}-${index + 1}`
        // A duplicate SKU would be rejected by the API — disambiguate here.
        let candidate = sku
        let n = 2
        while (seen.has(candidate)) candidate = `${sku}-${n++}`
        seen.add(candidate)
        return { sku: candidate }
      })
    } finally {
      setBulkAllBusy(null)
    }
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
    if (!window.confirm(`Archive variant ${displaySizeLabel(v.size) || '—'} / ${v.colorName ?? v.color ?? '—'}?`)) return
    const ok = await confirmVariantArchived(
      productId,
      v.id,
      () => archiveVariant.mutateAsync({ productId, variantId: v.id! }),
    )
    if (ok) syncDraftFromServer(v.id, { ...v, isActive: false })
  }

  const deleteRow = async (v: Variant) => {
    if (!v.id) return
    const label = `${displaySizeLabel(v.size) || '—'} / ${v.colorName ?? v.color ?? '—'}`
    if (!window.confirm(
      `Remove ${label} for good?\n\nUse this for a size that was added by mistake. ` +
        'A size that has already sold cannot be removed — archive it instead.',
    )) return
    await confirmVariantDeleted(
      productId,
      v.id,
      label,
      () => deleteVariant.mutateAsync({ productId, variantId: v.id! }),
    )
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
      ...(addDraft.barcode.trim() ? { barcode: addDraft.barcode.trim() } : {}),
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

  /**
   * Seed the manual add form from the variants already on the product so the
   * admin only has to confirm — SKU/barcode stay blank because the API issues
   * the canonical codes on create.
   */
  const nextVariantDraft = (): RowDraft => {
    const last = variants.length ? variants[variants.length - 1] : null
    const base = last ? draftFor(last) : null
    const usedSizes = variants.map((v) => (v.id && drafts[v.id]?.size) || displaySizeLabel(v.size) || '')
    const known = new Set(usedSizes.map((s) => s.trim().toLowerCase()).filter(Boolean))
    const numeric = usedSizes.map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0)

    let size = ''
    if (numeric.length === usedSizes.filter(Boolean).length && numeric.length > 0) {
      size = String(Math.max(...numeric) + 1)
    } else {
      size = sizeChips.find((chip) => !known.has(chip.trim().toLowerCase())) ?? ''
    }

    return {
      ...EMPTY_DRAFT,
      size,
      color: base?.color ?? '',
      colorName: base?.colorName || EMPTY_DRAFT.colorName,
      colorHex: base?.colorHex || EMPTY_DRAFT.colorHex,
      image: base?.image ?? '',
      price: base?.price || productSalePrice.trim() || productMainPrice.trim(),
      compareAtPrice: base?.compareAtPrice || productMainPrice.trim(),
      stock: base?.stock || EMPTY_DRAFT.stock,
    }
  }

  const rowBusy = (id?: string) => id != null && busyId === id

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          border: '1px solid var(--line)',
          borderRadius: 12,
          background: 'var(--surface-2)',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>Size × colour matrix</span>
          <span style={{ font: `400 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
            Pick sizes + colours, then generate only the missing combos.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={btnLink} onClick={() => setSelectedSizes([...sizeChips])}>
            Select all sizes
          </button>
          <button type="button" style={btnLink} onClick={() => setSelectedSizes([])} disabled={!selectedSizes.length}>
            Clear
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {sizeChips.map((size) => {
            const taken =
              readyColours.length > 0 &&
              readyColours.every((c) =>
                existingKeys.has(existingSizeKey(size, normalizeHex(c.hex) ?? c.hex)),
              )
            return (
              <SizeChip
                key={size}
                label={size}
                on={selectedSizes.includes(size)}
                taken={taken}
                disabled={bulkBusy}
                onClick={() => toggleSizeChip(size)}
              />
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 360 }}>
          <DcInput
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
          <button type="button" style={{ ...btnGhost, flex: 'none' }} onClick={addCustomSize} disabled={!customSize.trim()}>
            Add
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {colorRows.map((row) => (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto auto minmax(120px, 1fr) minmax(110px, 140px) minmax(140px, 1fr) auto',
                gap: 8,
                alignItems: 'center',
                padding: 10,
                borderRadius: 10,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
              }}
            >
              <label
                title="Pick colour"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  border: '1px solid var(--line-2)',
                  background: swatchCss(row.hex),
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  flex: 'none',
                }}
              >
                <input
                  type="color"
                  value={colourInputValue(row.hex)}
                  onChange={(e) => {
                    const hex = normalizeHex(e.target.value) ?? e.target.value
                    updateColourRow(row.id, {
                      hex,
                      name:
                        !row.name.trim() || row.name === nearestColourName(row.hex)
                          ? nearestColourName(e.target.value)
                          : row.name,
                    })
                  }}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', border: 0 }}
                />
              </label>
              <button
                type="button"
                title="Eyedropper"
                onClick={() => void pickColourForRow(row.id)}
                style={{ ...btnGhost, width: 34, height: 34, padding: 0 }}
              >
                <DcIcon name="icon-pipette" size={14} />
              </button>
              <DcInput
                placeholder="Colour name"
                value={row.name}
                onChange={(e) => updateColourRow(row.id, { name: e.target.value })}
                style={{ height: 34 }}
              />
              <DcInput
                mono
                placeholder="#RRGGBB"
                value={row.hex}
                onChange={(e) => {
                  const typed = sanitizeHexTyping(e.target.value)
                  const n = normalizeHex(typed)
                  updateColourRow(row.id, {
                    hex: n ?? typed,
                    ...(n && (!row.name.trim() || row.name === nearestColourName(row.hex))
                      ? { name: nearestColourName(n) }
                      : {}),
                  })
                }}
                style={{
                  height: 34,
                  ...(row.hex && !isValidHex(row.hex) ? { borderColor: 'var(--bad)', color: 'var(--bad)' } : {}),
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <ImageThumb url={row.image} />
                <select
                  style={{ ...selectStyle, height: 34 }}
                  value={row.image}
                  onChange={(e) => updateColourRow(row.id, { image: e.target.value })}
                >
                  <option value="">Image</option>
                  {productImages.filter(Boolean).map((url, idx) => (
                    <option key={url} value={url}>
                      Image {idx + 1}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                title="Remove colour"
                onClick={() => removeColourRow(row.id)}
                disabled={colorRows.length <= 1}
                style={{ ...btnGhost, width: 34, height: 34, padding: 0, opacity: colorRows.length <= 1 ? 0.4 : 1 }}
              >
                <DcIcon name="icon-trash-2" size={13} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addColourRow} style={{ ...btnGhost, alignSelf: 'flex-start', borderStyle: 'dashed' }}>
            <DcIcon name="icon-plus" size={13} />
            Add colour
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, 200px)',
            gap: 10,
          }}
        >
          <DcField label="Stock each" hint="Price uses Main / Sale on this product">
            <DcInput
              mono
              inputMode="numeric"
              value={bulk.stock}
              onChange={(e) => setBulk((p) => ({ ...p, stock: e.target.value.replace(/[^\d]/g, '') }))}
            />
          </DcField>
        </div>

        <div
          className="dc-variant-summary"
          style={{ margin: 0 }}
        >
          <DcIcon name="icon-layers" size={14} color="var(--ink-3)" />
          <span style={{ flex: 1, font: `500 12.5px/1.35 ${FONT}`, color: 'var(--ink-2)' }}>
            {selectedSizes.length} sizes × {readyColours.length} colours → {generatePlan.fresh} new
            {generatePlan.skip ? ` · ${generatePlan.skip} already exist` : ''}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={{
              ...btnPrimary,
              opacity: bulkBusy || !generatePlan.fresh ? 0.55 : 1,
              cursor: bulkBusy || !generatePlan.fresh ? 'not-allowed' : 'pointer',
            }}
            disabled={bulkBusy || !generatePlan.fresh}
            onClick={() => void createSizesBulk()}
          >
            <DcIcon name="icon-plus" size={14} />
            {bulkBusy
              ? 'Generating…'
              : generatePlan.fresh
                ? `Generate ${generatePlan.fresh} variant${generatePlan.fresh === 1 ? '' : 's'}`
                : 'Generate variants'}
          </button>
          <button
            type="button"
            style={{ ...btnLink, opacity: bulkBusy || !variants.length || !productSelling ? 0.4 : 1 }}
            disabled={bulkBusy || !variants.length || !productSelling}
            onClick={() => void applyPriceToAll()}
          >
            Apply product price to all
          </button>
          <button
            type="button"
            style={{ ...btnLink, opacity: bulkBusy || !variants.length ? 0.4 : 1 }}
            disabled={bulkBusy || !variants.length}
            onClick={() => void applyStockToAll()}
          >
            Apply quantity to all
          </button>
          <button
            type="button"
            style={{ ...btnLink, opacity: !variants.length ? 0.4 : 1 }}
            disabled={!variants.length}
            onClick={() =>
              printVariantStickers(
                variants.map((v) => {
                  const d = draftFor(v)
                  return {
                    name: [productName?.trim(), d.colorName.trim() || d.color.trim()]
                      .filter(Boolean)
                      .join(' · ') || 'SPLARO',
                    size: displaySizeLabel(d.size.trim() || v.size) || '',
                    sku: d.sku.trim() || v.sku || '',
                    barcode: d.barcode.trim() || v.barcode || '',
                  }
                }),
              )
            }
          >
            Print stickers
          </button>
        </div>
      </div>

      <div className="dc-variant-summary">
        <DcIcon name="icon-layers" size={14} color="var(--ink-3)" />
        <span style={{ flex: 1, minWidth: 160, font: `500 12.5px/1.35 ${FONT}`, color: 'var(--ink-2)' }}>
          {variants.length} variant{variants.length === 1 ? '' : 's'} · {totalAvailable} available
          {dirtyIds.size ? ` · ${dirtyIds.size} unsaved` : ''}
        </span>
        {dirtyIds.size ? (
          <button
            type="button"
            style={{ ...btnPrimary, height: 32, opacity: bulkAllBusy === 'save' ? 0.55 : 1 }}
            disabled={bulkAllBusy === 'save'}
            onClick={() => void saveAllDirty()}
          >
            {bulkAllBusy === 'save' ? 'Saving…' : `Save ${dirtyIds.size} unsaved`}
          </button>
        ) : null}
      </div>

      {variants.length === 0 ? (
        <div
          style={{
            border: '1px dashed var(--line-2)',
            borderRadius: 12,
            padding: '28px 16px',
            textAlign: 'center',
            color: 'var(--ink-3)',
            font: `400 12.5px/1.5 ${FONT}`,
          }}
        >
          No variants yet. Select sizes + colours above and generate.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <DcInput
              placeholder="Search size, colour, SKU…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ maxWidth: 240, height: 34 }}
            />
            {(['all', 'in', 'low', 'out'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setStockFilter(key)}
                style={{
                  height: 30,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: `1px solid ${stockFilter === key ? 'var(--violet-bd)' : 'var(--line)'}`,
                  background: stockFilter === key ? 'var(--violet-soft)' : 'var(--surface)',
                  color: stockFilter === key ? 'var(--violet)' : 'var(--ink-2)',
                  cursor: 'pointer',
                  font: `600 11.5px/1 ${FONT}`,
                }}
              >
                {key === 'all' ? 'All stock' : key === 'in' ? 'In stock' : key === 'low' ? 'Low' : 'Out'}
              </button>
            ))}
            {colourOptions.length > 1
              ? [
                  <button
                    key="all-c"
                    type="button"
                    onClick={() => setColourFilter('all')}
                    style={{
                      height: 30,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: `1px solid ${colourFilter === 'all' ? 'var(--violet-bd)' : 'var(--line)'}`,
                      background: colourFilter === 'all' ? 'var(--violet-soft)' : 'var(--surface)',
                      color: colourFilter === 'all' ? 'var(--violet)' : 'var(--ink-2)',
                      cursor: 'pointer',
                      font: `600 11.5px/1 ${FONT}`,
                    }}
                  >
                    All colours
                  </button>,
                  ...colourOptions.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColourFilter(c.hex)}
                      title={c.name}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 30,
                        padding: '0 10px',
                        borderRadius: 8,
                        border: `1px solid ${colourFilter === c.hex ? 'var(--violet-bd)' : 'var(--line)'}`,
                        background: colourFilter === c.hex ? 'var(--violet-soft)' : 'var(--surface)',
                        cursor: 'pointer',
                        font: `600 11.5px/1 ${FONT}`,
                        color: 'var(--ink-2)',
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 99,
                          background: swatchCss(c.hex),
                          border: '1px solid var(--line-2)',
                        }}
                      />
                      {c.name}
                    </button>
                  )),
                ]
              : null}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'end',
              padding: '12px 13px',
              borderRadius: 11,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
            }}
          >
            <DcField label="SKU prefix">
              <div style={{ display: 'flex', gap: 8, minWidth: 240 }}>
                <DcInput
                  mono
                  value={skuPrefix}
                  onChange={(e) => setSkuPrefix(e.target.value)}
                  placeholder="SPL-SHIRT"
                />
                <button
                  type="button"
                  style={{
                    ...btnGhost,
                    flex: 'none',
                    opacity: bulkAllBusy !== null || !skuPrefix.trim() ? 0.5 : 1,
                  }}
                  disabled={bulkAllBusy !== null || !skuPrefix.trim()}
                  title="PREFIX-SIZE-COLOUR for every variant"
                  onClick={() => void handleAutoSku()}
                >
                  {bulkAllBusy === 'sku' ? 'Generating…' : 'Auto SKUs'}
                </button>
              </div>
            </DcField>
          </div>

          <div className="dc-variant-matrix">
            <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Variant</th>
                  <th style={thStyle}>Sale</th>
                  <th style={thStyle}>Main</th>
                  <th style={thStyle}>Off</th>
                  <th style={thStyle}>Stock</th>
                  <th style={thStyle}>Codes</th>
                  <th style={thStyle}>Image</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {filteredVariants.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 24, textAlign: 'center', font: `400 12.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                      No variants match this filter.
                    </td>
                  </tr>
                ) : null}
                {groupedVariants.map((group) => {
                  const open = !collapsed[group.key]
                  const groupQty = group.rows.reduce((sum, row) => sum + Number(draftFor(row).stock || 0), 0)
                  return (
                    <Fragment key={group.key}>
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            padding: '8px 12px',
                            background: 'var(--surface-2)',
                            borderBottom: '1px solid var(--line)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              border: 0,
                              background: 'transparent',
                              cursor: 'pointer',
                              padding: 0,
                              font: `600 12.5px/1 ${FONT}`,
                              color: 'var(--ink)',
                            }}
                          >
                            <DcIcon name={open ? 'icon-chevron-down' : 'icon-chevron-right'} size={14} />
                            <span
                              style={{
                                width: 14,
                                height: 14,
                                borderRadius: 4,
                                border: '1px solid var(--line-2)',
                                background: swatchCss(group.hex),
                              }}
                            />
                            {group.name}
                            <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                              {group.rows.length} · {groupQty} pcs
                            </span>
                          </button>
                        </td>
                      </tr>
                      {open
                        ? group.rows.map((v, i) => {
                  const d = draftFor(v)
                  const priced = rowPrices(d, productMainPrice, productSalePrice)
                  const active = v.isActive ?? true
                  const busy = rowBusy(v.id)
                  const wasStock = serverStock(v)
                  const nowStock = Number(d.stock)
                  const stockChanged = nowStock !== wasStock
                  const stockDelta = nowStock - wasStock
                  const low = nowStock < 5
                  const dirty = Boolean(v.id && dirtyIds.has(v.id))
                  const status = stockStatus(nowStock)
                  const onEnter = (e: { key: string; preventDefault: () => void }) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void saveRow(v)
                    }
                  }
                  return (
                    <Fragment key={v.id ?? `${group.key}-${i}`}>
                    <tr
                      style={{
                        borderBottom: stockChanged || historyFor === v.id ? 0 : '1px solid var(--line)',
                        opacity: active ? 1 : 0.55,
                        background: dirty ? 'var(--violet-soft)' : active ? undefined : 'var(--surface-2)',
                        boxShadow: dirty ? 'inset 3px 0 0 var(--violet)' : undefined,
                      }}
                    >
                      <td style={{ padding: '10px 12px', minWidth: 128 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void toggleActive(v)}
                            title={active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 99,
                              border: 0,
                              padding: 0,
                              background: active ? 'var(--ok)' : 'var(--ink-3)',
                              cursor: busy ? 'not-allowed' : 'pointer',
                              flex: 'none',
                            }}
                          />
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 4,
                              border: '1px solid var(--line-2)',
                              background: swatchCss(d.colorHex),
                              flex: 'none',
                            }}
                          />
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                            <strong style={{ font: `600 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                              {d.size || '—'}
                            </strong>
                            <span style={{ font: `400 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                              {d.colorName || 'Default'}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="dc-variant-money">
                        <DcInput
                          mono
                          inputMode="decimal"
                          value={d.price}
                          placeholder={priced.sale || '0'}
                          onChange={(e) =>
                            v.id && setField(v.id, 'price', e.target.value.replace(/[^\d.]/g, ''))
                          }
                          onKeyDown={onEnter}
                          style={{ height: 34 }}
                        />
                      </td>
                      <td className="dc-variant-money">
                        <DcInput
                          mono
                          inputMode="decimal"
                          placeholder={priced.main || '—'}
                          value={d.compareAtPrice}
                          onChange={(e) =>
                            v.id &&
                            setField(v.id, 'compareAtPrice', e.target.value.replace(/[^\d.]/g, ''))
                          }
                          onKeyDown={onEnter}
                          style={{ height: 34 }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', width: 56 }}>
                        <span style={{ font: `700 13px/1 ${MONO}`, color: priced.pct ? 'var(--bad)' : 'var(--ink-3)' }}>
                          {priced.pct != null ? `${priced.pct}%` : '—'}
                        </span>
                      </td>
                      <td className="dc-variant-stock" style={{ padding: '8px 10px', minWidth: 210 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                v.id && setField(v.id, 'stock', String(Math.max(0, Number(d.stock || 0) - 1)))
                              }
                              style={{ ...btnGhost, width: 28, height: 28, padding: 0, flex: 'none' }}
                            >
                              −
                            </button>
                            <DcInput
                              mono
                              inputMode="numeric"
                              value={d.stock}
                              onChange={(e) =>
                                v.id && setField(v.id, 'stock', e.target.value.replace(/[^\d]/g, ''))
                              }
                              onKeyDown={onEnter}
                              style={{
                                height: 34,
                                borderColor: low ? 'var(--warn)' : undefined,
                                color: low ? 'var(--warn)' : undefined,
                              }}
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => v.id && setField(v.id, 'stock', String(Number(d.stock || 0) + 1))}
                              style={{ ...btnGhost, width: 28, height: 28, padding: 0, flex: 'none' }}
                            >
                              +
                            </button>
                            <span
                              style={{
                                flex: 'none',
                                padding: '3px 7px',
                                borderRadius: 6,
                                border: `1px solid ${status.bd}`,
                                background: status.bg,
                                color: status.fg,
                                font: `600 10px/1 ${FONT}`,
                              }}
                            >
                              {status.label}
                            </span>
                          </div>
                          {stockChanged ? (
                            <span style={{ font: `500 11px/1.3 ${MONO}`, color: 'var(--ink-2)' }}>
                              was {wasStock} → {nowStock} ({stockDelta > 0 ? '+' : ''}
                              {stockDelta})
                            </span>
                          ) : null}
                          {stockChanged ? (
                            <div style={{ display: 'grid', gap: 6 }}>
                              <select
                                style={{ ...selectStyle, height: 34 }}
                                value={d.stockReason}
                                onChange={(e) => v.id && setField(v.id, 'stockReason', e.target.value)}
                              >
                                {STOCK_REASONS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                              <DcInput
                                placeholder="Note (optional)"
                                value={d.stockNote}
                                onChange={(e) => v.id && setField(v.id, 'stockNote', e.target.value)}
                                style={{ height: 34 }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <CodeChip label="SKU" value={d.sku} />
                          <CodeChip label="BC" value={d.barcode} />
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', minWidth: 132 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ImageThumb url={d.image} />
                          <select
                            style={{ ...selectStyle, height: 34, minWidth: 88 }}
                            value={d.image}
                            onChange={(e) => v.id && setField(v.id, 'image', e.target.value)}
                          >
                            <option value="">—</option>
                            {productImages.filter(Boolean).map((url, idx) => (
                              <option key={url} value={url}>
                                Img {idx + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            style={{
                              ...btnPrimary,
                              height: 32,
                              padding: '0 12px',
                              font: `600 12px/1 ${FONT}`,
                              opacity: busy ? 0.55 : 1,
                            }}
                            disabled={busy}
                            onClick={() => void saveRow(v)}
                          >
                            {busy ? 'Saving…' : dirty ? 'Save*' : 'Save'}
                          </button>
                          {v.id ? (
                            <button
                              type="button"
                              style={{ ...btnLink, opacity: busy ? 0.4 : 1 }}
                              disabled={busy}
                              onClick={() => void openHistory(v.id!)}
                            >
                              {historyFor === v.id ? 'Hide' : 'History'}
                            </button>
                          ) : null}
                          {d.image ? (
                            <button
                              type="button"
                              style={{ ...btnLink, opacity: busy ? 0.4 : 1 }}
                              disabled={busy}
                              onClick={() => void applyImageToColour(v)}
                            >
                              Apply image
                            </button>
                          ) : null}
                          <button
                            type="button"
                            title="Archive"
                            disabled={busy || !active}
                            onClick={() => void archiveRow(v)}
                            style={{
                              ...btnGhost,
                              height: 32,
                              width: 32,
                              padding: 0,
                              opacity: busy || !active ? 0.4 : 1,
                            }}
                          >
                            <DcIcon name="icon-archive" size={14} />
                          </button>
                          <button
                            type="button"
                            title="Remove this size — only if it never sold"
                            disabled={busy}
                            onClick={() => void deleteRow(v)}
                            style={{
                              ...btnGhost,
                              height: 32,
                              width: 32,
                              padding: 0,
                              color: 'var(--bad)',
                              opacity: busy ? 0.4 : 1,
                            }}
                          >
                            <DcIcon name="icon-trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {historyFor === v.id ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            padding: '10px 14px 14px',
                            borderBottom: '1px solid var(--line)',
                            background: 'var(--surface-2)',
                          }}
                        >
                          {historyLoading ? (
                            <span style={{ font: `500 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                              Loading ledger…
                            </span>
                          ) : historyRows.length === 0 ? (
                            <span style={{ font: `500 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                              No movements yet — first save creates the ledger.
                            </span>
                          ) : (
                            <div style={{ display: 'grid', gap: 6 }}>
                              {historyRows.map((row) => (
                                <div
                                  key={row.id}
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 10,
                                    alignItems: 'baseline',
                                    font: `500 12px/1.35 ${FONT}`,
                                    color: 'var(--ink-2)',
                                  }}
                                >
                                  <span style={{ font: `500 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                                    {formatLedgerWhen(row.createdAt)}
                                  </span>
                                  <span>{row.action}</span>
                                  <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>
                                    {row.stockBefore} → {row.stockAfter} ({row.quantity > 0 ? '+' : ''}
                                    {row.quantity})
                                  </span>
                                  {row.note ? <span style={{ color: 'var(--ink-3)' }}>{row.note}</span> : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  )
                        })
                        : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showManual ? (
        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'var(--surface)',
          }}
        >
          <span style={{ font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>Add one variant</span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10,
            }}
          >
            <DcField label="Size">
              <DcInput
                value={addDraft.size}
                onChange={(e) => setAddDraft((p) => ({ ...p, size: e.target.value }))}
              />
            </DcField>
            <DcField label="Colour">
              <DcInput
                value={addDraft.colorName}
                onChange={(e) =>
                  setAddDraft((p) => ({ ...p, colorName: e.target.value, color: e.target.value }))
                }
              />
            </DcField>
            <DcField label="Sale">
              <DcInput
                mono
                inputMode="decimal"
                value={addDraft.price}
                onChange={(e) =>
                  setAddDraft((p) => ({ ...p, price: e.target.value.replace(/[^\d.]/g, '') }))
                }
              />
            </DcField>
            <DcField label="Main">
              <DcInput
                mono
                inputMode="decimal"
                value={addDraft.compareAtPrice}
                onChange={(e) =>
                  setAddDraft((p) => ({ ...p, compareAtPrice: e.target.value.replace(/[^\d.]/g, '') }))
                }
              />
            </DcField>
            <DcField label="Stock">
              <DcInput
                mono
                inputMode="numeric"
                value={addDraft.stock}
                onChange={(e) =>
                  setAddDraft((p) => ({ ...p, stock: e.target.value.replace(/[^\d]/g, '') }))
                }
              />
            </DcField>
            <DcField label="SKU">
              <DcInput
                mono
                value={addDraft.sku}
                placeholder="Auto"
                onChange={(e) => setAddDraft((p) => ({ ...p, sku: e.target.value }))}
              />
            </DcField>
            <DcField label="Barcode">
              <DcInput
                mono
                value={addDraft.barcode}
                placeholder="Auto"
                onChange={(e) => setAddDraft((p) => ({ ...p, barcode: e.target.value }))}
              />
            </DcField>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={{ ...btnPrimary, opacity: createVariant.isPending ? 0.55 : 1 }}
              disabled={createVariant.isPending}
              onClick={() => void submitAdd()}
            >
              {createVariant.isPending ? 'Adding…' : 'Add variant'}
            </button>
            <button
              type="button"
              style={btnGhost}
              onClick={() => {
                setShowManual(false)
                setAddDraft(EMPTY_DRAFT)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAddDraft(nextVariantDraft())
            setShowManual(true)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            height: 38,
            padding: '0 14px',
            borderRadius: 9,
            border: '1px dashed var(--line-2)',
            background: 'transparent',
            color: 'var(--ink-2)',
            cursor: 'pointer',
            font: `600 12.5px/1 ${FONT}`,
            alignSelf: 'flex-start',
          }}
        >
          <DcIcon name="icon-plus" size={14} />
          Add another variant
        </button>
      )}
    </div>
  )
}

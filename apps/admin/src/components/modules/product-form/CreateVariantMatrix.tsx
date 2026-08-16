'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcChip, DcField, DcInput } from '@/components/dc/product/DcProductFormPrimitives'
import { FONT, MONO, formatTaka } from '@/components/dc/tokens'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import { printVariantStickers } from '@/lib/admin/variant-stickers'
import {
  DEFAULT_COLOUR_HEX,
  normalizeHex,
  swatchCss,
} from '@/lib/admin/colour-names'
import { deptHasNoSize, type SizeDeptKey } from '@/lib/admin/size-presets'
import { previewVariantSku, type SkuIdentity } from '@/lib/admin/variant-sku'

export type CreateColourRow = { id: string; name: string; hex: string; imageUrl: string }

export type CreateVariantLine = {
  size: string
  colorName: string
  colorHex: string
  image?: string
  sku?: string
  barcode?: string
  price: number
  compareAtPrice?: number | null
  stock: number
  isActive: true
}

type LockField = 'sku' | 'barcode' | 'price' | 'compareAt' | 'stock'
type DraftRow = Partial<Record<LockField, string>> & { lock?: Partial<Record<LockField, true>> }
type ResolvedRow = Record<LockField, string>

const th: CSSProperties = {
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

const stepLabel: CSSProperties = {
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
}

function rowKey(colorId: string, size: string) {
  return `${colorId}::${size}`
}

function stockTone(qty: number) {
  if (qty <= 0) return { label: 'Out', fg: 'var(--bad)', bg: 'var(--bad-soft)' }
  if (qty < 5) return { label: 'Low', fg: 'var(--warn)', bg: 'var(--warn-soft)' }
  return { label: 'In', fg: 'var(--ok)', bg: 'var(--ok-soft)' }
}

function sizeToken(size: string) {
  return size.trim().toUpperCase().replace(/\s+/g, '')
}

function colourToken(name: string, multiColour: boolean) {
  if (!multiColour) return ''
  const n = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '')
  if (!n || n === 'DEFAULT') return ''
  return n.slice(0, 4)
}

function withSuffix(base: string, colorName: string, size: string, multiColour: boolean) {
  const root = base.trim().replace(/\s+/g, '-').replace(/-+$/g, '')
  if (!root) return ''
  return [root, colourToken(colorName, multiColour), sizeToken(size)].filter(Boolean).join('-')
}

function generateSku(baseSku: string, colorName: string, size: string, multiColour: boolean) {
  return withSuffix(baseSku.trim().toUpperCase(), colorName, size, multiColour)
}

function generateBarcode(baseBarcode: string, colorName: string, size: string, multiColour: boolean) {
  return withSuffix(baseBarcode.trim(), colorName, size, multiColour)
}

function namedColour(color: CreateColourRow) {
  const name = color.name.trim()
  return name && name.toLowerCase() !== 'default' ? name : null
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

function resolveRow(
  color: CreateColourRow,
  size: string,
  draft: DraftRow | undefined,
  baseSku: string,
  defaultStock: string,
  basePrice: string,
  compareAtPrice: string,
  productBarcode: string,
  multiColour: boolean,
  skuIdentity: SkuIdentity | null | undefined,
): ResolvedRow {
  const lock = draft?.lock ?? {}
  // Once the category is known the canonical SPL-{CAT}-{MODEL}-{COLOR}-{SIZE}
  // preview wins; the free-text base SKU stays as the manual escape hatch.
  const autoSku = skuIdentity
    ? previewVariantSku(skuIdentity, { color: color.name, size })
    : generateSku(baseSku, color.name, size, multiColour)
  return {
    sku: lock.sku ? (draft?.sku ?? '') : autoSku,
    barcode: lock.barcode
      ? (draft?.barcode ?? '')
      : generateBarcode(productBarcode, color.name, size, multiColour),
    price: lock.price ? (draft?.price ?? '') : basePrice,
    compareAt: lock.compareAt ? (draft?.compareAt ?? '') : compareAtPrice,
    stock: lock.stock ? (draft?.stock ?? '') : defaultStock.trim() || '10',
  }
}

export function CreateVariantMatrix({
  productName,
  sizeChips,
  sizeDeptKey,
  colors,
  sizes,
  onSizesChange,
  baseSku,
  onBaseSkuChange,
  defaultStock,
  onDefaultStockChange,
  basePrice,
  onBasePriceChange,
  compareAtPrice,
  productBarcode,
  onProductBarcodeChange,
  onVariantsChange,
  skuIdentity,
}: {
  productName?: string
  sizeChips: string[]
  sizeDeptKey: SizeDeptKey
  colors: CreateColourRow[]
  sizes: string
  onSizesChange: (next: string) => void
  baseSku: string
  onBaseSkuChange: (next: string) => void
  defaultStock: string
  onDefaultStockChange: (next: string) => void
  basePrice: string
  onBasePriceChange: (next: string) => void
  compareAtPrice: string
  productBarcode: string
  onProductBarcodeChange: (next: string) => void
  onVariantsChange: (lines: CreateVariantLine[]) => void
  /** SPL-{CAT}-{MODEL} the API will assign — drives the live SKU preview. */
  skuIdentity?: SkuIdentity | null
}) {
  // Saree / wallet / watch have no size run: the field is hidden and each colour
  // becomes a single variant whose size stays empty (SKU segment falls back to OS).
  const sizeless = deptHasNoSize(sizeDeptKey)
  const sizeList = useMemo(() => {
    if (sizeless) return ['']
    return sizes.split(',').map((s) => s.trim()).filter(Boolean)
  }, [sizes, sizeless])
  const colourRows = useMemo(
    () =>
      colors.filter((c) => c.name.trim()).length
        ? colors.filter((c) => c.name.trim())
        : [{ id: '_default', name: 'Default', hex: DEFAULT_COLOUR_HEX, imageUrl: '' }],
    [colors],
  )
  const multiColour = colourRows.filter((c) => namedColour(c)).length > 1

  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({})
  const [customSize, setCustomSize] = useState('')

  const extraSizes = sizeList.filter((sz) => !sizeChips.includes(sz))
  const hasLocks = Object.values(drafts).some((row) => row.lock && Object.keys(row.lock).length > 0)

  const resolved = useMemo(() => {
    const map: Record<string, ResolvedRow> = {}
    for (const color of colourRows) {
      for (const size of sizeList) {
        const key = rowKey(color.id, size)
        map[key] = resolveRow(
          color,
          size,
          drafts[key],
          baseSku,
          defaultStock,
          basePrice,
          compareAtPrice,
          productBarcode,
          multiColour,
          skuIdentity,
        )
      }
    }
    return map
  }, [
    colourRows,
    sizeList,
    drafts,
    baseSku,
    defaultStock,
    basePrice,
    compareAtPrice,
    productBarcode,
    multiColour,
    skuIdentity,
  ])

  const lines = useMemo(() => {
    const selling = Number(basePrice) || 0
    const compare = compareAtPrice.trim() ? Number(compareAtPrice) : null
    return colourRows.flatMap((color) =>
      sizeList.map((size) => {
        const row = resolved[rowKey(color.id, size)]
        const hex = normalizeHex(color.hex) ?? DEFAULT_COLOUR_HEX
        const price = Number(row?.price) || selling
        const compareAt = row?.compareAt.trim()
          ? Number(row.compareAt)
          : compare && compare > 0
            ? compare
            : null
        return {
          size,
          colorName: namedColour(color) ?? 'Default',
          colorHex: hex,
          ...(color.imageUrl.trim() ? { image: color.imageUrl.trim() } : {}),
          ...(row?.sku.trim() ? { sku: row.sku.trim() } : {}),
          ...(row?.barcode.trim() ? { barcode: row.barcode.trim() } : {}),
          price,
          compareAtPrice: compareAt && compareAt > 0 ? compareAt : null,
          stock: Math.max(0, Math.min(999999, Number(row?.stock) || 0)),
          isActive: true as const,
        }
      }),
    )
  }, [colourRows, sizeList, resolved, basePrice, compareAtPrice])

  useEffect(() => {
    onVariantsChange(lines)
  }, [lines, onVariantsChange])

  const exampleSkus = useMemo(() => {
    if (sizeList.length === 0) return []
    const colour = colourRows[0]?.name ?? 'Default'
    if (skuIdentity) {
      return sizeList
        .slice(0, 5)
        .map((size) => previewVariantSku(skuIdentity, { color: colour, size }))
    }
    if (!baseSku.trim()) return []
    return sizeList.slice(0, 5).map((size) => generateSku(baseSku, colour, size, multiColour))
  }, [baseSku, sizeList, colourRows, multiColour, skuIdentity])

  const toggleSize = (sz: string) => {
    const on = sizeList.includes(sz)
    const next = on ? sizeList.filter((s) => s !== sz) : [...sizeList, sz]
    onSizesChange(next.join(', '))
  }

  const addCustomSize = () => {
    const sz = customSize.trim()
    if (!sz) return
    if (!sizeList.includes(sz)) onSizesChange([...sizeList, sz].join(', '))
    setCustomSize('')
  }

  const patch = (key: string, field: LockField, value: string) => {
    setDrafts((prev) => {
      const current = prev[key] ?? {}
      if (!value.trim()) {
        const lock = { ...(current.lock ?? {}) }
        delete lock[field]
        const nextRow: DraftRow = { ...current, lock }
        delete nextRow[field]
        return { ...prev, [key]: nextRow }
      }
      return {
        ...prev,
        [key]: {
          ...current,
          [field]: field === 'sku' ? value.toUpperCase() : value,
          lock: { ...(current.lock ?? {}), [field]: true },
        },
      }
    })
  }

  const bumpStock = (key: string, delta: number) => {
    const current = Number(resolved[key]?.stock) || 0
    patch(key, 'stock', String(Math.max(0, current + delta)))
  }

  const applyFieldToColour = (colorId: string, field: 'price' | 'stock') => {
    const firstSize = sizeList[0]
    if (!firstSize) return
    const fallback = field === 'stock' ? defaultStock || '10' : basePrice
    const value = resolved[rowKey(colorId, firstSize)]?.[field] || fallback
    if (!String(value).trim()) {
      toastFail(field === 'price' ? 'Set a price in step 2 first.' : 'Set stock in step 2 first.')
      return
    }
    setDrafts((prev) => {
      const next = { ...prev }
      for (const size of sizeList) {
        const key = rowKey(colorId, size)
        const current = next[key] ?? {}
        next[key] = {
          ...current,
          [field]: value,
          lock: { ...(current.lock ?? {}), [field]: true },
        }
      }
      return next
    })
    toastOk(field === 'price' ? 'Same price on this colour' : 'Same stock on this colour')
  }

  const applyStockToColour = (colorId: string) => applyFieldToColour(colorId, 'stock')
  const applyPriceToColour = (colorId: string) => applyFieldToColour(colorId, 'price')

  const printStickers = () => {
    printVariantStickers(
      lines.map((line) => ({
        name: [productName?.trim(), line.colorName !== 'Default' ? line.colorName : '']
          .filter(Boolean)
          .join(' · ') || 'SPLARO',
        size: line.size,
        sku: line.sku ?? '',
        barcode: line.barcode ?? '',
      })),
    )
  }

  const deptHint =
    sizeDeptKey === 'kids'
      ? 'Kids sizes'
      : sizeDeptKey === 'footwear'
        ? 'EU shoe sizes'
        : sizeDeptKey === 'accessories'
          ? 'Usually One Size'
          : sizeDeptKey === 'women' || sizeDeptKey === 'men'
            ? `${sizeDeptKey[0]?.toUpperCase()}${sizeDeptKey.slice(1)} sizes`
            : 'Pick a menu above to switch size run'

  const showBarcode = Boolean(productBarcode.trim()) || lines.some((l) => l.barcode)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {sizeless ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={stepLabel}>1 · Sizes</span>
          <p style={{ margin: 0, font: `400 12.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
            This category has no size run — one variant per colour. SKUs end in
            {' '}
            <span style={{ font: `600 12.5px/1 ${MONO}`, color: 'var(--ink-2)' }}>OS</span>.
          </p>
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={stepLabel}>1 · Sizes{sizeDeptKey !== 'default' ? ` · ${deptHint}` : ''}</span>
        <p style={{ margin: 0, font: `400 12.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
          Tap the sizes this product actually has. Menu (Men / Kids / Footwear) changes the chips.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {sizeChips.map((sz) => (
            <DcChip key={sz} on={sizeList.includes(sz)} onClick={() => toggleSize(sz)}>
              {sz}
            </DcChip>
          ))}
          {extraSizes.map((sz) => (
            <DcChip key={sz} on onClick={() => toggleSize(sz)}>
              {sz}
            </DcChip>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <DcInput
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustomSize()
              }
            }}
            placeholder="Extra size, e.g. 3XL or 4Y"
            style={{ height: 34, maxWidth: 200 }}
          />
          <button
            type="button"
            onClick={addCustomSize}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink-2)',
              cursor: 'pointer',
              font: `600 12px/1 ${FONT}`,
            }}
          >
            Add size
          </button>
        </div>
        {sizeList.length === 0 ? (
          <span style={{ font: `500 12.5px/1.4 ${FONT}`, color: 'var(--warn)' }}>
            Select at least one size.
          </span>
        ) : (
          <span style={{ font: `500 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
            Selected: {sizeList.join(' · ')}
          </span>
        )}
      </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={stepLabel}>2 · Same for every {sizeless ? 'colour' : 'size'}</span>
        <p style={{ margin: 0, font: `400 12.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
          {skuIdentity
            ? 'Fill price and stock. SKU is built from category, model, colour and size; barcodes are issued on save.'
            : 'Fill these four. Table below copies them — SKU/barcode get -S -M -L on the end.'}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 10,
          }}
        >
          <DcField label="Price · ৳">
            <DcInput
              mono
              value={basePrice}
              onChange={(e) => onBasePriceChange(e.target.value)}
              placeholder="3390"
            />
          </DcField>
          <DcField label="Stock each size">
            <DcInput
              mono
              value={defaultStock}
              onChange={(e) => onDefaultStockChange(e.target.value)}
              placeholder="10"
            />
          </DcField>
          {skuIdentity ? null : (
            <DcField label="SKU">
              <DcInput
                mono
                value={baseSku}
                onChange={(e) => onBaseSkuChange(e.target.value.toUpperCase())}
                placeholder="Type SKU"
                style={{ textTransform: 'uppercase' }}
              />
            </DcField>
          )}
          <DcField label="Barcode · optional">
            <DcInput
              mono
              value={productBarcode}
              onChange={(e) => onProductBarcodeChange(e.target.value)}
              placeholder="Optional"
            />
          </DcField>
        </div>
        {exampleSkus.length > 0 ? (
          <span style={{ font: `500 12px/1.45 ${MONO}`, color: 'var(--violet)' }}>
            Will save as {exampleSkus.join(' · ')}
            {sizeList.length > 5 ? '…' : ''}
            {skuIdentity && !skuIdentity.exact ? ' (model no. confirmed on save)' : ''}
          </span>
        ) : (
          <span style={{ font: `400 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
            Example: SKU POLO + sizes S M L → POLO-S · POLO-M · POLO-L
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={stepLabel}>3 · Preview · {lines.length} variant{lines.length === 1 ? '' : 's'}</span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={printStickers}
            disabled={lines.length === 0}
            style={{
              height: 30,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink-2)',
              cursor: lines.length === 0 ? 'not-allowed' : 'pointer',
              opacity: lines.length === 0 ? 0.45 : 1,
              font: `600 11.5px/1 ${FONT}`,
            }}
          >
            Print stickers
          </button>
          {hasLocks ? (
            <button
              type="button"
              onClick={() => {
                setDrafts({})
                toastOk('Rows follow the fields above again.')
              }}
              style={{
                height: 30,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
                cursor: 'pointer',
                font: `600 11.5px/1 ${FONT}`,
              }}
            >
              Undo row edits
            </button>
          ) : null}
        </span>
        <p style={{ margin: 0, font: `400 12.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
          Stock +/− here if one size is different. SKU/price follow step 2 unless you type in a row.
        </p>
        {!multiColour && sizeList.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => applyPriceToColour(colourRows[0]!.id)}
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 7,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--ink-2)',
                cursor: 'pointer',
                font: `600 11.5px/1 ${FONT}`,
              }}
            >
              Same price all sizes
            </button>
            <button
              type="button"
              onClick={() => applyStockToColour(colourRows[0]!.id)}
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 7,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--ink-2)',
                cursor: 'pointer',
                font: `600 11.5px/1 ${FONT}`,
              }}
            >
              Same stock all sizes
            </button>
          </div>
        ) : null}

        {sizeList.length === 0 ? (
          <span style={{ font: `400 12.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
            Select sizes in step 1 to see rows.
          </span>
        ) : (
          <div style={{ overflow: 'auto', maxHeight: 420, border: '1px solid var(--line)', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: showBarcode ? 640 : 520 }}>
              <thead>
                <tr>
                  <th style={th}>Size</th>
                  <th style={th}>SKU</th>
                  {showBarcode ? <th style={th}>Barcode</th> : null}
                  <th style={{ ...th, textAlign: 'right' }}>Price</th>
                  <th style={{ ...th, textAlign: 'right' }}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {colourRows.map((color) => {
                  const label = namedColour(color)
                  return (
                    <ColourBlock
                      key={color.id}
                      color={color}
                      label={label}
                      showHeader={multiColour && Boolean(label)}
                      sizes={sizeList}
                      resolved={resolved}
                      showBarcode={showBarcode}
                      onBump={bumpStock}
                      onApplyStock={applyStockToColour}
                      onApplyPrice={applyPriceToColour}
                      onPatch={patch}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function ColourBlock({
  color,
  label,
  showHeader,
  sizes,
  resolved,
  showBarcode,
  onBump,
  onApplyStock,
  onApplyPrice,
  onPatch,
}: {
  color: CreateColourRow
  label: string | null
  showHeader: boolean
  sizes: string[]
  resolved: Record<string, ResolvedRow>
  showBarcode: boolean
  onBump: (key: string, delta: number) => void
  onApplyStock: (colorId: string) => void
  onApplyPrice: (colorId: string) => void
  onPatch: (key: string, field: LockField, value: string) => void
}) {
  const cols = showBarcode ? 5 : 4
  const chipBtn: CSSProperties = {
    height: 26,
    padding: '0 8px',
    borderRadius: 7,
    border: '1px solid var(--line)',
    background: 'var(--surface)',
    color: 'var(--ink-3)',
    cursor: 'pointer',
    font: `600 11px/1 ${FONT}`,
  }
  return (
    <>
      {showHeader ? (
        <tr style={{ background: 'var(--surface-2)' }}>
          <td colSpan={cols} style={{ padding: '8px 12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 4,
                  border: '1px solid var(--line-2)',
                  background: swatchCss(color.hex),
                }}
              />
              <span style={{ font: `600 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>{label}</span>
              <button type="button" onClick={() => onApplyPrice(color.id)} style={chipBtn}>
                Same price all sizes
              </button>
              <button type="button" onClick={() => onApplyStock(color.id)} style={chipBtn}>
                Same stock all sizes
              </button>
            </span>
          </td>
        </tr>
      ) : null}
      {sizes.map((size) => {
        const key = rowKey(color.id, size)
        const row = resolved[key]
        const qty = Number(row?.stock) || 0
        const tone = stockTone(qty)
        const sku = row?.sku ?? ''
        const priceNum = Number(row?.price) || 0
        return (
          <tr key={key} style={{ borderBottom: '1px solid var(--line)' }}>
            <td style={{ padding: '10px 12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {label ? (
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 99,
                      background: swatchCss(color.hex),
                      border: '1px solid var(--line-2)',
                    }}
                  />
                ) : null}
                <span style={{ font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>{size}</span>
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: 99,
                    background: tone.bg,
                    color: tone.fg,
                    font: `600 10px/1.4 ${FONT}`,
                  }}
                >
                  {tone.label}
                </span>
              </span>
            </td>
            <td style={{ padding: '8px 12px' }}>
              {sku ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>{sku}</span>
                  <button
                    type="button"
                    title="Copy SKU"
                    onClick={() => void copyText('SKU', sku)}
                    style={{
                      width: 28,
                      height: 28,
                      border: 0,
                      background: 'transparent',
                      color: 'var(--ink-3)',
                      cursor: 'pointer',
                    }}
                  >
                    <DcIcon name="icon-copy" size={13} />
                  </button>
                </span>
              ) : (
                <span style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>—</span>
              )}
            </td>
            {showBarcode ? (
              <td style={{ padding: '8px 12px', font: `500 12px/1 ${MONO}`, color: 'var(--ink-2)' }}>
                {row?.barcode || '—'}
              </td>
            ) : null}
            <td
              style={{
                padding: '8px 12px',
                textAlign: 'right',
                font: `600 12.5px/1 ${MONO}`,
                color: priceNum > 0 ? 'var(--ink)' : 'var(--ink-3)',
              }}
            >
              {priceNum > 0 ? formatTaka(priceNum) : '—'}
            </td>
            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => onBump(key, -1)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    color: 'var(--ink-2)',
                    cursor: 'pointer',
                    font: `600 14px/1 ${FONT}`,
                  }}
                >
                  −
                </button>
                <DcInput
                  mono
                  value={row?.stock ?? '0'}
                  onChange={(e) => onPatch(key, 'stock', e.target.value)}
                  style={{ height: 32, width: 56, textAlign: 'right' }}
                />
                <button
                  type="button"
                  onClick={() => onBump(key, 1)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    color: 'var(--ink-2)',
                    cursor: 'pointer',
                    font: `600 14px/1 ${FONT}`,
                  }}
                >
                  +
                </button>
              </span>
            </td>
          </tr>
        )
      })}
    </>
  )
}

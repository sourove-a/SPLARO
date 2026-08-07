'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { DcIcon } from '@/components/dc/DcIcon'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka } from '@/components/dc/tokens'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import {
  createPosSale,
  fetchPosToday,
  searchPosCatalog,
  type PosPaymentMethod,
  type PosProduct,
  type PosSaleResponse,
  type PosVariant,
} from '@/lib/api/pos'
import { formatBdPhone } from '@/lib/format/bd-phone'
import { printPosReceipt } from '@/lib/admin/pos-receipt'

const PAYMENTS: { id: PosPaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'bkash', label: 'bKash' },
  { id: 'nagad', label: 'Nagad' },
  { id: 'card', label: 'Card' },
]

const SKELETON: DcBlock[] = [
  { t: 'kpis' } as DcBlock,
  { t: 'table', w: 'main', title: '', cols: [], rows: [] } as DcBlock,
]

interface CartLine {
  productId: string
  variantId: string
  name: string
  variantLabel: string
  sku: string | null
  price: number
  stock: number
  quantity: number
}

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const caps = {
  display: 'block',
  font: `600 10.5px/1.4 ${FONT}`,
  letterSpacing: '.11em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

const input = {
  width: '100%',
  marginTop: 6,
  padding: '9px 11px',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  font: `500 12.5px/1.4 ${FONT}`,
} as const

function btn(primary: boolean, disabled = false) {
  return {
    height: 34,
    padding: '0 14px',
    borderRadius: 9,
    cursor: disabled ? 'not-allowed' : 'pointer',
    font: `600 12.5px/1 ${FONT}`,
    border: `1px solid var(${primary && !disabled ? '--violet' : '--line'})`,
    background: primary && !disabled ? 'var(--violet)' : 'var(--surface-2)',
    color: primary && !disabled ? 'var(--on-violet)' : 'var(--ink-2)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const
}

function variantLabel(v: PosVariant): string {
  return [v.size, v.color].filter(Boolean).join(' · ') || 'Default'
}

export function DcPosCounter() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="pos" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPosCounterBody />
    </DcScreenProvider>
  )
}

function DcPosCounterBody() {
  const { api } = useAdminConnection(25_000)
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [payment, setPayment] = useState<PosPaymentMethod>('cash')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastSale, setLastSale] = useState<PosSaleResponse['order'] | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)

  const today = useQuery({
    queryKey: ['pos', 'today'],
    queryFn: fetchPosToday,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

  const catalog = useQuery({
    queryKey: ['pos', 'catalog', query],
    queryFn: () => searchPosCatalog({ q: query }),
    enabled: query.trim().length > 0,
  })

  const status = dcPageStatus([today], api.pulse)

  const addVariant = useCallback((product: PosProduct, v: PosVariant) => {
    if (v.stock <= 0) {
      toastFail(`${product.name} (${variantLabel(v)}) is out of stock`, 'pos-oos')
      return
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === v.id)
      if (existing) {
        if (existing.quantity >= v.stock) {
          toastFail(`Only ${v.stock} left in stock`, 'pos-stock-cap')
          return prev
        }
        return prev.map((l) => (l.variantId === v.id ? { ...l, quantity: l.quantity + 1 } : l))
      }
      return [
        ...prev,
        {
          productId: product.id,
          variantId: v.id,
          name: product.name,
          variantLabel: variantLabel(v),
          sku: v.sku ?? product.sku,
          price: v.price,
          stock: v.stock,
          quantity: 1,
        },
      ]
    })
  }, [])

  // A barcode scanner types the code then sends Enter. Resolve it to one variant
  // and drop it straight into the cart so the counter never touches the mouse.
  const handleScan = useCallback(async () => {
    const code = term.trim()
    if (!code) return
    try {
      const res = await searchPosCatalog({ sku: code })
      const product = res.products[0]
      const variant = product?.variants.find((v) => v.id === res.matchedVariantId)
      if (product && variant) {
        addVariant(product, variant)
        setTerm('')
        setQuery('')
        return
      }
      // Not a barcode — fall back to a name search.
      setQuery(code)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Catalog lookup failed', 'pos-scan')
    }
  }, [term, addVariant])

  useEffect(() => {
    scanRef.current?.focus()
  }, [])

  const setQty = (variantId: string, next: number) => {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.variantId !== variantId) return [l]
        const q = Math.max(0, Math.min(next, l.stock))
        return q === 0 ? [] : [{ ...l, quantity: q }]
      }),
    )
  }

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.price * l.quantity, 0), [cart])
  const discountBdt = Math.max(0, Math.min(Number(discount) || 0, subtotal))
  const total = subtotal - discountBdt

  const handleSubmit = async () => {
    if (!cart.length) return
    setSubmitting(true)
    try {
      const res = await createPosSale({
        items: cart.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
        paymentMethod: payment,
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
        ...(discountBdt > 0 ? { discount: discountBdt } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      setLastSale(res.order)
      setCart([])
      setDiscount('')
      setNotes('')
      setCustomerName('')
      setCustomerPhone('')
      setTerm('')
      setQuery('')
      void today.refetch()
      toastOk(`Sale recorded — ${res.order.invoiceNumber}`, 'pos-sale-ok')
      scanRef.current?.focus()
    } catch (err) {
      // Stock and validation failures come back from the API verbatim.
      toastFail(err instanceof Error ? err.message : 'Could not record the sale', 'pos-sale-fail')
    } finally {
      setSubmitting(false)
    }
  }

  const todayTotal = Number(today.data?.total ?? 0)
  const todayCount = Number(today.data?.count ?? 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 48 }}>
      <DcPageHead
        crumbGroup="Commerce"
        title="POS Counter"
        statusLabel={status.label}
        statusTone={status.tone}
        syncLabel={today.isFetching ? 'Refreshing…' : 'Synced'}
        syncing={today.isFetching}
        onSync={() => void today.refetch()}
      />

      {today.isLoading ? <DcLoadingState blocks={SKELETON} /> : null}

      {today.error ? (
        <DcErrorState
          error={`GET /admin/pos/today → ${today.error instanceof Error ? today.error.message : 'Request failed'}`}
          hint="The counter can still record a sale — this only affects today's totals."
          onRetry={() => void today.refetch()}
        />
      ) : null}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {/* Scan + search */}
        <section style={{ ...card, padding: 16 }}>
          <p style={{ ...caps, margin: 0 }}>Scan barcode or search</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleScan()
            }}
            style={{ display: 'flex', gap: 8, marginTop: 10 }}
          >
            <input
              ref={scanRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Scan barcode, or type a name / SKU"
              // Barcode guns type fast then press Enter — keep the field clean.
              type="search"
              name="pos-scan"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              style={{ ...input, marginTop: 0, fontFamily: MONO }}
            />
            <button type="submit" style={btn(true, !term.trim())} disabled={!term.trim()}>
              Add
            </button>
          </form>

          {catalog.isFetching ? (
            <p style={{ margin: '12px 0 0', font: `500 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>Searching…</p>
          ) : null}

          {catalog.error ? (
            <p style={{ margin: '12px 0 0', font: `500 12px/1.5 ${MONO}`, color: 'var(--bad)' }}>
              GET /admin/pos/catalog → {catalog.error instanceof Error ? catalog.error.message : 'failed'}
            </p>
          ) : null}

          {query && !catalog.isFetching && catalog.data?.products.length === 0 ? (
            <p style={{ margin: '12px 0 0', font: `500 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
              Nothing matches “{query}”. Barcodes must match a variant SKU exactly.
            </p>
          ) : null}

          <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>
            {(catalog.data?.products ?? []).slice(0, 12).map((p) => (
              <div key={p.id} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)' }}>
                <p style={{ margin: 0, font: `700 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>{p.name}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {p.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => addVariant(p, v)}
                      disabled={v.stock <= 0}
                      title={v.sku ?? undefined}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 99,
                        border: '1px solid var(--line)',
                        background: v.stock > 0 ? 'var(--surface-2)' : 'var(--surface-3)',
                        color: v.stock > 0 ? 'var(--ink-2)' : 'var(--ink-3)',
                        font: `600 11px/1 ${FONT}`,
                        cursor: v.stock > 0 ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {variantLabel(v)} · {formatTaka(v.price)} · {v.stock > 0 ? `${v.stock} left` : 'out'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cart + payment */}
        <section style={{ ...card, padding: 16 }}>
          <p style={{ ...caps, margin: 0 }}>Cart</p>

          {cart.length === 0 ? (
            <p style={{ margin: '12px 0 0', font: `500 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
              Scan an item to start a sale. Stock is checked and deducted by the API when you record it.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {cart.map((l) => (
                <div
                  key={l.variantId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 11px',
                    borderRadius: 10,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', font: `700 12px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                      {l.name}
                    </span>
                    <span style={{ display: 'block', font: `500 10.5px/1.4 ${MONO}`, color: 'var(--ink-3)' }}>
                      {l.variantLabel}
                      {l.sku ? ` · ${l.sku}` : ''}
                    </span>
                  </span>
                  <button type="button" onClick={() => setQty(l.variantId, l.quantity - 1)} style={btn(false)}>
                    −
                  </button>
                  <span style={{ minWidth: 22, textAlign: 'center', font: `700 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                    {l.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(l.variantId, l.quantity + 1)}
                    disabled={l.quantity >= l.stock}
                    style={btn(false, l.quantity >= l.stock)}
                  >
                    +
                  </button>
                  <span style={{ minWidth: 74, textAlign: 'right', font: `700 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                    {formatTaka(l.price * l.quantity)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gap: 11, marginTop: 14 }}>
            <div style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <label>
                <span style={caps}>Customer name</span>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in" style={input} />
              </label>
              <label>
                <span style={caps}>Phone</span>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="01711-204556"
                  style={{ ...input, fontFamily: MONO }}
                />
              </label>
            </div>

            <label>
              <span style={caps}>Discount (৳)</span>
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                inputMode="numeric"
                style={{ ...input, fontFamily: MONO }}
              />
            </label>

            <label>
              <span style={caps}>Note</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" style={input} />
            </label>

            <div>
              <span style={caps}>Payment</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 7 }}>
                {PAYMENTS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPayment(p.id)}
                    style={{
                      padding: '7px 13px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      font: `700 11.5px/1 ${FONT}`,
                      border: `1px solid var(${payment === p.id ? '--violet-bd' : '--line'})`,
                      background: payment === p.id ? 'var(--violet-soft)' : 'var(--surface-2)',
                      color: payment === p.id ? 'var(--violet)' : 'var(--ink-2)',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            {[
              ['Subtotal', formatTaka(subtotal)],
              ...(discountBdt > 0 ? ([['Discount', `− ${formatTaka(discountBdt)}`]] as [string, string][]) : []),
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-2)' }}>{label}</span>
                <span style={{ font: `600 12px/1 ${MONO}`, color: 'var(--ink)' }}>{value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ font: `700 14px/1 ${FONT}`, color: 'var(--ink)' }}>Total</span>
              <span style={{ font: `800 16px/1 ${MONO}`, color: 'var(--ink)' }}>{formatTaka(total)}</span>
            </div>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!cart.length || submitting}
              style={{ ...btn(true, !cart.length || submitting), width: '100%', height: 40, marginTop: 12 }}
            >
              {submitting ? 'Recording…' : `Record sale · ${formatTaka(total)}`}
            </button>
          </div>
        </section>
      </div>

      {/* Today + last receipt */}
      <section style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          <span>
            <span style={caps}>Today</span>
            <span style={{ display: 'block', marginTop: 4, font: `800 22px/1 ${MONO}`, color: 'var(--ink)' }}>
              {formatTaka(todayTotal)}
            </span>
            <span style={{ display: 'block', font: `500 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
              {todayCount} counter sale{todayCount === 1 ? '' : 's'}
            </span>
          </span>

          {lastSale ? (
            <span style={{ flex: 1, minWidth: 220 }}>
              <span style={caps}>Last sale</span>
              <span style={{ display: 'block', marginTop: 4, font: `700 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                {lastSale.invoiceNumber} · {formatTaka(lastSale.total)}
              </span>
              <span style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={btn(false)}
                  onClick={() =>
                    printPosReceipt({
                      invoiceNumber: lastSale.invoiceNumber,
                      total: lastSale.total,
                      paymentMethod: lastSale.paymentMethod,
                      items: lastSale.items,
                      customerName: customerName.trim() || null,
                      customerPhone: customerPhone.trim() ? formatBdPhone(customerPhone) : null,
                    })
                  }
                >
                  <DcIcon name="icon-printer" size={13} />
                  <span style={{ marginLeft: 6 }}>Print receipt</span>
                </button>
                <button type="button" style={btn(false)} onClick={() => setLastSale(null)}>
                  Dismiss
                </button>
              </span>
            </span>
          ) : null}
        </div>
      </section>

      {!today.isLoading && !today.error && todayCount === 0 && !lastSale ? (
        <DcEmptyState
          icon="icon-scan-barcode"
          title="No counter sales today"
          body="POS records an in-store sale against the same order table as the storefront — stock is deducted and it shows in Orders and Profit & Loss. Scan an item above to start."
        />
      ) : null}
    </div>
  )
}

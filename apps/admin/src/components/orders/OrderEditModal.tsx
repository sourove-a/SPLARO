'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { DcModal } from '@/components/dc/DcModal'
import { FONT } from '@/components/dc/tokens'
import { AdminButton } from '@/components/ui/AdminButton'
import { toastApiSaved, toastFail, toastWarn } from '@/lib/admin/feedback'
import { BD_DISTRICTS, computeManualOrderDelivery } from '@/lib/geo/delivery-address'
import { useEditOrder, useSettings } from '@/lib/api/hooks'
import { searchPosCatalog, type PosProduct, type PosVariant } from '@/lib/api/pos'
import type { ApiOrder, ApiOrderItem, EditOrderInput } from '@/lib/api/orders'
import { orderEditSubtotal, orderEditTotal } from '@/lib/admin/order-edit-utils'
import { formatBDT } from '@/lib/utils/currency'

interface EditLine {
  variantId: string
  label: string
  quantity: number
  price: number
  stock: number | null
}

interface OrderEditModalProps {
  open: boolean
  order: ApiOrder
  onClose: () => void
  onSaved: () => void
}

const fieldStyle: CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  font: `500 12px/1 ${FONT}`,
  boxSizing: 'border-box',
}

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  font: `700 10px/1.2 ${FONT}`,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
}

function lineFromItem(item: ApiOrderItem): EditLine | null {
  if (!item.variantId) return null
  const product = item.product?.name ?? item.productName ?? 'Item'
  const variant = [item.variant?.size, item.variant?.color].filter(Boolean).join(' · ')
  return {
    variantId: item.variantId,
    label: [product, variant].filter(Boolean).join(' · '),
    quantity: Math.max(1, item.quantity),
    price: Number(item.price ?? 0),
    stock: null,
  }
}

function variantLabel(product: PosProduct, variant: PosVariant) {
  return `${product.name} · ${[variant.size, variant.color].filter(Boolean).join(' · ') || 'Default'}`
}

export function OrderEditModal({ open, order, onClose, onSaved }: OrderEditModalProps) {
  const editOrder = useEditOrder()
  const { data: settings } = useSettings()
  const [lines, setLines] = useState<EditLine[]>([])
  const [shipping, setShipping] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    district: '',
    division: '',
    postal: '',
  })
  const [note, setNote] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PosProduct[]>([])
  const [lookupBusy, setLookupBusy] = useState(false)
  const [pickedProduct, setPickedProduct] = useState<PosProduct | null>(null)
  const [pickedVariantId, setPickedVariantId] = useState('')
  const [addQuantity, setAddQuantity] = useState('1')
  const orderSeedRef = useRef(order)

  useEffect(() => {
    orderSeedRef.current = order
  }, [order])

  useEffect(() => {
    if (!open) return
    const seed = orderSeedRef.current
    setLines(seed.items.map(lineFromItem).filter((line): line is EditLine => Boolean(line)))
    setShipping({
      name: seed.shippingName ?? '',
      phone: seed.shippingPhone ?? '',
      email: seed.shippingEmail ?? '',
      address: seed.shippingAddress ?? '',
      city: seed.shippingCity ?? '',
      district: seed.shippingDistrict ?? '',
      division: seed.shippingDivision ?? '',
      postal: seed.shippingPostal ?? '',
    })
    setNote('')
    setQuery('')
    setResults([])
    setPickedProduct(null)
    setPickedVariantId('')
    setAddQuantity('1')
  }, [open, order.id])

  const itemEditingAllowed = order.paymentStatus !== 'PAID'
  const subtotal = useMemo(
    () => itemEditingAllowed
      ? orderEditSubtotal(lines)
      : Number(order.subtotal ?? 0),
    [itemEditingAllowed, lines, order.subtotal],
  )
  const delivery = computeManualOrderDelivery(subtotal, shipping.district, settings?.shipping)
  const total = orderEditTotal(subtotal, delivery, Number(order.discount ?? 0))

  const setShippingField = (key: keyof typeof shipping, value: string) => {
    setShipping((prev) => ({ ...prev, [key]: value }))
  }

  const lookup = async () => {
    const value = query.trim()
    if (!value) {
      setResults([])
      return
    }
    setLookupBusy(true)
    try {
      const response = await searchPosCatalog({ q: value, includeUnpublished: true })
      setResults(response.products ?? [])
    } catch (error) {
      toastFail(error instanceof Error ? error.message : 'Product lookup failed.')
      setResults([])
    } finally {
      setLookupBusy(false)
    }
  }

  const pickedVariant =
    pickedProduct?.variants.find((variant) => variant.id === pickedVariantId) ??
    pickedProduct?.variants[0] ??
    null

  const addLine = () => {
    if (!pickedProduct || !pickedVariant) return
    const quantity = Math.max(1, Math.floor(Number(addQuantity) || 1))
    setLines((previous) => {
      const existing = previous.find((line) => line.variantId === pickedVariant.id)
      if (existing) {
        return previous.map((line) =>
          line.variantId === pickedVariant.id
            ? { ...line, quantity: line.quantity + quantity, stock: pickedVariant.stock }
            : line,
        )
      }
      return [
        ...previous,
        {
          variantId: pickedVariant.id,
          label: variantLabel(pickedProduct, pickedVariant),
          quantity,
          price: Number(pickedVariant.price ?? pickedProduct.basePrice),
          stock: Number(pickedVariant.stock ?? 0),
        },
      ]
    })
    setAddQuantity('1')
  }

  const submit = async () => {
    if (itemEditingAllowed && !lines.length) {
      toastFail('Keep at least one item on the order.')
      return
    }
    if (!shipping.name.trim() || !shipping.phone.trim() || !shipping.address.trim() || !shipping.district.trim()) {
      toastFail('Name, phone, address, and district are required.')
      return
    }
    const input: EditOrderInput = {
      ...(itemEditingAllowed
        ? { items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })) }
        : {}),
      shipping: {
        name: shipping.name.trim(),
        phone: shipping.phone.trim(),
        email: shipping.email.trim() || null,
        address: shipping.address.trim(),
        city: shipping.city.trim(),
        district: shipping.district.trim(),
        division: shipping.division.trim(),
        postal: shipping.postal.trim() || null,
      },
      ...(note.trim() ? { note: note.trim() } : {}),
    }
    try {
      const result = await editOrder.mutateAsync({ id: order.id, input })
      if (result.emailSent) {
        toastApiSaved(`Order ${order.invoiceNumber} updated and customer emailed`)
      } else {
        toastWarn(`Order ${order.invoiceNumber} updated, but the customer was not emailed`)
      }
      onSaved()
      onClose()
    } catch (error) {
      toastFail(error instanceof Error ? error.message : 'Could not update order.')
    }
  }

  return (
    <DcModal
      open={open}
      title={`Edit ${order.invoiceNumber}`}
      subtitle="Only pre-shipping orders can be changed. Prices, delivery, stock, and the customer email are verified by the server."
      confirmLabel="Save order"
      busy={editOrder.isPending}
      onClose={onClose}
      onConfirm={() => void submit()}
      width="min(760px, 100%)"
    >
      <section style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <strong style={{ font: `700 11px/1 ${FONT}`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          Items
        </strong>
        {!itemEditingAllowed ? (
          <p style={{ margin: 0, padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 9, background: 'var(--surface-2)', font: `500 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
            This order is already paid. Item changes are locked; you can still correct delivery details.
          </p>
        ) : null}
        {itemEditingAllowed ? lines.map((line) => (
          <div key={line.variantId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 82px 32px', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 9, background: 'var(--surface-2)' }}>
            <span style={{ minWidth: 0, font: `600 12px/1.3 ${FONT}`, color: 'var(--ink)' }}>{line.label}</span>
            <input
              type="number"
              min={1}
              value={line.quantity}
              onChange={(event) => setLines((prev) => prev.map((item) => item.variantId === line.variantId ? { ...item, quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) } : item))}
              style={fieldStyle}
              aria-label={`Quantity for ${line.label}`}
            />
            <button type="button" onClick={() => setLines((prev) => prev.filter((item) => item.variantId !== line.variantId))} aria-label={`Remove ${line.label}`} style={{ height: 32, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', color: 'var(--bad)', cursor: 'pointer' }}>×</button>
          </div>
        )) : null}
        {itemEditingAllowed ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 100px auto', gap: 8, alignItems: 'end' }}>
          <label style={labelStyle}>
            Add product
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void lookup() }} placeholder="Product name or code" style={fieldStyle} />
          </label>
          <label style={labelStyle}>
            Qty
            <input type="number" min={1} value={addQuantity} onChange={(event) => setAddQuantity(event.target.value)} style={fieldStyle} />
          </label>
          <AdminButton size="sm" variant="ghost" loading={lookupBusy} onClick={() => void lookup()}>Find</AdminButton>
        </div> : null}
        {itemEditingAllowed && results.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {results.slice(0, 5).map((product) => (
              <button key={product.id} type="button" onClick={() => { setPickedProduct(product); setPickedVariantId(product.variants[0]?.id ?? '') }} style={{ padding: '8px 10px', textAlign: 'left', border: '1px solid var(--line)', borderRadius: 8, background: pickedProduct?.id === product.id ? 'var(--violet-soft)' : 'var(--surface-2)', color: 'var(--ink)', cursor: 'pointer' }}>
                {product.name}
              </button>
            ))}
          </div>
        ) : null}
        {itemEditingAllowed && pickedProduct ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              Size / colour
              <select value={pickedVariant?.id ?? ''} onChange={(event) => setPickedVariantId(event.target.value)} style={fieldStyle}>
                {pickedProduct.variants.map((variant) => <option key={variant.id} value={variant.id}>{variantLabel(pickedProduct, variant)} · {variant.stock} in stock</option>)}
              </select>
            </label>
            <AdminButton size="sm" variant="accent" onClick={addLine}>Add item</AdminButton>
          </div>
        ) : null}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 }}>
        {(['name', 'phone', 'email', 'city', 'division', 'postal'] as const).map((key) => (
          <label key={key} style={labelStyle}>
            {key}
            <input value={shipping[key]} onChange={(event) => setShippingField(key, event.target.value)} style={fieldStyle} />
          </label>
        ))}
        <label style={labelStyle}>
          District
          <select value={shipping.district} onChange={(event) => setShippingField('district', event.target.value)} style={fieldStyle}>
            <option value="">Select district</option>
            {BD_DISTRICTS.map((district) => <option key={district} value={district}>{district}</option>)}
          </select>
        </label>
        <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
          Address
          <textarea value={shipping.address} onChange={(event) => setShippingField('address', event.target.value)} rows={2} style={{ ...fieldStyle, height: 'auto', paddingTop: 9, paddingBottom: 9, resize: 'vertical' }} />
        </label>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 4, borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', font: `600 12px/1 ${FONT}`, color: 'var(--ink-3)' }}><span>Subtotal</span><span>{formatBDT(subtotal)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', font: `600 12px/1 ${FONT}`, color: 'var(--ink-3)' }}><span>Delivery</span><span>{formatBDT(delivery)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', font: `800 14px/1 ${FONT}`, color: 'var(--ink)' }}><span>New total</span><span style={{ color: 'var(--violet)' }}>{formatBDT(total)}</span></div>
      </section>

      <label style={labelStyle}>
        Internal note (optional)
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Why was this order corrected?" style={{ ...fieldStyle, height: 'auto', paddingTop: 9, paddingBottom: 9, resize: 'vertical' }} />
      </label>
    </DcModal>
  )
}

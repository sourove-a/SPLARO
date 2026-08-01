'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import { verifyNumberEquals, verifyPersisted, verifyStringEquals } from '@/lib/admin/mutation-verify'
import { AdminButton } from '@/components/ui/AdminButton'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcField, DcInput, DcSectionCard } from '@/components/dc/product/DcProductFormPrimitives'
import { FONT, MONO, formatTaka } from '@/components/dc/tokens'
import { useCreateOrder, useProducts } from '@/lib/api/hooks'
import { useAdminNavigate } from '@/lib/navigation/client-nav'
import type { ApiProduct } from '@/lib/api/products'

interface LineItem {
  productId: string
  variantId: string
  name: string
  price: number
  quantity: number
  size?: string
  color?: string
}

interface OrderCreatePanelProps {
  moduleHref: string
}

const selectStyle: CSSProperties = {
  height: 38,
  padding: '0 11px',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  font: `500 13px/1 ${FONT}`,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const th: CSSProperties = {
  textAlign: 'left',
  padding: '9px 14px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
}

export function OrderCreatePanel({ moduleHref }: OrderCreatePanelProps) {
  const { navigate } = useAdminNavigate()
  const createOrder = useCreateOrder()
  const { data: productsData } = useProducts({ limit: 100 })
  const products = productsData?.products ?? []

  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    city: 'Dhaka',
    district: 'Dhaka',
    division: 'Dhaka',
  })
  const [delivery, setDelivery] = useState('120')
  const [paymentMethod, setPaymentMethod] = useState('COD')
  const [lines, setLines] = useState<LineItem[]>([])
  const [pickerProductId, setPickerProductId] = useState('')
  const [pickerVariantId, setPickerVariantId] = useState('')
  const [pickerQty, setPickerQty] = useState('1')

  const pickerProduct = products.find((p) => p.id === pickerProductId)
  const pickerVariants = pickerProduct?.variants ?? []

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.price * l.quantity, 0),
    [lines],
  )
  const deliveryNum = Number(delivery) || 0
  const total = subtotal + deliveryNum

  const addLine = () => {
    if (!pickerProduct) {
      toastFail('Select a product.')
      return
    }
    const variant = pickerVariants.find((v) => v.id === pickerVariantId) ?? pickerVariants[0]
    if (!variant?.id) {
      toastFail('Product has no variants.')
      return
    }
    const qty = Math.max(1, Number(pickerQty) || 1)
    const price = Number(variant.price ?? pickerProduct.basePrice)
    setLines((prev) => [
      ...prev,
      {
        productId: pickerProduct.id,
        variantId: variant.id!,
        name: pickerProduct.name,
        price,
        quantity: qty,
        ...(variant.size ? { size: variant.size } : {}),
        ...(variant.color || variant.colorName ? { color: variant.colorName ?? variant.color } : {}),
      },
    ])
    setPickerQty('1')
  }

  const handleSubmit = async () => {
    if (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim()) {
      toastFail('Customer name, phone, and address are required.')
      return
    }
    if (!lines.length) {
      toastFail('Add at least one product line.')
      return
    }
    try {
      const order = await createOrder.mutateAsync({
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          address: customer.address.trim(),
          city: customer.city.trim(),
          district: customer.district.trim(),
          division: customer.division.trim(),
        },
        items: lines,
        subtotal,
        delivery: deliveryNum,
        total,
        paymentMethod,
      })
      if (!verifyPersisted(Boolean(order.id && order.invoiceNumber), 'Order create did not return a valid order')) return
      if (!verifyStringEquals(order.shippingPhone, customer.phone.trim(), 'Customer phone')) return
      if (!verifyStringEquals(order.shippingName, customer.name.trim(), 'Customer name')) return
      if (!verifyNumberEquals(order.total, total, 'Order total')) return
      toastApiSaved(`Order ${order.invoiceNumber}`)
      navigate(`${moduleHref}/${order.invoiceNumber}`)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not create order.')
    }
  }

  return (
    <div className="dc-order-new-body mx-auto max-w-4xl" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <DcSectionCard num="01" title="Customer" hint="Name, phone, and delivery address — verified on create.">
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <DcField label="Customer name *">
            <DcInput
              value={customer.name}
              onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
            />
          </DcField>
          <DcField label="Phone *">
            <DcInput
              mono
              value={customer.phone}
              onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
              placeholder="01XXXXXXXXX"
            />
          </DcField>
          <DcField label="Address *">
            <DcInput
              value={customer.address}
              onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))}
              style={{ gridColumn: '1 / -1' }}
            />
          </DcField>
          <DcField label="City">
            <DcInput
              value={customer.city}
              onChange={(e) => setCustomer((c) => ({ ...c, city: e.target.value }))}
            />
          </DcField>
          <DcField label="District">
            <DcInput
              value={customer.district}
              onChange={(e) => setCustomer((c) => ({ ...c, district: e.target.value }))}
            />
          </DcField>
        </div>
      </DcSectionCard>

      <DcSectionCard num="02" title="Order lines" hint="Pick product + variant, then create — nothing saves until verified.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <select
            style={{ ...selectStyle, minWidth: 180, width: 'auto', flex: 1 }}
            value={pickerProductId}
            onChange={(e) => {
              setPickerProductId(e.target.value)
              setPickerVariantId('')
            }}
          >
            <option value="">Select product</option>
            {products.map((p: ApiProduct) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {pickerVariants.length > 0 ? (
            <select
              style={{ ...selectStyle, minWidth: 140, width: 'auto' }}
              value={pickerVariantId || pickerVariants[0]?.id || ''}
              onChange={(e) => setPickerVariantId(e.target.value)}
            >
              {pickerVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {[v.size, v.colorName ?? v.color].filter(Boolean).join(' / ') || v.sku || 'Default'} (stock{' '}
                  {v.stock ?? 0})
                </option>
              ))}
            </select>
          ) : null}
          <DcInput
            type="number"
            min={1}
            value={pickerQty}
            onChange={(e) => setPickerQty(e.target.value)}
            style={{ width: 72 }}
          />
          <AdminButton variant="secondary" onClick={addLine}>
            <DcIcon name="Plus" size={14} /> Add
          </AdminButton>
        </div>

        {lines.length > 0 ? (
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Product', 'Qty', 'Price', 'Subtotal', ''].map((h) => (
                    <th key={h || 'x'} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={`${line.variantId}-${i}`}>
                    <td style={{ padding: '10px 14px', font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                      {line.name}
                      {line.size ? ` · ${line.size}` : ''}
                    </td>
                    <td style={{ padding: '10px 14px', font: `500 13px/1 ${MONO}`, color: 'var(--ink-2)' }}>
                      {line.quantity}
                    </td>
                    <td style={{ padding: '10px 14px', font: `500 13px/1 ${MONO}`, color: 'var(--ink-2)' }}>
                      {formatTaka(line.price)}
                    </td>
                    <td style={{ padding: '10px 14px', font: `700 13px/1 ${MONO}`, color: 'var(--ink)' }}>
                      {formatTaka(line.price * line.quantity)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        type="button"
                        aria-label="Remove line"
                        onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--bad)',
                          cursor: 'pointer',
                          padding: 4,
                        }}
                      >
                        <DcIcon name="Trash2" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: 0, font: `500 13px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
            No items yet — add products above.
          </p>
        )}

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <DcField label="Delivery (BDT)">
            <DcInput mono type="number" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
          </DcField>
          <DcField label="Payment">
            <select style={selectStyle} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="COD">Cash on delivery</option>
              <option value="bKash">bKash</option>
              <option value="SSLCommerz">SSLCommerz</option>
            </select>
          </DcField>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'end' }}>
            <span
              style={{
                font: `600 10.5px/1 ${FONT}`,
                letterSpacing: '.09em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              Total
            </span>
            <p style={{ margin: 0, font: `700 22px/1 ${MONO}`, color: 'var(--violet)' }}>{formatTaka(total)}</p>
          </div>
        </div>

        <AdminButton variant="accent" loading={createOrder.isPending} onClick={() => void handleSubmit()}>
          <DcIcon name="Check" size={14} />
          Create order
        </AdminButton>
      </DcSectionCard>
    </div>
  )
}

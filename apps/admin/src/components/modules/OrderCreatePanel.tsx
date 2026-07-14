'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Plus, Save, ShoppingBag, Trash2 } from 'lucide-react'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import { verifyNumberEquals, verifyPersisted, verifyStringEquals } from '@/lib/admin/mutation-verify'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
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
    <div className="mx-auto max-w-4xl space-y-5">
      <AdminLinkButton href={moduleHref} variant="ghost">
        <ArrowLeft className="h-4 w-4" />
        Back to orders
      </AdminLinkButton>

      <section className="admin-module-card admin-module-card--accent">
        <div className="mb-4 flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-[#5E7CFF]" />
          <h3 className="admin-module-card__title">Manual order</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="admin-field">
            <span className="admin-kpi__label">Customer name *</span>
            <input className="admin-input" value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">Phone *</span>
            <input className="admin-input" value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} placeholder="01XXXXXXXXX" />
          </label>
          <label className="admin-field md:col-span-2">
            <span className="admin-kpi__label">Address *</span>
            <input className="admin-input" value={customer.address} onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))} />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">City</span>
            <input className="admin-input" value={customer.city} onChange={(e) => setCustomer((c) => ({ ...c, city: e.target.value }))} />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">District</span>
            <input className="admin-input" value={customer.district} onChange={(e) => setCustomer((c) => ({ ...c, district: e.target.value }))} />
          </label>
        </div>
      </section>

      <section className="admin-module-card">
        <h3 className="admin-module-card__title">Order lines</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <select className="admin-input min-w-[180px]" value={pickerProductId} onChange={(e) => { setPickerProductId(e.target.value); setPickerVariantId('') }}>
            <option value="">Select product</option>
            {products.map((p: ApiProduct) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {pickerVariants.length > 0 ? (
            <select className="admin-input min-w-[140px]" value={pickerVariantId || pickerVariants[0]?.id || ''} onChange={(e) => setPickerVariantId(e.target.value)}>
              {pickerVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {[v.size, v.colorName ?? v.color].filter(Boolean).join(' / ') || v.sku || 'Default'} (stock {v.stock ?? 0})
                </option>
              ))}
            </select>
          ) : null}
          <input className="admin-input w-20" type="number" min={1} value={pickerQty} onChange={(e) => setPickerQty(e.target.value)} />
          <AdminButton onClick={addLine}><Plus className="h-4 w-4" /> Add</AdminButton>
        </div>

        {lines.length > 0 ? (
          <table className="admin-module-table mt-4">
            <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Subtotal</th><th /></tr></thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={`${line.variantId}-${i}`}>
                  <td className="font-semibold">{line.name}{line.size ? ` · ${line.size}` : ''}</td>
                  <td>{line.quantity}</td>
                  <td>৳{line.price.toLocaleString('en-BD')}</td>
                  <td className="font-black">৳{(line.price * line.quantity).toLocaleString('en-BD')}</td>
                  <td>
                    <button type="button" className="text-red-600" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-[#6B6B6B]">No items yet — add products above.</p>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="admin-field">
            <span className="admin-kpi__label">Delivery (BDT)</span>
            <input className="admin-input" type="number" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">Payment</span>
            <select className="admin-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="COD">Cash on delivery</option>
              <option value="bKash">bKash</option>
              <option value="SSLCommerz">SSLCommerz</option>
            </select>
          </label>
          <div className="admin-field">
            <span className="admin-kpi__label">Total</span>
            <p className="text-xl font-black text-[#5E7CFF]">৳{total.toLocaleString('en-BD')}</p>
          </div>
        </div>

        <AdminButton variant="gold" className="mt-4" loading={createOrder.isPending} onClick={handleSubmit}>
          <Save className="h-4 w-4" />
          Create order
        </AdminButton>
      </section>
    </div>
  )
}

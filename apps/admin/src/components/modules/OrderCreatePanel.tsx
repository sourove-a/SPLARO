'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import { verifyNumberEquals, verifyPersisted, verifyStringEquals } from '@/lib/admin/mutation-verify'
import { AdminButton } from '@/components/ui/AdminButton'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcField, DcInput, DcSectionCard } from '@/components/dc/product/DcProductFormPrimitives'
import { FONT, MONO, formatTaka } from '@/components/dc/tokens'
import { useCreateOrder, useSettings } from '@/lib/api/hooks'
import { searchPosCatalog, type PosProduct, type PosVariant } from '@/lib/api/pos'
import { useAdminNavigate } from '@/lib/navigation/client-nav'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import {
  BD_DISTRICTS,
  composeStreetAddress,
  computeManualOrderDelivery,
  defaultThanaForDistrict,
  getThanasForDistrict,
  isDhakaDistrict,
} from '@/lib/geo/delivery-address'
import { DELIVERY_ZONES } from '@splaro/config'

interface LineItem {
  productId: string
  variantId: string
  name: string
  sku?: string
  productCode?: string
  image?: string
  price: number
  quantity: number
  size?: string
  color?: string
  stock?: number
}

function catalogCodeLine(p: PosProduct, variant?: PosVariant | null) {
  const code = p.productCode?.trim()
  const sku = variant?.sku ?? p.sku ?? p.variants[0]?.sku
  const barcode = variant?.barcode ?? p.barcode ?? p.variants[0]?.barcode
  return [code ? `Code ${code}` : null, sku ? `SKU ${sku}` : null, barcode ? `BC ${barcode}` : null]
    .filter(Boolean)
    .join(' · ')
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

function variantLabel(v: PosVariant): string {
  return [v.size, v.color].filter(Boolean).join(' · ') || 'Default'
}

function variantStock(v: PosVariant): number {
  return Number(v.stock ?? 0)
}

export function OrderCreatePanel({ moduleHref }: OrderCreatePanelProps) {
  const { navigate } = useAdminNavigate()
  const createOrder = useCreateOrder()
  const { data: settings } = useSettings()
  const shipping = settings?.shipping

  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    district: 'Dhaka',
    thana: defaultThanaForDistrict('Dhaka'),
  })
  const [paymentMethod, setPaymentMethod] = useState('COD')
  const [lines, setLines] = useState<LineItem[]>([])

  const [skuQuery, setSkuQuery] = useState('')
  const debouncedSku = useDebouncedValue(skuQuery.trim(), 280)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupHits, setLookupHits] = useState<PosProduct[]>([])
  const [matchedVariantId, setMatchedVariantId] = useState<string | null>(null)
  const [pickedProduct, setPickedProduct] = useState<PosProduct | null>(null)
  const [pickedVariantId, setPickedVariantId] = useState('')
  const [pickerQty, setPickerQty] = useState('1')

  const thanaOptions = useMemo(
    () => getThanasForDistrict(customer.district),
    [customer.district],
  )

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.price * l.quantity, 0),
    [lines],
  )
  const deliveryNum = computeManualOrderDelivery(subtotal, customer.district, shipping)
  const total = subtotal + deliveryNum
  const insideDhaka = isDhakaDistrict(customer.district)
  const freeDelivery = subtotal > 0 && deliveryNum === 0
  const dhakaCharge = Math.round(Number(shipping?.dhakaDeliveryCharge ?? DELIVERY_ZONES.INSIDE_DHAKA.charge))
  const outsideCharge = Math.round(
    Number(shipping?.outsideDhakaCharge ?? DELIVERY_ZONES.OUTSIDE_DHAKA.charge),
  )
  const freeThreshold = Math.round(Number(shipping?.freeShippingMin ?? 0))

  const pickedVariant =
    pickedProduct?.variants.find((v) => v.id === pickedVariantId) ?? pickedProduct?.variants[0]

  const runLookup = useCallback(async (raw: string) => {
    const q = raw.trim()
    if (!q) {
      setLookupHits([])
      setMatchedVariantId(null)
      return
    }
    setLookupLoading(true)
    try {
      const looksLikeSku = /^[A-Za-z0-9][A-Za-z0-9._-]{2,}$/.test(q) && !q.includes(' ')
      const res = looksLikeSku
        ? await searchPosCatalog({ sku: q, includeUnpublished: true })
        : await searchPosCatalog({ q, includeUnpublished: true })
      const products = res.products ?? []
      if (looksLikeSku && products.length === 0) {
        const fallback = await searchPosCatalog({ q, includeUnpublished: true })
        setLookupHits(fallback.products ?? [])
        setMatchedVariantId(fallback.matchedVariantId)
        return
      }
      setLookupHits(products)
      setMatchedVariantId(res.matchedVariantId)
      if (res.matchedVariantId && products[0]) {
        const product = products[0]
        const variant =
          product.variants.find((v) => v.id === res.matchedVariantId) ?? product.variants[0]
        setPickedProduct(product)
        setPickedVariantId(variant?.id ?? '')
      } else if (products.length === 1) {
        setPickedProduct(products[0] ?? null)
        setPickedVariantId(products[0]?.variants[0]?.id ?? '')
      }
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Product lookup failed.')
      setLookupHits([])
    } finally {
      setLookupLoading(false)
    }
  }, [])

  useEffect(() => {
    void runLookup(debouncedSku)
  }, [debouncedSku, runLookup])

  const selectProduct = (product: PosProduct, variantId?: string) => {
    const variant =
      product.variants.find((v) => v.id === variantId) ??
      product.variants.find((v) => v.id === matchedVariantId) ??
      product.variants[0]
    setPickedProduct(product)
    setPickedVariantId(variant?.id ?? '')
  }

  const addLine = () => {
    if (!pickedProduct) {
      toastFail('Find a product by Product Code or name first.')
      return
    }
    const variant = pickedVariant
    if (!variant?.id) {
      toastFail('Product has no variants.')
      return
    }
    const stock = variantStock(variant)
    if (stock <= 0) {
      toastFail(`${pickedProduct.name} is out of stock.`)
      return
    }
    const qty = Math.max(1, Number(pickerQty) || 1)
    if (qty > stock) {
      toastFail(`Only ${stock} left in stock.`)
      return
    }
    setLines((prev) => {
      const existing = prev.findIndex((l) => l.variantId === variant.id)
      if (existing >= 0) {
        const nextQty = (prev[existing]?.quantity ?? 0) + qty
        if (nextQty > stock) {
          toastFail(`Only ${stock} left in stock.`)
          return prev
        }
        return prev.map((l, i) => (i === existing ? { ...l, quantity: nextQty } : l))
      }
      const sku = variant.sku ?? pickedProduct.sku
      const productCode = pickedProduct.productCode?.trim()
      const image = variant.image ?? pickedProduct.image
      return [
        ...prev,
        {
          productId: pickedProduct.id,
          variantId: variant.id,
          name: pickedProduct.name,
          price: Number(variant.price ?? pickedProduct.basePrice),
          quantity: qty,
          stock,
          ...(sku ? { sku } : {}),
          ...(productCode ? { productCode } : {}),
          ...(image ? { image } : {}),
          ...(variant.size ? { size: variant.size } : {}),
          ...(variant.color ? { color: variant.color } : {}),
        },
      ]
    })
    setPickerQty('1')
  }

  const handleSubmit = async () => {
    if (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim()) {
      toastFail('Customer name, phone, and street address are required.')
      return
    }
    if (!customer.district.trim() || !customer.thana.trim()) {
      toastFail('Select district (জেলা) and thana (থানা).')
      return
    }
    if (!lines.length) {
      toastFail('Add at least one product line.')
      return
    }
    const fullAddress = composeStreetAddress(
      customer.address.trim(),
      customer.thana.trim(),
      customer.district.trim(),
    )
    try {
      const order = await createOrder.mutateAsync({
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          address: fullAddress,
          city: customer.thana.trim(),
          district: customer.district.trim(),
          division: customer.district.trim(),
        },
        items: lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
          name: l.name,
          price: l.price,
          ...(l.size ? { size: l.size } : {}),
          ...(l.color ? { color: l.color } : {}),
        })),
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
      <DcSectionCard
        num="01"
        title="Customer"
        hint="Name, phone, street — জেলা/থানা dropdown. Delivery charge auto from district."
      >
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <DcField label="Customer name *">
            <DcInput
              value={customer.name}
              onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
              placeholder="Full name"
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
          <DcField label="Street address *">
            <DcInput
              value={customer.address}
              onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))}
              placeholder="House, road, area"
            />
          </DcField>
          <DcField label="District · জেলা *">
            <select
              style={selectStyle}
              value={customer.district}
              onChange={(e) => {
                const district = e.target.value
                setCustomer((c) => ({
                  ...c,
                  district,
                  thana: defaultThanaForDistrict(district),
                }))
              }}
            >
              {BD_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </DcField>
          <DcField label="Thana · থানা *">
            <select
              style={selectStyle}
              value={customer.thana}
              onChange={(e) => setCustomer((c) => ({ ...c, thana: e.target.value }))}
            >
              {thanaOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </DcField>
        </div>
        <p style={{ margin: '4px 0 0', font: `500 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
          Courier address:{' '}
          <span style={{ color: 'var(--ink-2)' }}>
            {composeStreetAddress(customer.address || '…', customer.thana, customer.district)}
          </span>
          {' · '}
          {freeDelivery
            ? `Free delivery (৳${freeThreshold.toLocaleString('en-BD')}+)`
            : insideDhaka
              ? `Inside Dhaka · ৳${dhakaCharge}`
              : `Outside Dhaka · ৳${outsideCharge}`}
        </p>
      </DcSectionCard>

      <DcSectionCard
        num="02"
        title="Order lines"
        hint="Type Product Code, SKU, barcode, or name — details appear, then add. Nothing saves until verified create."
      >
        <DcField label="Product code, SKU, barcode, or name">
          <DcInput
            mono
            value={skuQuery}
            onChange={(e) => setSkuQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void runLookup(skuQuery)
              }
            }}
            placeholder="284731, SKU, or scan"
          />
        </DcField>

        {lookupLoading ? (
          <p style={{ margin: 0, font: `500 13px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>Looking up catalog…</p>
        ) : null}

        {!pickedProduct && lookupHits.length > 1 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {lookupHits.slice(0, 8).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProduct(p)}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  textAlign: 'left',
                  padding: 10,
                  borderRadius: 12,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  cursor: 'pointer',
                }}
              >
                <ProductThumb src={p.image} alt={p.name} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', font: `650 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                    {p.name}
                  </span>
                  <span style={{ font: `500 11.5px/1.4 ${MONO}`, color: 'var(--ink-3)' }}>
                    {catalogCodeLine(p) || 'No code'} · {p.variants.length} variant
                    {p.variants.length === 1 ? '' : 's'} · {formatTaka(Number(p.basePrice))}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {skuQuery.trim() && !lookupLoading && !pickedProduct && lookupHits.length === 0 ? (
          <p style={{ margin: 0, font: `500 13px/1.4 ${FONT}`, color: 'var(--bad)' }}>
            No product matched that Product Code, SKU, barcode, or name.
          </p>
        ) : null}

        {pickedProduct ? (
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: '88px 1fr',
              padding: 14,
              borderRadius: 14,
              border: '1px solid var(--violet-bd, var(--line))',
              background: 'var(--violet-soft, var(--surface-2))',
            }}
          >
            <ProductThumb src={pickedVariant?.image ?? pickedProduct.image} alt={pickedProduct.name} size={88} />
            <div style={{ minWidth: 0, display: 'grid', gap: 8 }}>
              <div>
                <p style={{ margin: 0, font: `700 15px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                  {pickedProduct.name}
                </p>
                <p style={{ margin: '4px 0 0', font: `500 12px/1.4 ${MONO}`, color: 'var(--ink-2)' }}>
                  {catalogCodeLine(pickedProduct, pickedVariant) || 'No code'}
                  {matchedVariantId && pickedVariant?.id === matchedVariantId ? ' · exact match' : ''}
                </p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span style={{ font: `700 18px/1 ${MONO}`, color: 'var(--violet)' }}>
                  {formatTaka(Number(pickedVariant?.price ?? pickedProduct.basePrice))}
                </span>
                <span
                  style={{
                    font: `600 11.5px/1 ${FONT}`,
                    color: variantStock(pickedVariant ?? { stock: 0 } as PosVariant) > 0 ? 'var(--ok)' : 'var(--bad)',
                  }}
                >
                  Stock {pickedVariant ? variantStock(pickedVariant) : 0}
                </span>
              </div>
              {pickedProduct.variants.length > 1 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {pickedProduct.variants.map((v) => {
                    const active = (pickedVariantId || pickedProduct.variants[0]?.id) === v.id
                    const oos = variantStock(v) <= 0
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={oos}
                        onClick={() => setPickedVariantId(v.id)}
                        style={{
                          height: 30,
                          padding: '0 10px',
                          borderRadius: 999,
                          border: `1px solid ${active ? 'var(--violet)' : 'var(--line)'}`,
                          background: active ? 'var(--surface)' : 'var(--surface-2)',
                          color: oos ? 'var(--ink-3)' : 'var(--ink)',
                          font: `600 11.5px/1 ${FONT}`,
                          cursor: oos ? 'not-allowed' : 'pointer',
                          opacity: oos ? 0.55 : 1,
                        }}
                      >
                        {variantLabel(v)}
                        {v.sku ? ` · ${v.sku}` : ''}
                        {v.barcode ? ` · ${v.barcode}` : ''}
                      </button>
                    )
                  })}
                </div>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <DcInput
                  type="number"
                  min={1}
                  max={pickedVariant ? variantStock(pickedVariant) : undefined}
                  value={pickerQty}
                  onChange={(e) => setPickerQty(e.target.value)}
                  style={{ width: 72 }}
                />
                <AdminButton variant="secondary" onClick={addLine}>
                  <DcIcon name="Plus" size={14} /> Add to order
                </AdminButton>
                <button
                  type="button"
                  onClick={() => {
                    setPickedProduct(null)
                    setPickedVariantId('')
                    setSkuQuery('')
                    setLookupHits([])
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--ink-3)',
                    cursor: 'pointer',
                    font: `600 12px/1 ${FONT}`,
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        ) : null}

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
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <ProductThumb src={line.image} alt={line.name} size={40} />
                        <div>
                          <div style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                            {line.name}
                            {line.size || line.color ? ` · ${[line.size, line.color].filter(Boolean).join(' / ')}` : ''}
                          </div>
                          {(line.productCode || line.sku) ? (
                            <div style={{ font: `500 11px/1.3 ${MONO}`, color: 'var(--ink-3)' }}>
                              {line.productCode ? `Code ${line.productCode}` : ''}
                              {line.productCode && line.sku ? ' · ' : ''}
                              {line.sku ?? ''}
                            </div>
                          ) : null}
                        </div>
                      </div>
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
            No items yet — search Product Code above and add.
          </p>
        )}

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <DcField label="Delivery (auto)">
            <DcInput mono readOnly value={String(deliveryNum)} />
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

function ProductThumb({
  src,
  alt,
  size = 52,
}: {
  src?: string | null | undefined
  alt: string
  size?: number
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <DcIcon name="Package" size={Math.round(size * 0.38)} />
      )}
    </span>
  )
}

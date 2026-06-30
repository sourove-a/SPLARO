'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Banknote, Barcode, CreditCard, Loader2, Minus, Plus, Printer,
  Receipt, Search, ShoppingBag, Smartphone, Trash2, X,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { SplaroAdminLogo } from '@/components/brand/SplaroAdminLogo'
import { printInvoice } from '@/lib/admin/admin-actions'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import {
  createPosSale,
  fetchPosCatalog,
  fetchPosToday,
  type PosPaymentMethod,
  type PosProduct,
  type PosVariant,
} from '@/lib/api/pos'
import { cn } from '@/lib/utils/cn'

interface CartLine {
  key: string
  productId: string
  variantId: string
  name: string
  variantLabel: string
  image: string | null
  price: number
  quantity: number
  stock: number
}

function formatBdt(n: number) {
  return `৳${n.toLocaleString('en-BD')}`
}

function variantLabel(v: PosVariant) {
  return [v.color, v.size].filter(Boolean).join(' · ') || 'Default'
}

function PaymentBtn({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button type="button" className={cn('pos-pay-btn', active && 'pos-pay-btn--active')} onClick={onClick}>
      <Icon size={18} strokeWidth={2} />
      <span>{label}</span>
    </button>
  )
}

export function PosPanel() {
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<PosProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('cash')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const [lastSale, setLastSale] = useState<{ id: string; invoiceNumber: string; total: number } | null>(null)
  const [today, setToday] = useState({ count: 0, total: 0 })
  const [picker, setPicker] = useState<PosProduct | null>(null)
  const [clock, setClock] = useState('')

  const addToCart = useCallback((product: PosProduct, variant: PosVariant) => {
    if (variant.stock <= 0) {
      toastFail('Out of stock')
      return
    }
    const key = `${product.id}:${variant.id}`
    setCart((lines) => {
      const existing = lines.find((l) => l.key === key)
      if (existing) {
        if (existing.quantity >= variant.stock) {
          toastFail(`Only ${variant.stock} available`)
          return lines
        }
        return lines.map((l) =>
          l.key === key ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [
        ...lines,
        {
          key,
          productId: product.id,
          variantId: variant.id,
          name: product.name,
          variantLabel: variantLabel(variant),
          image: variant.image ?? product.image,
          price: variant.price,
          quantity: 1,
          stock: variant.stock,
        },
      ]
    })
    setPicker(null)
    toastOk(`${product.name} added`)
  }, [])

  const loadCatalog = useCallback(async (q?: string, sku?: string) => {
    setLoading(true)
    try {
      const data = await fetchPosCatalog({
        ...(q ? { q } : {}),
        ...(sku ? { sku } : {}),
      })
      setProducts(data.products)
      if (data.matchedVariantId && data.products[0]) {
        const product = data.products[0]
        const variant = product.variants.find((v) => v.id === data.matchedVariantId)
        if (variant) addToCart(product, variant)
        setQuery('')
      }
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Product load failed')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [addToCart])

  const refreshToday = useCallback(async () => {
    try {
      const stats = await fetchPosToday()
      setToday({ count: stats.count, total: stats.total })
    } catch {
      /* offline — keep previous */
    }
  }, [])

  useEffect(() => {
    void loadCatalog()
    void refreshToday()
  }, [loadCatalog, refreshToday])

  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const updateQty = (key: string, delta: number) => {
    setCart((lines) =>
      lines
        .map((l) => {
          if (l.key !== key) return l
          const next = l.quantity + delta
          if (next <= 0) return null
          if (next > l.stock) {
            toastFail(`Only ${l.stock} in stock`)
            return l
          }
          return { ...l, quantity: next }
        })
        .filter(Boolean) as CartLine[],
    )
  }

  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.price * l.quantity, 0),
    [cart],
  )
  const discountAmount = Math.min(Math.max(Number(discount) || 0, 0), subtotal)
  const total = subtotal - discountAmount

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) {
      void loadCatalog()
      return
    }
    const looksLikeSku = /^[A-Z0-9\-_]+$/i.test(q) && q.length >= 4
    void loadCatalog(looksLikeSku ? undefined : q, looksLikeSku ? q : undefined)
  }

  const onProductClick = (product: PosProduct) => {
    const inStock = product.variants.filter((v) => v.stock > 0)
    if (!inStock.length) {
      toastFail('Out of stock')
      return
    }
    if (inStock.length === 1) {
      const only = inStock[0]
      if (only) addToCart(product, only)
      return
    }
    setPicker(product)
  }

  const completeSale = async () => {
    if (!cart.length) {
      toastFail('Cart is empty')
      return
    }
    setCheckingOut(true)
    try {
      const result = await createPosSale({
        items: cart.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
        paymentMethod,
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
        ...(discountAmount > 0 ? { discount: discountAmount } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      setLastSale({
        id: result.order.id,
        invoiceNumber: result.order.invoiceNumber,
        total: result.order.total,
      })
      setCart([])
      setDiscount('')
      setNotes('')
      void refreshToday()
      void loadCatalog(query.trim() || undefined)
      toastOk(`Sale complete — ${result.order.invoiceNumber}`)
      printInvoice(result.order.id)
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Sale failed')
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <div className="pos-shell">
      <header className="pos-header">
        <div className="pos-header__brand">
          <SplaroAdminLogo variant="sidebar" priority className="!max-w-[150px]" />
          <div>
            <h1 className="pos-header__title">SPLARO POS</h1>
            <p className="pos-header__sub">Showroom counter · in-store sales</p>
          </div>
        </div>
        <div className="pos-header__stats">
          <div className="pos-stat">
            <span className="pos-stat__label">Today</span>
            <strong className="pos-stat__value">{today.count} sales</strong>
          </div>
          <div className="pos-stat pos-stat--gold">
            <span className="pos-stat__label">Revenue</span>
            <strong className="pos-stat__value">{formatBdt(today.total)}</strong>
          </div>
          <div className="pos-stat">
            <span className="pos-stat__label">Time</span>
            <strong className="pos-stat__value">{clock}</strong>
          </div>
        </div>
      </header>

      <div className="pos-layout">
        <section className="pos-catalog">
          <form className="pos-search" onSubmit={onSearch}>
            <Search size={18} className="pos-search__icon" />
            <input
              ref={searchRef}
              className="pos-search__input"
              placeholder="Search product name or scan barcode / SKU…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <Barcode size={18} className="pos-search__barcode" aria-hidden />
          </form>

          {loading ? (
            <div className="pos-loading">
              <Loader2 size={28} className="animate-spin" />
              <span>Loading products…</span>
            </div>
          ) : products.length === 0 ? (
            <div className="pos-empty">
              <ShoppingBag size={40} strokeWidth={1.2} />
              <p>No products found</p>
            </div>
          ) : (
            <div className="pos-grid">
              {products.map((product) => {
                const stock = product.variants.reduce((s, v) => s + v.stock, 0)
                const priceFrom = product.variants[0]?.price ?? product.basePrice
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={cn('pos-card', stock <= 0 && 'pos-card--oos')}
                    onClick={() => onProductClick(product)}
                    disabled={stock <= 0}
                  >
                    <div className="pos-card__img">
                      {product.image ? (
                        <Image src={product.image} alt="" fill sizes="160px" className="object-cover" />
                      ) : (
                        <ShoppingBag size={28} strokeWidth={1.2} />
                      )}
                    </div>
                    <div className="pos-card__body">
                      <p className="pos-card__name">{product.name}</p>
                      <p className="pos-card__price">{formatBdt(priceFrom)}</p>
                      <p className="pos-card__stock">{stock > 0 ? `${stock} in stock` : 'Out of stock'}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <aside className="pos-cart">
          <div className="pos-cart__head">
            <Receipt size={18} />
            <h2>Current sale</h2>
            {cart.length > 0 && (
              <button type="button" className="pos-cart__clear" onClick={() => setCart([])}>
                <Trash2 size={14} />
                Clear
              </button>
            )}
          </div>

          <div className="pos-cart__lines">
            {cart.length === 0 ? (
              <p className="pos-cart__empty">Scan or tap a product to add items</p>
            ) : (
              cart.map((line) => (
                <div key={line.key} className="pos-line">
                  <div className="pos-line__thumb">
                    {line.image ? (
                      <Image src={line.image} alt="" fill sizes="48px" className="object-cover" />
                    ) : null}
                  </div>
                  <div className="pos-line__info">
                    <p className="pos-line__name">{line.name}</p>
                    <p className="pos-line__variant">{line.variantLabel}</p>
                    <p className="pos-line__price">{formatBdt(line.price)}</p>
                  </div>
                  <div className="pos-line__qty">
                    <button type="button" onClick={() => updateQty(line.key, -1)} aria-label="Decrease">
                      <Minus size={14} />
                    </button>
                    <span>{line.quantity}</span>
                    <button type="button" onClick={() => updateQty(line.key, 1)} aria-label="Increase">
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="pos-line__total">{formatBdt(line.price * line.quantity)}</p>
                </div>
              ))
            )}
          </div>

          <div className="pos-cart__customer">
            <input
              className="pos-input"
              placeholder="Customer name (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <input
              className="pos-input"
              placeholder="Phone (optional)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              inputMode="tel"
            />
          </div>

          <div className="pos-cart__discount">
            <label className="pos-label">Discount (৳)</label>
            <input
              className="pos-input"
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="pos-pay-methods">
            <PaymentBtn active={paymentMethod === 'cash'} onClick={() => setPaymentMethod('cash')} icon={Banknote} label="Cash" />
            <PaymentBtn active={paymentMethod === 'bkash'} onClick={() => setPaymentMethod('bkash')} icon={Smartphone} label="bKash" />
            <PaymentBtn active={paymentMethod === 'nagad'} onClick={() => setPaymentMethod('nagad')} icon={Smartphone} label="Nagad" />
            <PaymentBtn active={paymentMethod === 'card'} onClick={() => setPaymentMethod('card')} icon={CreditCard} label="Card" />
          </div>

          <div className="pos-totals">
            <div className="pos-total-row">
              <span>Subtotal</span>
              <span>{formatBdt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="pos-total-row pos-total-row--muted">
                <span>Discount</span>
                <span>−{formatBdt(discountAmount)}</span>
              </div>
            )}
            <div className="pos-total-row pos-total-row--grand">
              <span>Total</span>
              <strong>{formatBdt(total)}</strong>
            </div>
          </div>

          <AdminButton
            className="pos-checkout-btn"
            onClick={() => void completeSale()}
            disabled={checkingOut || cart.length === 0}
          >
            {checkingOut ? <Loader2 size={18} className="animate-spin" /> : <Receipt size={18} />}
            {checkingOut ? 'Processing…' : `Complete sale · ${formatBdt(total)}`}
          </AdminButton>

          {lastSale && (
            <div className="pos-last-sale">
              <p>Last: <strong>{lastSale.invoiceNumber}</strong> · {formatBdt(lastSale.total)}</p>
              <button type="button" onClick={() => printInvoice(lastSale.id)}>
                <Printer size={14} />
                Reprint
              </button>
            </div>
          )}
        </aside>
      </div>

      {picker && (
        <div className="pos-modal-backdrop" onClick={() => setPicker(null)} role="presentation">
          <div className="pos-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose variant">
            <div className="pos-modal__head">
              <h3>{picker.name}</h3>
              <button type="button" onClick={() => setPicker(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="pos-variant-list">
              {picker.variants.filter((v) => v.stock > 0).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="pos-variant-row"
                  onClick={() => addToCart(picker, v)}
                >
                  {v.colorHex && (
                    <span className="pos-variant-swatch" style={{ background: v.colorHex }} />
                  )}
                  <span className="pos-variant-label">{variantLabel(v)}</span>
                  <span className="pos-variant-stock">{v.stock} left</span>
                  <span className="pos-variant-price">{formatBdt(v.price)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CreditCard, Smartphone } from 'lucide-react'
import { fetchOrderById, loadOrders, type StoredOrder } from '@/lib/orders'
import { buildOrderConfirmationPath } from '@/lib/invoice-url'
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'
import { formatBDT } from '@/lib/utils/currency'
import { displayOrderCode } from '@splaro/config'

interface MobilePaymentPageClientProps {
  orderId: string
  provider: string
  paymentId: string
}

const PROVIDER_LABELS: Record<string, string> = {
  bkash: 'bKash',
  nagad: 'Nagad',
}

export default function MobilePaymentPageClient({
  orderId,
  provider,
  paymentId,
}: MobilePaymentPageClientProps) {
  const router = useRouter()
  const [order, setOrder] = useState<StoredOrder | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const providerLabel = PROVIDER_LABELS[provider.toLowerCase()] ?? provider

  useEffect(() => {
    if (!orderId) {
      setHydrated(true)
      return
    }

    fetchOrderById(orderId).then((match) => {
      setOrder(match ?? loadOrders().find((item) => item.id === orderId) ?? null)
      setHydrated(true)
    })
  }, [orderId])

  if (!hydrated) {
    return (
      <main className="checkout-shell checkout-shell--loading">
        <div className="checkout-glass-panel checkout-glass-panel--center">
          <CreditCard className="mx-auto h-8 w-8 text-black/35" strokeWidth={2} />
          <p className="mt-4 text-sm font-black text-black/55">Loading payment...</p>
        </div>
      </main>
    )
  }

  if (!orderId || !provider) {
    return (
      <main className="checkout-shell">
        <section className="checkout-container">
          <div className="checkout-glass-panel checkout-glass-panel--center">
            <p className="checkout-eyebrow">Payment link invalid</p>
            <h1 className="checkout-title">Missing payment details</h1>
            <p className="checkout-subtitle">Return to checkout and try again.</p>
            <Link href="/checkout" className="checkout-btn checkout-btn--primary mt-6">
              Back to checkout
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const total = order?.total ?? 0
  const orderLabel = order
    ? displayOrderCode(order.invoiceNumber, order.id)
    : displayOrderCode(orderId, orderId)

  return (
    <main className="checkout-shell">
      <section className="checkout-container">
        <div className="checkout-glass-panel max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <Smartphone className="h-6 w-6 text-[#C8A97E]" strokeWidth={2} />
            <p className="checkout-eyebrow">Mobile payment</p>
          </div>
          <h1 className="checkout-title mt-2">Pay with {providerLabel}</h1>
          <p className="checkout-subtitle mt-2">
            Order <strong>{orderLabel}</strong>
            {paymentId ? ` · ref ${paymentId.slice(0, 20)}` : ''}
          </p>

          {order ? (
            <p className="mt-4 text-lg font-black text-[#111111]">
              Amount due: {formatBDT(total)}
            </p>
          ) : null}

          <ol className="mt-6 space-y-3 text-sm font-semibold text-black/70 list-decimal list-inside">
            <li>Open your {providerLabel} app on the phone used at checkout.</li>
            <li>Send <strong>{formatBDT(total)}</strong> to SPLARO&apos;s merchant wallet.</li>
            <li>Use invoice <strong>{orderLabel}</strong> as the reference.</li>
            <li>Return here once payment is complete.</li>
          </ol>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              className="checkout-btn checkout-btn--primary"
              onClick={() => {
                const match =
                  order ??
                  loadOrders().find(
                    (item) => item.id === orderId || item.invoiceNumber === orderId,
                  )
                safeClientNavigate(router, buildOrderConfirmationPath(match ?? { id: orderId }))
              }}
            >
              I&apos;ve completed payment
            </button>
            <Link href="/checkout" className="checkout-btn checkout-btn--ghost">
              <ArrowLeft className="h-4 w-4" />
              Back to checkout
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

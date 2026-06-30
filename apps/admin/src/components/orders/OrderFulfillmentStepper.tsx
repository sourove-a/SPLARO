'use client'

import {
  CheckCircle2,
  Clock3,
  Package,
  PackageCheck,
  Truck,
  CircleCheck,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { cn } from '@/lib/utils/cn'

const FLOW_STEPS = [
  { status: 'PENDING', label: 'Pending', icon: Clock3 },
  { status: 'CONFIRMED', label: 'Confirmed', icon: CheckCircle2 },
  { status: 'PROCESSING', label: 'Processing', icon: Package },
  { status: 'PACKED', label: 'Packed', icon: PackageCheck },
  { status: 'SHIPPED', label: 'Shipped', icon: Truck },
  { status: 'DELIVERED', label: 'Delivered', icon: CircleCheck },
] as const

const NEXT_ACTIONS: Record<string, { label: string; next: string }> = {
  PENDING: { label: 'Confirm order', next: 'CONFIRMED' },
  CONFIRMED: { label: 'Start processing', next: 'PROCESSING' },
  PROCESSING: { label: 'Mark packed', next: 'PACKED' },
  PACKED: { label: 'Mark shipped', next: 'SHIPPED' },
  SHIPPED: { label: 'Mark delivered', next: 'DELIVERED' },
}

function normalizeStatus(raw: string): string {
  const upper = raw.toUpperCase()
  if (['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'COURIER_BOOKED', 'PICKED_UP'].includes(upper)) {
    return 'SHIPPED'
  }
  return upper
}

function stepIndex(status: string): number {
  const normalized = normalizeStatus(status)
  const idx = FLOW_STEPS.findIndex((s) => s.status === normalized)
  return idx >= 0 ? idx : 0
}

interface OrderFulfillmentStepperProps {
  status: string
  loading?: boolean
  onAdvance: (nextStatus: string, note: string) => void
  compact?: boolean
}

export function OrderFulfillmentStepper({
  status,
  loading,
  onAdvance,
  compact,
}: OrderFulfillmentStepperProps) {
  const normalized = normalizeStatus(status)
  const currentIdx = stepIndex(status)
  const isTerminal = normalized === 'DELIVERED' || normalized === 'CANCELLED' || normalized === 'REFUNDED'
  const next = NEXT_ACTIONS[normalized]

  if (normalized === 'CANCELLED' || normalized === 'REFUNDED') {
    return (
      <div className="order-flow order-flow--cancelled">
        <span className="order-flow__terminal">{normalized === 'CANCELLED' ? 'Order cancelled' : 'Order refunded'}</span>
      </div>
    )
  }

  return (
    <div className={cn('order-flow', compact && 'order-flow--compact')}>
      <ol className="order-flow__track" aria-label="Order fulfillment steps">
        {FLOW_STEPS.map((step, idx) => {
          const Icon = step.icon
          const done = idx < currentIdx || (isTerminal && idx <= currentIdx)
          const active = idx === currentIdx && !isTerminal
          return (
            <li
              key={step.status}
              className={cn(
                'order-flow__step',
                done && 'order-flow__step--done',
                active && 'order-flow__step--active',
              )}
            >
              <span className="order-flow__dot" aria-hidden>
                <Icon className="order-flow__icon" strokeWidth={1.75} />
              </span>
              <span className="order-flow__label">{step.label}</span>
              {idx < FLOW_STEPS.length - 1 ? <span className="order-flow__line" aria-hidden /> : null}
            </li>
          )
        })}
      </ol>

      {next && !isTerminal ? (
        <AdminButton
          variant="gold"
          loading={Boolean(loading)}
          className="order-flow__action"
          onClick={() => onAdvance(next.next, `${next.label} from admin`)}
        >
          {next.label}
        </AdminButton>
      ) : isTerminal ? (
        <p className="order-flow__done-msg">Order complete — delivered to customer.</p>
      ) : null}
    </div>
  )
}

export { normalizeStatus as normalizeOrderFlowStatus, NEXT_ACTIONS as ORDER_NEXT_ACTIONS }

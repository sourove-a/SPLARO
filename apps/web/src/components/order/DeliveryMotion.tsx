'use client'

import { motion, useReducedMotion } from '@/lib/motion/react'
import { Package, Truck } from 'lucide-react'
import type { DeliveryStage } from '@/lib/orders'
import {
  deliveryProgressPercent,
  deliveryStatusCaption,
  resolveDeliveryMilestones,
} from '@/lib/order/delivery-progress'
const SPRING = { type: 'spring' as const, stiffness: 420, damping: 32 }

interface DeliveryMotionProps {
  stage: DeliveryStage
}

export function DeliveryMotion({ stage }: DeliveryMotionProps) {
  const reducedMotion = useReducedMotion()
  const milestones = resolveDeliveryMilestones(stage)
  const progress = deliveryProgressPercent(stage) / 100
  const caption = deliveryStatusCaption(stage)

  if (reducedMotion) {
    return (
      <div className="delivery-motion delivery-motion--static" aria-label="Delivery progress">
        <Truck className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        <span>{caption}</span>
      </div>
    )
  }

  return (
    <div className="delivery-motion" aria-label="Delivery progress">
      <div className="delivery-motion__header">
        <span>Delivery progress</span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.35 }}
        >
          {caption}
        </motion.span>
      </div>

      <div className="delivery-motion__track">
        <div className="delivery-motion__rail" />
        <motion.div
          className="delivery-motion__fill"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progress }}
          transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: 'left center' }}
        />
        <motion.div
          className="delivery-motion__glow"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: progress, opacity: progress > 0 ? 1 : 0 }}
          transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: 'left center' }}
        />

        <motion.div
          className="delivery-motion__vehicle"
          initial={{ left: '0.5rem', opacity: 0, scale: 0.92 }}
          animate={{
            left: `calc(${Math.max(8, progress * 100)}% - 1.65rem)`,
            opacity: 1,
            scale: 1,
          }}
          transition={{
            left: { duration: 0.82, ease: [0.16, 1, 0.3, 1] },
            opacity: { duration: 0.3, ease: 'easeOut' },
            scale: SPRING,
          }}
        >
          <div className="delivery-motion__van">
            <Truck className="h-4 w-4" strokeWidth={2.2} />
            <span className="delivery-motion__parcel">
              <Package className="h-2.5 w-2.5" strokeWidth={2.4} />
            </span>
          </div>
          <span className="delivery-motion__wheel delivery-motion__wheel--left" />
          <span className="delivery-motion__wheel delivery-motion__wheel--right" />
        </motion.div>
      </div>

      <div className="delivery-motion__steps">
        {milestones.map((step, index) => (
          <motion.div
            key={step.label}
            className={`delivery-motion__step delivery-motion__step--${step.state}`}
            initial={{ opacity: 0.35, y: 4 }}
            animate={{
              opacity: step.state === 'pending' ? 0.42 : 1,
              y: 0,
            }}
            transition={{
              delay: 0.18 + index * 0.08,
              duration: 0.38,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <span className="delivery-motion__step-dot" />
            <span>{step.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

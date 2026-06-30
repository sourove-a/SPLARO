'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Package, Truck } from 'lucide-react'

const DRIVE_EASE = [0.22, 1, 0.36, 1] as const
const DRIVE_DURATION = 2.85

const milestones = [
  { label: 'Confirmed', delay: 0 },
  { label: 'Packed', delay: 0.42 },
  { label: 'On the way', delay: 0.88 },
] as const

export function DeliveryMotion() {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    return (
      <div className="delivery-motion delivery-motion--static" aria-hidden="true">
        <Truck className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        <span>Your order is on the way</span>
      </div>
    )
  }

  return (
    <div className="delivery-motion" aria-hidden="true">
      <div className="delivery-motion__header">
        <span>Delivery progress</span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: DRIVE_DURATION * 0.72, duration: 0.45 }}
        >
          Dispatching soon
        </motion.span>
      </div>

      <div className="delivery-motion__track">
        <div className="delivery-motion__rail" />
        <motion.div
          className="delivery-motion__fill"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: DRIVE_DURATION, ease: DRIVE_EASE }}
        />
        <motion.div
          className="delivery-motion__glow"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: DRIVE_DURATION, ease: DRIVE_EASE }}
        />

        <motion.div
          className="delivery-motion__vehicle"
          initial={{ left: '0.5rem', opacity: 0, scale: 0.92 }}
          animate={{ left: 'calc(100% - 3.35rem)', opacity: 1, scale: 1 }}
          transition={{
            left: { duration: DRIVE_DURATION, ease: DRIVE_EASE },
            opacity: { duration: 0.35, ease: 'easeOut' },
            scale: { duration: 0.5, ease: DRIVE_EASE },
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
          <span className="delivery-motion__dust" />
        </motion.div>
      </div>

      <div className="delivery-motion__steps">
        {milestones.map((step) => (
          <motion.div
            key={step.label}
            className="delivery-motion__step"
            initial={{ opacity: 0.28, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: DRIVE_DURATION * step.delay, duration: 0.42, ease: DRIVE_EASE }}
          >
            <span className="delivery-motion__step-dot" />
            <span>{step.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

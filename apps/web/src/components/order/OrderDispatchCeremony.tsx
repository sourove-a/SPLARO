'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Package } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import { displayOrderCode } from '@splaro/config'

export type DispatchStage = 'pack' | 'load' | 'drive' | 'confirm'

export interface OrderDispatchCeremonyProps {
  orderId: string
  invoiceNumber?: string | null | undefined
  customerName?: string | undefined
  onComplete: () => void
}

export const DISPATCH_SEEN_KEY = 'splaro-dispatch-seen'
export const DISPATCH_PENDING_KEY = 'splaro-dispatch-pending'

const STAGES = ['pack', 'load', 'drive', 'confirm'] as const

/** Snappy cinematic beat — total ~2s before confirm (was ~5s). */
const STAGE_MS = {
  pack: 650,
  load: 600,
  drive: 750,
} as const

const TOTAL_SCENE_MS = STAGE_MS.pack + STAGE_MS.load + STAGE_MS.drive

const STAGE_COPY: Record<DispatchStage, { eyebrow: string; title: string; subtitle: string }> = {
  pack: {
    eyebrow: 'Packing',
    title: 'Packing your order',
    subtitle: 'Sealed and ready for courier.',
  },
  load: {
    eyebrow: 'Loading',
    title: 'Handing to courier',
    subtitle: 'Parcel loaded into the van.',
  },
  drive: {
    eyebrow: 'Shipping',
    title: 'On the way',
    subtitle: 'Heading to your address.',
  },
  confirm: {
    eyebrow: 'Confirmed',
    title: 'Order confirmed',
    subtitle: 'You’re all set — continue to shipping details.',
  },
}

const STAGE_LABELS: Record<DispatchStage, string> = {
  pack: 'Pack',
  load: 'Load',
  drive: 'Ship',
  confirm: 'Done',
}

const EASE = [0.16, 1, 0.3, 1] as const

const SCENE_ENTER = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.98 },
  transition: { duration: 0.22, ease: EASE },
} as const

function sessionGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(key)
}

function sessionSet(key: string, value: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(key, value)
}

function sessionRemove(key: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(key)
}

export function markDispatchSeen(orderId: string) {
  sessionSet(DISPATCH_SEEN_KEY, orderId)
  if (sessionGet(DISPATCH_PENDING_KEY) === orderId) {
    sessionRemove(DISPATCH_PENDING_KEY)
  }
}

export function wasDispatchSeen(orderId: string): boolean {
  return sessionGet(DISPATCH_SEEN_KEY) === orderId
}

/** Set before leaving checkout for a payment gateway — confirmation plays the ceremony on return. */
export function markDispatchPending(orderId: string) {
  sessionSet(DISPATCH_PENDING_KEY, orderId)
}

export function isDispatchPending(orderId: string): boolean {
  return sessionGet(DISPATCH_PENDING_KEY) === orderId
}

function stageRank(stage: DispatchStage): number {
  return STAGES.indexOf(stage)
}

export function OrderDispatchCeremony({
  orderId,
  invoiceNumber,
  customerName,
  onComplete,
}: OrderDispatchCeremonyProps) {
  const reducedMotion = useReducedMotion()
  const [stage, setStage] = useState<DispatchStage>(reducedMotion ? 'confirm' : 'pack')
  const finishedRef = useRef(false)
  const orderCode = displayOrderCode(invoiceNumber ?? orderId, orderId)
  const firstName = customerName?.trim().split(/\s+/)[0] || 'there'
  const copy = STAGE_COPY[stage]
  const isConfirm = stage === 'confirm'
  const activeRank = stageRank(stage)
  const progress = ((activeRank + (isConfirm ? 1 : 0.45)) / STAGES.length) * 100

  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    markDispatchSeen(orderId)
    onComplete()
  }

  useEffect(() => {
    if (reducedMotion) {
      const t = window.setTimeout(() => markDispatchSeen(orderId), 40)
      return () => window.clearTimeout(t)
    }

    const timers = [
      window.setTimeout(() => setStage('load'), STAGE_MS.pack),
      window.setTimeout(() => setStage('drive'), STAGE_MS.pack + STAGE_MS.load),
      window.setTimeout(() => setStage('confirm'), TOTAL_SCENE_MS),
      window.setTimeout(() => markDispatchSeen(orderId), TOTAL_SCENE_MS + 20),
    ]

    return () => {
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [orderId, reducedMotion])

  return (
    <div
      className="order-dispatch"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-dispatch-title"
      data-stage={stage}
    >
      <div className="order-dispatch__aura" aria-hidden />
      <div className="order-dispatch__panel">
        <div className="order-dispatch__progress" aria-hidden>
          <motion.span
            className="order-dispatch__progress-fill"
            initial={false}
            animate={{ width: `${Math.min(100, progress)}%` }}
            transition={{ duration: 0.28, ease: EASE }}
          />
        </div>

        <div className="order-dispatch__stage-row" aria-hidden>
          {STAGES.map((key) => {
            const on = activeRank >= stageRank(key)
            const active = stage === key
            return (
              <span
                key={key}
                className={`order-dispatch__chip${on ? ' is-on' : ''}${active ? ' is-active' : ''}`}
              >
                {STAGE_LABELS[key]}
              </span>
            )
          })}
        </div>

        <div className="order-dispatch__scene" aria-hidden>
          <AnimatePresence mode="wait">
            {stage === 'pack' ? (
              <motion.div
                key="pack"
                className="order-dispatch__illus order-dispatch__illus--pack"
                {...SCENE_ENTER}
              >
                <span className="order-dispatch__table" />
                <span className="order-dispatch__tissue" />
                <span className="order-dispatch__product" />
                <span className="order-dispatch__box">
                  <span className="order-dispatch__box-lid" />
                  <span className="order-dispatch__box-body">
                    <Package className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="order-dispatch__seal" />
                </span>
                <span className="order-dispatch__spark order-dispatch__spark--a" />
                <span className="order-dispatch__spark order-dispatch__spark--b" />
              </motion.div>
            ) : null}

            {stage === 'load' ? (
              <motion.div
                key="load"
                className="order-dispatch__illus order-dispatch__illus--load"
                {...SCENE_ENTER}
              >
                <span className="order-dispatch__ground" />
                <span className="order-dispatch__courier">
                  <span className="order-dispatch__courier-arm" />
                </span>
                <motion.span
                  className="order-dispatch__parcel"
                  initial={{ x: -36, y: 8, opacity: 0.55, rotate: -6 }}
                  animate={{ x: 20, y: -6, opacity: 1, rotate: 0 }}
                  transition={{ duration: 0.55, ease: EASE }}
                >
                  <Package className="h-4 w-4" strokeWidth={2.2} />
                </motion.span>
                <span className="order-dispatch__van order-dispatch__van--parked">
                  <span className="order-dispatch__van-door" />
                  <span className="order-dispatch__van-cab" />
                  <span className="order-dispatch__van-bay" />
                  <span className="order-dispatch__wheel order-dispatch__wheel--l" />
                  <span className="order-dispatch__wheel order-dispatch__wheel--r" />
                </span>
              </motion.div>
            ) : null}

            {stage === 'drive' ? (
              <motion.div
                key="drive"
                className="order-dispatch__illus order-dispatch__illus--drive"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <span className="order-dispatch__skyline" />
                <span className="order-dispatch__road" />
                <span className="order-dispatch__dust order-dispatch__dust--1" />
                <span className="order-dispatch__dust order-dispatch__dust--2" />
                <motion.span
                  className="order-dispatch__van order-dispatch__van--drive"
                  initial={{ x: '-18%', opacity: 0.92 }}
                  animate={{ x: '118%', opacity: 1 }}
                  transition={{ duration: 0.7, ease: [0.22, 0.82, 0.28, 1] }}
                >
                  <span className="order-dispatch__van-cab" />
                  <span className="order-dispatch__van-bay">
                    <Package className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </span>
                  <span className="order-dispatch__wheel order-dispatch__wheel--l" />
                  <span className="order-dispatch__wheel order-dispatch__wheel--r" />
                </motion.span>
              </motion.div>
            ) : null}

            {isConfirm ? (
              <motion.div
                key="confirm"
                className="order-dispatch__illus order-dispatch__illus--confirm"
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              >
                <span className="order-dispatch__burst" />
                <span className="order-dispatch__confirm-ring order-dispatch__confirm-ring--outer" />
                <span className="order-dispatch__confirm-ring" />
                <motion.span
                  className="order-dispatch__confirm-icon"
                  initial={{ scale: 0.55, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 20 }}
                >
                  <Check className="h-7 w-7" strokeWidth={2.8} />
                </motion.span>
                <span className="order-dispatch__confetti order-dispatch__confetti--1" />
                <span className="order-dispatch__confetti order-dispatch__confetti--2" />
                <span className="order-dispatch__confetti order-dispatch__confetti--3" />
                <span className="order-dispatch__confetti order-dispatch__confetti--4" />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            className="order-dispatch__copy"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <p
              className={`order-dispatch__eyebrow${isConfirm ? ' order-dispatch__eyebrow--success' : ''}`}
              id="order-dispatch-title"
            >
              {isConfirm ? 'Success' : copy.eyebrow}
            </p>
            <h2 className="order-dispatch__title">
              {isConfirm ? `Thank you, ${firstName}!` : copy.title}
            </h2>
            <p className="order-dispatch__subtitle">
              {isConfirm
                ? `Order ${orderCode} is confirmed. Continue for shipping & tracking.`
                : copy.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>

        <motion.div
          className={`order-dispatch__popup${isConfirm ? '' : ' order-dispatch__popup--live'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          {isConfirm ? (
            <div className="order-dispatch__popup-badge">Order confirmed</div>
          ) : null}
          <div className="order-dispatch__popup-row">
            <span>Order</span>
            <strong>{orderCode}</strong>
          </div>
          <p className="order-dispatch__popup-note">
            {isConfirm
              ? 'Shipping details, invoice, and tracking are ready on the next screen.'
              : 'Order placed — you can continue anytime. Animation finishes in a moment.'}
          </p>
          <button type="button" className="order-dispatch__cta" onClick={finish}>
            <span>Continue to shipping</span>
            <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden />
          </button>
        </motion.div>
      </div>
    </div>
  )
}

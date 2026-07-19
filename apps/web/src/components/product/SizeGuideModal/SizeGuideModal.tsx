'use client'

import '@/styles/pages/pdp.css'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils/cn'
import {
  formatMeasure,
  getSizeGuideChart,
  resolveSizeGuideTitle,
  type SizeGuideUnit,
} from '@/lib/content/size-guide'
import { useDialogFocusTrap } from '@/hooks/useDialogFocusTrap'
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock'

type SizeGuideModalProps = {
  open: boolean
  onClose: () => void
  category?: string | null
  categorySlug?: string | null
  productName?: string | null
}

export function SizeGuideModal({
  open,
  onClose,
  category,
  categorySlug,
  productName,
}: SizeGuideModalProps) {
  const reducedMotion = useReducedMotion()
  const titleId = useId()
  const chart = getSizeGuideChart(category, categorySlug)
  const chartTitle = resolveSizeGuideTitle(category, categorySlug)
  const [unit, setUnit] = useState<SizeGuideUnit>('cm')
  const [mounted, setMounted] = useState(false)
  const onCloseRef = useRef(onClose)
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogFocusTrap(open, panelRef, onClose)
  useOverlayScrollLock(open)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) setUnit('cm')
  }, [open, chart.key])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="sg-modal"
          role="presentation"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          {...(reducedMotion ? {} : { exit: { opacity: 0 } })}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            className="sg-modal__backdrop"
            aria-label="Close size guide"
            onClick={() => onCloseRef.current()}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="sg-modal__panel"
            data-lenis-prevent
            initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            {...(reducedMotion
              ? {}
              : { exit: { opacity: 0, y: 12, scale: 0.98 } })}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="sg-modal__header">
              <div className="sg-modal__heading">
                <p className="sg-modal__brand">SPLARO</p>
                <h2 id={titleId} className="sg-modal__title">
                  {chartTitle}
                </h2>
                {productName ? (
                  <p className="sg-modal__product">{productName}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="sg-modal__close"
                aria-label="Close"
                onClick={() => onCloseRef.current()}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </header>

            <div className="sg-modal__toolbar">
              <p className="sg-modal__fit">{chart.fit}</p>
              <div className="sg-modal__units" role="group" aria-label="Measurement unit">
                {(['in', 'cm'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={unit === option}
                    className={cn(
                      'sg-modal__unit',
                      unit === option && 'sg-modal__unit--active',
                    )}
                    onClick={() => setUnit(option)}
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="sg-modal__table-wrap">
              {chart.kind === 'footwear' ? (
                <table className="sg-modal__table">
                  <thead>
                    <tr>
                      <th scope="row">EU</th>
                      {chart.sizes.map((size) => (
                        <th key={size} scope="col">
                          {size}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Foot ({unit.toUpperCase()})</th>
                      {chart.footLengthCm.map((cm, index) => (
                        <td key={`${chart.sizes[index]}-${cm}`}>
                          {formatMeasure(cm, unit)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              ) : (
                <table className="sg-modal__table">
                  <thead>
                    <tr>
                      <th scope="col">Measurement</th>
                      {chart.sizes.map((size) => (
                        <th key={size} scope="col">
                          {size}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chart.measurements.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">
                          {row.label} ({unit.toUpperCase()})
                        </th>
                        {row.valuesCm.map((cm, index) => (
                          <td key={`${row.label}-${chart.sizes[index]}`}>
                            {formatMeasure(cm, unit)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <p className="sg-modal__note">
              True to size · between sizes, choose the larger
            </p>

            <Link
              href="/size-guide"
              className="sg-modal__all"
              onClick={() => onCloseRef.current()}
            >
              Check all size charts
            </Link>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

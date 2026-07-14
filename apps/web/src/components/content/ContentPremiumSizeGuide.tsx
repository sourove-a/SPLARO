'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'

import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import {
  SIZE_GUIDE_ORDER,
  formatMeasure,
  sizeGuideCharts,
  type SizeGuideKey,
  type SizeGuideUnit,
} from '@/lib/content/size-guide'
import { whatsAppHref, resolveWhatsAppNumber } from '@/lib/storefront/contact'
import { cn } from '@/lib/utils/cn'

const MEASURE_TIPS = [
  { id: 'bust', label: 'Bust', tip: 'Fullest point' },
  { id: 'waist', label: 'Waist', tip: 'Natural line' },
  { id: 'hip', label: 'Hip', tip: 'Fullest point' },
  { id: 'foot', label: 'Foot', tip: 'Heel to toe' },
] as const

type ContentPremiumSizeGuideProps = {
  title: string
  description: string
  badge?: string
}

export function ContentPremiumSizeGuide({
  title,
  description,
  badge = 'Fit · Atelier',
}: ContentPremiumSizeGuideProps) {
  const reducedMotion = useReducedMotion()
  const settings = useStorefrontSettings()
  const [activeChart, setActiveChart] = useState<SizeGuideKey>('women')
  const [unit, setUnit] = useState<SizeGuideUnit>('cm')

  const liveChart = sizeGuideCharts[activeChart]
  const whatsappNumber = resolveWhatsAppNumber(settings)
  const whatsappLink = useMemo(
    () =>
      whatsAppHref(
        whatsappNumber,
        'Hello SPLARO — I need a size recommendation. My measurements are:',
      ),
    [whatsappNumber],
  )
  const hasWhatsApp = whatsappNumber.replace(/[^0-9]/g, '').length >= 10

  return (
    <div className="content-page size-premium account-shell">
      <div className="account-shell__ambient" aria-hidden="true" />
      <div className="size-premium__mesh" aria-hidden="true" />

      <div className="size-premium__layout">
        <motion.section
          className="size-premium__hero"
          initial={reducedMotion ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="size-premium__hero-glow" aria-hidden="true" />
          <div className="size-premium__hero-grain" aria-hidden="true" />

          <Link href="/" className="size-premium__back">
            <ArrowLeft className="h-4 w-4" strokeWidth={2.1} />
            Home
          </Link>

          <div className="size-premium__crest" aria-hidden="true">
            <span className="size-premium__crest-ring size-premium__crest-ring--outer" />
            <span className="size-premium__crest-ring size-premium__crest-ring--inner" />
            <motion.div
              className="size-premium__crest-logo"
              {...(reducedMotion
                ? {}
                : {
                    animate: {
                      scale: [1, 1.035, 1],
                      filter: [
                        'drop-shadow(0 0 0 rgba(201,184,150,0))',
                        'drop-shadow(0 0 18px rgba(201,184,150,0.45))',
                        'drop-shadow(0 0 0 rgba(201,184,150,0))',
                      ],
                    },
                    transition: {
                      duration: 4.8,
                      repeat: Infinity,
                      ease: 'easeInOut' as const,
                    },
                  })}
            >
              <Image
                src="/images/logo/splaro-logo-white-premium.png"
                alt=""
                width={220}
                height={117}
                priority
                quality={100}
                unoptimized
                className="size-premium__crest-img"
              />
            </motion.div>
          </div>

          <p className="size-premium__badge">{badge}</p>
          <h1 className="size-premium__title">{title}</h1>
          <p className="size-premium__lede">{description}</p>
        </motion.section>

        <motion.div
          className="size-premium__tips"
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: reducedMotion ? 0 : 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          {MEASURE_TIPS.map((tip, index) => (
            <motion.div
              key={tip.id}
              className="size-premium__tip"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: reducedMotion ? 0 : 0.16 + index * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <span className="size-premium__tip-mark" aria-hidden="true">
                {tip.label.charAt(0)}
              </span>
              <span className="size-premium__tip-copy">
                <strong>{tip.label}</strong>
                <span>{tip.tip}</span>
              </span>
            </motion.div>
          ))}
        </motion.div>

        <motion.section
          className="size-premium__chart-panel"
          initial={reducedMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: reducedMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="size-premium__tabs size-premium__tabs--four" role="tablist" aria-label="Size charts">
            {SIZE_GUIDE_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeChart === key}
                className={cn(
                  'size-premium__tab',
                  activeChart === key && 'size-premium__tab--active',
                )}
                onClick={() => setActiveChart(key)}
              >
                {sizeGuideCharts[key].title.replace("Women's ", '')}
              </button>
            ))}
          </div>

          <div className="size-premium__unit-row">
            <p className="size-premium__fit">{liveChart.fit}</p>
            <div className="size-premium__units" role="group" aria-label="Measurement unit">
              {(['in', 'cm'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={unit === option}
                  className={cn(
                    'size-premium__unit',
                    unit === option && 'size-premium__unit--active',
                  )}
                  onClick={() => setUnit(option)}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${activeChart}-${unit}`}
              className="size-premium__table-wrap"
              role="tabpanel"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              {...(reducedMotion ? {} : { exit: { opacity: 0, y: -8 } })}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              {liveChart.kind === 'footwear' ? (
                <table className="size-premium__table">
                  <thead>
                    <tr>
                      <th>EU</th>
                      {liveChart.sizes.map((size) => (
                        <th key={size}>{size}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="size-premium__size-cell">Foot ({unit.toUpperCase()})</td>
                      {liveChart.footLengthCm.map((cm, index) => (
                        <td key={`${liveChart.sizes[index]}-${cm}`}>
                          {formatMeasure(cm, unit)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              ) : (
                <table className="size-premium__table">
                  <thead>
                    <tr>
                      <th>Measurement</th>
                      {liveChart.sizes.map((size) => (
                        <th key={size}>{size}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liveChart.measurements.map((row) => (
                      <tr key={row.label}>
                        <td className="size-premium__size-cell">
                          {row.label} ({unit.toUpperCase()})
                        </td>
                        {row.valuesCm.map((cm, index) => (
                          <td key={`${row.label}-${liveChart.sizes[index]}`}>
                            {formatMeasure(cm, unit)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </motion.div>
          </AnimatePresence>

          <p className="size-premium__note">True to size · between sizes, choose the larger</p>
        </motion.section>

        {hasWhatsApp ? (
          <motion.a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="size-premium__ask"
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reducedMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="size-premium__ask-icon" aria-hidden="true">
              <MessageCircle className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="size-premium__ask-copy">
              <strong>Need a stylist?</strong>
              <span>WhatsApp your measurements</span>
            </span>
          </motion.a>
        ) : null}
      </div>
    </div>
  )
}

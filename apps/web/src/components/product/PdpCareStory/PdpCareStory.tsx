'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Ban,
  Droplets,
  Shirt,
  Sparkles,
  SunMedium,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import { cn } from '@/lib/utils/cn'

export type PdpCareLine = {
  icon: LucideIcon
  text: string
}

type CareBeat = 'wash' | 'guard' | 'dry'

type PdpCareStoryProps = {
  active: boolean
  lines: PdpCareLine[]
}

const BEAT_MS = 1100
const BEATS: CareBeat[] = ['wash', 'guard', 'dry']

const BEAT_META: Record<CareBeat, { label: string; hint: string }> = {
  wash: { label: 'Wash', hint: 'Gentle clean' },
  guard: { label: 'Guard', hint: 'Protect colour' },
  dry: { label: 'Dry', hint: 'Shade rest' },
}

function iconForCareStep(text: string): LucideIcon {
  const t = text.toLowerCase()
  if (/bleach|whitener/.test(t)) return Ban
  if (/dry|shade|hang|air/.test(t)) return SunMedium
  if (/iron|steam|press/.test(t)) return Wind
  if (/hand|soft|gentle|care|fold/.test(t)) return Sparkles
  if (/wash|water|rinse|cold|machine|laundry/.test(t)) return Droplets
  return Shirt
}

/** Split “A · B · C” care copy into premium step lines. */
export function splitCareInstructionLines(raw: string): PdpCareLine[] {
  const parts = raw
    .split(/[·•|\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  const steps = parts.length > 0 ? parts : [raw.trim()].filter(Boolean)
  return steps.map((text) => ({ icon: iconForCareStep(text), text }))
}

/**
 * PDP Care accordion — quiet luxury care ritual when opened.
 * Visual story: wash droplets → protect glow → shade dry. Lines stay fully visible.
 */
export function PdpCareStory({ active, lines }: PdpCareStoryProps) {
  const reducedMotion = useReducedMotion()
  const [playKey, setPlayKey] = useState(0)
  const [beat, setBeat] = useState<CareBeat>('wash')

  const displayLines = useMemo(() => {
    if (lines.length > 1) return lines
    if (lines.length === 1) return splitCareInstructionLines(lines[0]!.text)
    return lines
  }, [lines])

  useEffect(() => {
    if (!active || reducedMotion) {
      setBeat('wash')
      return
    }
    setPlayKey((k) => k + 1)
    setBeat('wash')
    const timers = [
      window.setTimeout(() => setBeat('guard'), BEAT_MS),
      window.setTimeout(() => setBeat('dry'), BEAT_MS * 2),
    ]
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [active, reducedMotion])

  return (
    <div className={cn('pp-care-story', active && 'pp-care-story--active')} data-beat={beat}>
      {!reducedMotion ? (
        <div
          className={cn('pp-care-story__scene', !active && 'pp-care-story__scene--idle')}
          aria-hidden
        >
          {active ? (
            <div key={playKey} className="pp-care-story__scene-play">
              <span className="pp-care-story__glow" />
              <span className="pp-care-story__shelf" />

              <span className="pp-care-story__garment">
                <span className="pp-care-story__garment-body" />
                <span className="pp-care-story__garment-sleeve pp-care-story__garment-sleeve--l" />
                <span className="pp-care-story__garment-sleeve pp-care-story__garment-sleeve--r" />
                <span className="pp-care-story__garment-neck" />
              </span>

              <AnimatePresence mode="wait">
                {beat === 'wash' ? (
                  <motion.div
                    key="wash"
                    className="pp-care-story__layer pp-care-story__layer--wash"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                  >
                    <span className="pp-care-story__drop pp-care-story__drop--1" />
                    <span className="pp-care-story__drop pp-care-story__drop--2" />
                    <span className="pp-care-story__drop pp-care-story__drop--3" />
                    <span className="pp-care-story__ripple" />
                  </motion.div>
                ) : null}

                {beat === 'guard' ? (
                  <motion.div
                    key="guard"
                    className="pp-care-story__layer pp-care-story__layer--guard"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.32 }}
                  >
                    <span className="pp-care-story__shield" />
                    <span className="pp-care-story__spark pp-care-story__spark--a" />
                    <span className="pp-care-story__spark pp-care-story__spark--b" />
                    <Ban className="pp-care-story__ban" strokeWidth={2.2} />
                  </motion.div>
                ) : null}

                {beat === 'dry' ? (
                  <motion.div
                    key="dry"
                    className="pp-care-story__layer pp-care-story__layer--dry"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.32 }}
                  >
                    <span className="pp-care-story__sun" />
                    <span className="pp-care-story__shade" />
                    <span className="pp-care-story__breeze pp-care-story__breeze--1" />
                    <span className="pp-care-story__breeze pp-care-story__breeze--2" />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="pp-care-story__beats">
                {BEATS.map((key) => (
                  <span
                    key={key}
                    className={cn(
                      'pp-care-story__chip',
                      beat === key && 'is-active',
                      BEATS.indexOf(beat) > BEATS.indexOf(key) && 'is-done',
                    )}
                  >
                    {BEAT_META[key].label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {active ? (
        <p className="pp-care-story__hint" aria-live="polite">
          {BEAT_META[beat].hint}
        </p>
      ) : null}

      <ul className="pp-accordion__list pp-care-story__list">
        {displayLines.map((line) => {
          const LineIcon = line.icon
          return (
            <li key={line.text} className="pp-accordion__item">
              <LineIcon className="pp-accordion__item-icon" strokeWidth={1.65} aria-hidden />
              <span>{line.text}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

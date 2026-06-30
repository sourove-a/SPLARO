'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, '0')
}

function calcTimeLeft(target: Date): TimeLeft {
  const diff = Math.max(0, target.getTime() - Date.now())
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

function FlipDigit({ value }: { value: string }) {
  const [display, setDisplay] = useState(value)
  const [next, setNext] = useState<string | null>(null)
  const [flipping, setFlipping] = useState(false)
  const prevRef = useRef(value)

  useEffect(() => {
    if (value === prevRef.current) return
    setNext(value)
    setFlipping(true)
    prevRef.current = value

    const timer = window.setTimeout(() => {
      setDisplay(value)
      setNext(null)
      setFlipping(false)
    }, 520)

    return () => window.clearTimeout(timer)
  }, [value])

  return (
    <div className={`maint-flip-digit${flipping ? ' is-flipping' : ''}`} aria-hidden>
      <div className="maint-flip-digit__card">
        <span className="maint-flip-digit__top">{display}</span>
        <span className="maint-flip-digit__bottom">{flipping && next ? next : display}</span>
        {flipping && next && (
          <span className="maint-flip-digit__flip-top" aria-hidden>
            {display}
          </span>
        )}
        <span className="maint-flip-digit__shine" />
        <span className="maint-flip-digit__hinge" aria-hidden />
      </div>
    </div>
  )
}

function FlipGroup({ label, value }: { label: string; value: string }) {
  const digits = value.split('')

  return (
    <div className="maint-flip-group">
      <div className="maint-flip-group__digits">
        {digits.map((digit, i) => (
          <FlipDigit key={`${label}-${i}`} value={digit} />
        ))}
      </div>
      <p className="maint-flip-group__label">{label}</p>
    </div>
  )
}

export function FlipCountdown({ targetIso }: { targetIso: string }) {
  const target = useMemo(() => new Date(targetIso), [targetIso])
  const [time, setTime] = useState<TimeLeft>(() => calcTimeLeft(target))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const tick = () => setTime(calcTimeLeft(target))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [target])

  if (!mounted) {
    return <div className="maint-countdown maint-countdown--skeleton" aria-hidden />
  }

  const daysStr = time.days > 99 ? String(time.days) : pad2(time.days)

  return (
    <div className="maint-countdown" role="timer" aria-live="polite">
      <FlipGroup label="Days" value={daysStr} />
      <FlipGroup label="Hours" value={pad2(time.hours)} />
      <FlipGroup label="Minutes" value={pad2(time.minutes)} />
      <FlipGroup label="Seconds" value={pad2(time.seconds)} />
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { MotionConfig } from '@/lib/motion/react'
import { circularOffset, wrapIndex } from './deck-loop'
import type { StoryDeckCard } from './types'
import { StoryCard } from './StoryCard'

/** Ignore rapid next/prev while the spring is still settling — prevents stacked jumps. */
const STEP_LOCK_MS = 380

interface StoryDeckProps {
  cards: StoryDeckCard[]
  activeIndex: number
  onChange: (index: number) => void
  onReadActive: () => void
}

export function StoryDeck({ cards, activeIndex, onChange, onReadActive }: StoryDeckProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; active: boolean } | null>(null)
  const didDragRef = useRef(false)
  const wheelLock = useRef(0)
  const stepLock = useRef(0)
  const count = cards.length

  const go = useCallback(
    (next: number) => {
      if (count === 0) return
      const now = Date.now()
      if (now - stepLock.current < STEP_LOCK_MS) return
      const wrapped = wrapIndex(next, count)
      if (wrapped === activeIndex) return
      stepLock.current = now
      onChange(wrapped)
    },
    [activeIndex, count, onChange],
  )

  useEffect(() => {
    const el = stageRef.current
    if (!el) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        go(activeIndex - 1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        go(activeIndex + 1)
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onReadActive()
      }
    }

    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, go, onReadActive])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      const wantsHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      if (!wantsHorizontal) return
      const now = Date.now()
      if (now - wheelLock.current < 520) return
      const delta = event.deltaX
      if (Math.abs(delta) < 18) return
      event.preventDefault()
      wheelLock.current = now
      go(activeIndex + (delta > 0 ? 1 : -1))
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [activeIndex, go])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    didDragRef.current = false
    dragRef.current = { startX: event.clientX, active: true }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag?.active) return
    if (Math.abs(event.clientX - drag.startX) > 12) {
      didDragRef.current = true
    }
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag?.active || !didDragRef.current) return
    const dx = event.clientX - drag.startX
    if (Math.abs(dx) < 48) return
    go(activeIndex + (dx < 0 ? 1 : -1))
  }

  const onPointerCancel = () => {
    dragRef.current = null
  }

  const handleRead = () => {
    if (didDragRef.current) return
    onReadActive()
  }

  const handleActivate = (index: number) => {
    if (didDragRef.current) return
    go(index)
  }

  return (
    // Essential deck slide — keep motion even when Windows OS sets prefers-reduced-motion
    // (otherwise next/prev hard-cuts and feels like a jump).
    <MotionConfig reducedMotion="never">
      <div
        ref={stageRef}
        className="home-story-deck__stage"
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label="SPLARO story cards"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div className="home-story-deck__rail">
          {/* Keep every card mounted — circular seam teleports stay opacity:0 (no pop). */}
          {cards.map((card, index) => {
            const offset = circularOffset(index, activeIndex, count)
            return (
              <StoryCard
                key={card.id}
                card={card}
                active={index === activeIndex}
                offset={offset}
                onActivate={() => handleActivate(index)}
                onRead={handleRead}
              />
            )
          })}
        </div>
      </div>
    </MotionConfig>
  )
}

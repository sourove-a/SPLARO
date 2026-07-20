'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { MotionConfig } from '@/lib/motion/react'
import { circularOffset, wrapIndex } from './deck-loop'
import type { StoryDeckCard } from './types'
import { StoryCard } from './StoryCard'

/** Ignore rapid next/prev while the slide is still settling — prevents stacked jumps. */
const STEP_LOCK_MS = 720
const DRAG_ACTIVATE_PX = 10
const DRAG_COMMIT_PX = 56
const DRAG_COMMIT_VELOCITY = 0.45

interface StoryDeckProps {
  cards: StoryDeckCard[]
  activeIndex: number
  onChange: (index: number) => void
  onReadActive: () => void
  /** Section in viewport — pause off-screen GPU work without unmounting cards. */
  sectionVisible?: boolean
}

export function StoryDeck({
  cards,
  activeIndex,
  onChange,
  onReadActive,
  sectionVisible = true,
}: StoryDeckProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    startX: number
    lastX: number
    lastT: number
    velocity: number
    active: boolean
    pointerId: number
  } | null>(null)
  const didDragRef = useRef(false)
  const wheelLock = useRef(0)
  const stepLock = useRef(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
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

  const endDrag = useCallback(
    (clientX: number) => {
      const drag = dragRef.current
      dragRef.current = null
      setDragging(false)

      if (!drag?.active) {
        setDragX(0)
        return
      }

      const dx = clientX - drag.startX
      const committed =
        didDragRef.current &&
        (Math.abs(dx) >= DRAG_COMMIT_PX || Math.abs(drag.velocity) >= DRAG_COMMIT_VELOCITY)

      if (committed) {
        const direction =
          Math.abs(dx) >= DRAG_COMMIT_PX
            ? dx < 0
              ? 1
              : -1
            : drag.velocity < 0
              ? 1
              : -1
        setDragX(0)
        go(activeIndex + direction)
        return
      }

      // Snap back smoothly
      setDragX(0)
    },
    [activeIndex, go],
  )

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    didDragRef.current = false
    const now = performance.now()
    dragRef.current = {
      startX: event.clientX,
      lastX: event.clientX,
      lastT: now,
      velocity: 0,
      active: true,
      pointerId: event.pointerId,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* ignore — some browsers throw if already captured */
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag?.active) return

    const now = performance.now()
    const dt = Math.max(now - drag.lastT, 1)
    const instantV = (event.clientX - drag.lastX) / dt
    drag.velocity = drag.velocity * 0.65 + instantV * 0.35
    drag.lastX = event.clientX
    drag.lastT = now

    const dx = event.clientX - drag.startX
    if (!didDragRef.current && Math.abs(dx) > DRAG_ACTIVATE_PX) {
      didDragRef.current = true
      setDragging(true)
    }
    if (!didDragRef.current) return

    // Rubber-band slightly past one card width so the deck feels soft
    const maxPull = 220
    const rubber =
      Math.abs(dx) > maxPull
        ? Math.sign(dx) * (maxPull + (Math.abs(dx) - maxPull) * 0.28)
        : dx
    setDragX(rubber)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (drag) {
      try {
        event.currentTarget.releasePointerCapture(drag.pointerId)
      } catch {
        /* ignore */
      }
    }
    endDrag(event.clientX)
  }

  const onPointerCancel = () => {
    dragRef.current = null
    setDragging(false)
    setDragX(0)
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
    <MotionConfig reducedMotion="never">
      <div
        ref={stageRef}
        className="home-story-deck__stage"
        data-dragging={dragging ? 'true' : 'false'}
        data-section-visible={sectionVisible ? 'true' : 'false'}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label="SPLARO story cards"
        onPointerDown={sectionVisible ? onPointerDown : undefined}
        onPointerMove={sectionVisible ? onPointerMove : undefined}
        onPointerUp={sectionVisible ? onPointerUp : undefined}
        onPointerCancel={sectionVisible ? onPointerCancel : undefined}
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
                dragX={sectionVisible ? dragX : 0}
                dragging={sectionVisible && dragging}
                paused={!sectionVisible}
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

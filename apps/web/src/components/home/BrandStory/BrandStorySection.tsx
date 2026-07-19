'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { wrapIndex } from './deck-loop'
import { buildStoryDeckCards } from './story-cards'
import { StoryBackground } from './StoryBackground'
import { StoryDeck } from './StoryDeck'
import { StoryExpandPanel } from './StoryExpandPanel'
import { StoryNav } from './StoryNav'
import type { BrandStorySectionProps } from './types'

/** Ignore rapid next/prev while the spring is settling — prevents stacked jumps. */
const STEP_LOCK_MS = 380

export function BrandStorySection({ story, reviews }: BrandStorySectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const stepLockRef = useRef(0)
  const cards = useMemo(() => buildStoryDeckCards(story, reviews), [story, reviews])
  const [activeIndex, setActiveIndex] = useState(() =>
    cards.length > 2 ? Math.floor(cards.length / 2) : 0,
  )
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(false)

  const safeIndex = wrapIndex(activeIndex, Math.max(cards.length, 1))
  const activeCard = cards[safeIndex]

  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(Boolean(entry?.isIntersecting))
      },
      { rootMargin: '120px 0px', threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (!activeCard || cards.length === 0) return null

  const step = (delta: number) => {
    const now = Date.now()
    if (now - stepLockRef.current < STEP_LOCK_MS) return
    stepLockRef.current = now
    setExpanded(false)
    setActiveIndex(wrapIndex(safeIndex + delta, cards.length))
  }

  const selectIndex = (index: number) => {
    const wrapped = wrapIndex(index, cards.length)
    if (wrapped === safeIndex) return
    const now = Date.now()
    if (now - stepLockRef.current < STEP_LOCK_MS) return
    stepLockRef.current = now
    setExpanded(false)
    setActiveIndex(wrapped)
  }

  return (
    <section
      ref={sectionRef}
      className="home-story-deck"
      aria-labelledby="home-story-deck-title"
      data-active={activeCard.id}
      data-loop="true"
      data-story-visible={visible ? 'true' : 'false'}
    >
      <StoryBackground activeIndex={safeIndex} cardCount={cards.length} />

      <div className="home-story-deck__inner">
        <header className="home-story-deck__head">
          <p className="home-story-deck__eyebrow">Discover</p>
          <h2 id="home-story-deck-title" className="home-story-deck__title">
            Our Story
          </h2>
          <p className="sr-only" aria-live="polite">
            {activeCard.title}
          </p>
        </header>

        <StoryDeck
          cards={cards}
          activeIndex={safeIndex}
          onChange={selectIndex}
          onReadActive={() => setExpanded((v) => !v)}
        />

        <StoryNav
          activeIndex={safeIndex}
          count={cards.length}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
        />

        <StoryExpandPanel
          activeId={activeCard.id}
          expanded={expanded}
          story={story}
          reviews={reviews}
          detail={activeCard.detail}
        />
      </div>
    </section>
  )
}

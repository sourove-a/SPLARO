'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { wrapIndex } from './deck-loop'
import { buildStoryDeckCards } from './story-cards'
import { StoryBackground } from './StoryBackground'
import { StoryDeck } from './StoryDeck'
import { StoryExpandPanel } from './StoryExpandPanel'
import { StoryNav } from './StoryNav'
import type { BrandStorySectionProps } from './types'
import { cn } from '@/lib/utils/cn'

/** Ignore rapid next/prev while the slide is settling — prevents stacked jumps. */
/** Short lock — snappy deck clicks without mid-tween stack. */
const STEP_LOCK_MS = 280

export function BrandStorySection({ story, reviews }: BrandStorySectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const stepLockRef = useRef(0)
  const cards = useMemo(() => buildStoryDeckCards(story, reviews), [story, reviews])
  const [activeIndex, setActiveIndex] = useState(() =>
    cards.length > 2 ? Math.floor(cards.length / 2) : 0,
  )
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(false)
  /** Discover / Our Story accordion — closed until user opens (mobile + desktop). */
  const [panelOpen, setPanelOpen] = useState(false)

  const safeIndex = wrapIndex(activeIndex, Math.max(cards.length, 1))
  const activeCard = cards[safeIndex]
  const deckLive = visible && panelOpen

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
      data-panel-open={panelOpen ? 'true' : 'false'}
    >
      <StoryBackground activeIndex={safeIndex} cardCount={cards.length} />

      <div className="home-story-deck__inner">
        <div className="home-story-deck__head">
          <button
            type="button"
            className={cn('home-story-deck__drop', panelOpen && 'is-open')}
            onClick={() => setPanelOpen((value) => !value)}
            aria-expanded={panelOpen}
            aria-controls="home-story-deck-panel"
          >
            <span className="home-story-deck__drop-copy">
              <span className="home-story-deck__eyebrow">Discover</span>
              <span id="home-story-deck-title" className="home-story-deck__title">
                Our Story
              </span>
            </span>
            <span className="home-story-deck__drop-chevron" aria-hidden>
              <ChevronDown strokeWidth={2} />
            </span>
          </button>
          <p className="sr-only" aria-live="polite">
            {activeCard.title}
          </p>
        </div>

        <div id="home-story-deck-panel" className="home-story-deck__drop-panel">
          <StoryDeck
            cards={cards}
            activeIndex={safeIndex}
            onChange={selectIndex}
            onReadActive={() => setExpanded((v) => !v)}
            sectionVisible={deckLive}
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
      </div>
    </section>
  )
}

'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Gem, Heart, Leaf, Sparkles, Sprout, Star, type LucideIcon } from 'lucide-react'
import type { OurStoryConfig, StoryPillarIcon } from '@/lib/storefront/homepage-defaults'
import { visiblePillars } from '@/lib/storefront/homepage-defaults'
import { cn } from '@/lib/utils/cn'

const PANEL_ID = 'splaro-story-pillars-panel'

const PILLAR_ICONS: Record<StoryPillarIcon, LucideIcon> = {
  sprout: Sprout,
  leaf: Leaf,
  gem: Gem,
  star: Star,
  heart: Heart,
  sparkles: Sparkles,
}

interface StoryPillarsDropdownProps {
  story: OurStoryConfig
  label?: string
}

function collapsedHint(pillars: OurStoryConfig['pillars']): string {
  const titles = pillars.map((p) => p.title).filter(Boolean)
  if (titles.length === 0) return 'Our craft, materials, and design philosophy'
  if (titles.length <= 2) return titles.join(' · ')
  return `${titles.slice(0, 2).join(' · ')} +${titles.length - 2}`
}

export function StoryPillarsDropdown({
  story,
  label = 'What we stand for',
}: StoryPillarsDropdownProps) {
  const [open, setOpen] = useState(true)
  const pillars = visiblePillars(story)
  const hasContent = pillars.length > 0 || Boolean(story.quote?.trim())

  if (!hasContent) return null

  return (
    <div className={cn('story-readmore story-pillars-dropdown', open && 'story-readmore--open')}>
      {!open ? (
        <p className="story-readmore__teaser story-pillars-dropdown__teaser">
          {story.quote ? `“${story.quote}”` : collapsedHint(pillars)}
        </p>
      ) : null}

      <button
        type="button"
        className="story-readmore__trigger"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="story-readmore__label">{open ? 'Show less' : label}</span>
        <span className="story-readmore__chevron" aria-hidden>
          <ChevronDown strokeWidth={2.2} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={PANEL_ID}
            className="story-readmore__panel story-pillars-dropdown__panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="story-pillars-dropdown__body">
              {pillars.length ? (
                <div className="story-pillars story-pillars-dropdown__grid">
                  {pillars.map((pillar, index) => {
                    const Icon = PILLAR_ICONS[pillar.icon] ?? Star
                    return (
                      <motion.article
                        key={pillar.id}
                        className="story-pillar"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <div className="story-pillar__sheen" aria-hidden />
                        <Icon className="story-pillar__icon" strokeWidth={1.6} />
                        <div className="story-pillar__rule" aria-hidden />
                        <h3 className="story-pillar__title">{pillar.title}</h3>
                        <p className="story-pillar__body">{pillar.body}</p>
                      </motion.article>
                    )
                  })}
                </div>
              ) : null}

              {story.quote ? (
                <blockquote className="story-quote story-pillars-dropdown__quote">
                  <p>&ldquo;{story.quote}&rdquo;</p>
                  {story.quoteAttribution ? (
                    <footer>— {story.quoteAttribution}</footer>
                  ) : null}
                </blockquote>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

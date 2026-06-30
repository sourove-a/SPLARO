'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Star } from 'lucide-react'
import type { CustomerStoriesConfig } from '@/lib/storefront/homepage-defaults'
import { cn } from '@/lib/utils/cn'

const PANEL_ID = 'splaro-customer-stories-panel'

interface CustomerStoriesDropdownProps {
  config: CustomerStoriesConfig
}

export function CustomerStoriesDropdown({ config }: CustomerStoriesDropdownProps) {
  const [open, setOpen] = useState(false)
  const stories = config.stories.filter((story) => story.enabled)
  const ratingValue = Math.max(0, Math.min(5, Math.round(Number.parseFloat(config.rating) || 5)))

  if (!config.enabled || stories.length === 0) return null

  return (
    <div className={cn('story-stories', open && 'story-stories--open')}>
      <button
        type="button"
        className="story-stories__trigger"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="story-stories__trigger-copy">
          <span className="story-stories__label">{config.label}</span>
          <span className="story-stories__hint">
            <span className="story-stories__stars" aria-hidden>
              {Array.from({ length: ratingValue }).map((_, index) => (
                <Star key={index} className="story-stories__star" strokeWidth={2} />
              ))}
            </span>
            {config.rating} · {stories.length} {config.hint}
          </span>
        </div>
        <span className="story-stories__chevron" aria-hidden>
          <ChevronDown strokeWidth={2.2} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={PANEL_ID}
            className="story-stories__panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <ul className="story-stories__list">
              {stories.map((story, index) => (
                <motion.li
                  key={story.id}
                  className="story-stories__item"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="story-stories__item-top">
                    <div className="story-stories__avatar">{story.avatar}</div>
                    <div className="story-stories__meta">
                      <p className="story-stories__name">{story.name}</p>
                      <p className="story-stories__location">
                        {story.location} · <em>{story.product}</em>
                      </p>
                    </div>
                    <span className="story-stories__date">{story.date}</span>
                  </div>
                  <div className="story-stories__item-stars" aria-hidden>
                    {Array.from({ length: story.rating }).map((_, starIndex) => (
                      <Star key={starIndex} className="story-stories__item-star" strokeWidth={2} />
                    ))}
                  </div>
                  <p className="story-stories__quote">&ldquo;{story.text}&rdquo;</p>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

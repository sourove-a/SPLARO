'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const PANEL_ID = 'splaro-story-read-more-panel'

interface StoryReadMoreProps {
  body1: string
  body2: string
  label?: string
}

function teaserLine(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^(.+?[.!?])(\s|$)/)
  return match?.[1] ?? trimmed
}

export function StoryReadMore({
  body1,
  body2,
  label = 'Read our story',
}: StoryReadMoreProps) {
  const [open, setOpen] = useState(false)
  const teaser = teaserLine(body1)

  return (
    <div className={cn('story-readmore', open && 'story-readmore--open')}>
      {!open ? <p className="story-readmore__teaser">{teaser}</p> : null}

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
            className="story-readmore__panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="story-readmore__copy">
              <p className="story-body">{body1}</p>
              <p className="story-body story-body--inset">{body2}</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

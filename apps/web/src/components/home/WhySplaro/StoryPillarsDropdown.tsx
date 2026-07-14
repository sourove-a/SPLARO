'use client'

import { useState } from 'react'
import { Gem, Heart, Leaf, Sparkles, Sprout, Star, type LucideIcon } from 'lucide-react'
import type { OurStoryConfig, StoryPillarIcon } from '@/lib/storefront/homepage-defaults'
import { visiblePillars } from '@/lib/storefront/homepage-defaults'
import {
  LuxuryAccordion,
  LuxuryAccordionContent,
  LuxuryAccordionItem,
  LuxuryAccordionTrigger,
} from '@/components/ui/radix'
import { useMounted } from '@/lib/hooks/use-mobile-viewport'
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

function StoryPillarsCollapsed({
  story,
  pillars,
  label,
}: {
  story: OurStoryConfig
  pillars: OurStoryConfig['pillars']
  label: string
}) {
  return (
    <div className="story-readmore story-pillars-dropdown">
      <p className="story-readmore__teaser story-pillars-dropdown__teaser">
        {story.quote ? `“${story.quote}”` : collapsedHint(pillars)}
      </p>
      <button
        type="button"
        className="story-readmore__trigger"
        aria-expanded="false"
        aria-controls={PANEL_ID}
        disabled
      >
        <span className="story-readmore__label">{label}</span>
      </button>
    </div>
  )
}

export function StoryPillarsDropdown({
  story,
  label = 'What we stand for',
}: StoryPillarsDropdownProps) {
  const mounted = useMounted()
  const pillars = visiblePillars(story)
  const hasContent = pillars.length > 0 || Boolean(story.quote?.trim())
  const [openValue, setOpenValue] = useState<string | undefined>(undefined)
  const open = openValue === 'pillars'

  if (!hasContent) return null

  if (!mounted) {
    return <StoryPillarsCollapsed story={story} pillars={pillars} label={label} />
  }

  return (
    <LuxuryAccordion
      type="single"
      collapsible
      {...(openValue ? { value: openValue } : {})}
      onValueChange={(next) => setOpenValue(next || undefined)}
      className={cn(
        'story-readmore story-pillars-dropdown spl-radix-accordion--story',
        open && 'story-readmore--open',
      )}
    >
      <LuxuryAccordionItem value="pillars" className="border-none">
        {!open ? (
          <p className="story-readmore__teaser story-pillars-dropdown__teaser">
            {story.quote ? `“${story.quote}”` : collapsedHint(pillars)}
          </p>
        ) : null}

        <LuxuryAccordionTrigger
          id={`${PANEL_ID}-trigger`}
          className="story-readmore__trigger"
          aria-controls={PANEL_ID}
        >
          <span className="story-readmore__label">{open ? 'Show less' : label}</span>
        </LuxuryAccordionTrigger>

        <LuxuryAccordionContent id={PANEL_ID} className="story-readmore__panel story-pillars-dropdown__panel">
          <div className="story-pillars-dropdown__body">
            {pillars.length ? (
              <div className="story-pillars story-pillars-dropdown__grid">
                {pillars.map((pillar) => {
                  const Icon = PILLAR_ICONS[pillar.icon] ?? Star
                  return (
                    <article key={pillar.id} className="story-pillar">
                      <div className="story-pillar__sheen" aria-hidden />
                      <Icon className="story-pillar__icon" strokeWidth={1.6} />
                      <div className="story-pillar__rule" aria-hidden />
                      <h3 className="story-pillar__title">{pillar.title}</h3>
                      <p className="story-pillar__body">{pillar.body}</p>
                    </article>
                  )
                })}
              </div>
            ) : null}

            {story.quote ? (
              <blockquote className="story-quote story-pillars-dropdown__quote">
                <p>&ldquo;{story.quote}&rdquo;</p>
                {story.quoteAttribution ? <footer>— {story.quoteAttribution}</footer> : null}
              </blockquote>
            ) : null}
          </div>
        </LuxuryAccordionContent>
      </LuxuryAccordionItem>
    </LuxuryAccordion>
  )
}

'use client'

import type { ReactNode } from 'react'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import type { RevealVariant } from '@/lib/motion/variants'
import { cn } from '@/lib/utils/cn'

type StorySectionProps = {
  children: ReactNode
  /** Section reveal language — prefer fadeUp (fast, Lenis-safe) */
  variant?: Exclude<RevealVariant, 'staggerContainer'>
  /** Extra depth class for cards inside (CSS only — no scroll listeners) */
  layered?: boolean
  className?: string
  as?: 'section' | 'div'
  /** Early trigger so sections show before they feel “late” */
  margin?: string
  'aria-label'?: string
}

/**
 * Scroll Experience — light story reveal.
 * No filter:blur, no per-frame parallax (those freeze Lenis).
 */
export function StorySection({
  children,
  variant = 'fadeUp',
  layered = false,
  className,
  as: Tag = 'section',
  margin = '0px 0px -28px 0px',
  'aria-label': ariaLabel,
}: StorySectionProps) {
  return (
    <Tag
      className={cn('story-scroll', layered && 'story-scroll--layered', className)}
      data-story-section
      aria-label={ariaLabel}
    >
      <ScrollReveal variant={variant} margin={margin} className="story-scroll__reveal">
        {children}
      </ScrollReveal>
    </Tag>
  )
}

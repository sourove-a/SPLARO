'use client'

import { Facebook, Instagram, Youtube } from 'lucide-react'
import type { ReelPlatform } from '@/data/social-reels'
import { HorizontalScrollRail } from '@/components/ui/HorizontalScrollRail'
import { cn } from '@/lib/utils/cn'

const TABS: Array<{
  id: ReelPlatform
  label: string
  short: string
  icon: typeof Instagram
}> = [
  { id: 'instagram', label: 'Instagram', short: 'IG', icon: Instagram },
  { id: 'youtube', label: 'YouTube', short: 'YT', icon: Youtube },
  { id: 'facebook', label: 'Facebook', short: 'FB', icon: Facebook },
]

interface PlatformTabsProps {
  value: ReelPlatform
  onChange: (platform: ReelPlatform) => void
}

export function PlatformTabs({ value, onChange }: PlatformTabsProps) {
  return (
    <HorizontalScrollRail
      className="reels-platform-tabs-wrap"
      trackClassName="reels-platform-tabs"
      variant="pill"
      trackRole="tablist"
      ariaLabel="Social platform"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn('reels-platform-tabs__btn', active && 'reels-platform-tabs__btn--active')}
            onClick={() => onChange(tab.id)}
          >
            <Icon className="reels-platform-tabs__icon" strokeWidth={1.75} aria-hidden />
            <span className="reels-platform-tabs__short">{tab.short}</span>
            <span className="reels-platform-tabs__label">{tab.label}</span>
          </button>
        )
      })}
    </HorizontalScrollRail>
  )
}

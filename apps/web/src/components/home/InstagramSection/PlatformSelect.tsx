'use client'

import {
  LuxurySelect,
  LuxurySelectContent,
  LuxurySelectItem,
  LuxurySelectTrigger,
  LuxurySelectValue,
} from '@/components/ui/radix'
import { Facebook, Instagram, Youtube } from 'lucide-react'
import type { ReelPlatform } from '@/data/social-reels'
import type { SocialProfile } from '@/data/social-reels'

const PLATFORM_META: Record<
  ReelPlatform,
  { label: string; icon: typeof Instagram }
> = {
  instagram: { label: 'Instagram Reels', icon: Instagram },
  youtube: { label: 'YouTube Shorts', icon: Youtube },
  facebook: { label: 'Facebook Reels', icon: Facebook },
}

interface PlatformSelectProps {
  value: ReelPlatform
  profiles: Record<ReelPlatform, SocialProfile>
  onChange: (platform: ReelPlatform) => void
}

export function PlatformSelect({ value, profiles, onChange }: PlatformSelectProps) {
  const ActiveIcon = PLATFORM_META[value].icon

  return (
    <div className="reels-platform">
      <LuxurySelect value={value} onValueChange={(next) => onChange(next as ReelPlatform)}>
      <LuxurySelectTrigger className="reels-platform__trigger" aria-label="Social platform">
        <span className="reels-platform__trigger-icon">
          <ActiveIcon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="reels-platform__trigger-copy">
          <span className="reels-platform__trigger-label">{PLATFORM_META[value].label}</span>
          <span className="reels-platform__trigger-handle">{profiles[value].handle}</span>
        </span>
        <LuxurySelectValue className="sr-only" />
      </LuxurySelectTrigger>

      <LuxurySelectContent className="reels-platform__menu spl-radix-select--platform">
        {(Object.keys(PLATFORM_META) as ReelPlatform[]).map((platform) => {
          const Icon = PLATFORM_META[platform].icon
          return (
            <LuxurySelectItem
              key={platform}
              value={platform}
              textValue={PLATFORM_META[platform].label}
              className="reels-platform__option"
              indicator={null}
            >
              <span className="reels-platform__option-icon">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="reels-platform__option-copy">
                <span className="reels-platform__option-label">{PLATFORM_META[platform].label}</span>
                <span className="reels-platform__option-handle">{profiles[platform].handle}</span>
              </span>
            </LuxurySelectItem>
          )
        })}
      </LuxurySelectContent>
    </LuxurySelect>
    </div>
  )
}

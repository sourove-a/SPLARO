'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Facebook, Instagram, Youtube } from 'lucide-react'
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
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const ActiveIcon = PLATFORM_META[value].icon

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [])

  return (
    <div className={`reels-platform${open ? ' reels-platform--open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="reels-platform__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="reels-platform__trigger-icon">
          <ActiveIcon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="reels-platform__trigger-copy">
          <span className="reels-platform__trigger-label">{PLATFORM_META[value].label}</span>
          <span className="reels-platform__trigger-handle">{profiles[value].handle}</span>
        </span>
        <ChevronDown className="reels-platform__chevron h-4 w-4" strokeWidth={1.75} />
      </button>

      <ul className="reels-platform__menu" role="listbox" aria-label="Social platform">
        {(Object.keys(PLATFORM_META) as ReelPlatform[]).map((platform) => {
          const Icon = PLATFORM_META[platform].icon
          const active = platform === value
          return (
            <li key={platform} role="option" aria-selected={active}>
              <button
                type="button"
                className={`reels-platform__option${active ? ' reels-platform__option--active' : ''}`}
                onClick={() => {
                  onChange(platform)
                  setOpen(false)
                }}
              >
                <span className="reels-platform__option-icon">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="reels-platform__option-copy">
                  <span className="reels-platform__option-label">{PLATFORM_META[platform].label}</span>
                  <span className="reels-platform__option-handle">{profiles[platform].handle}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

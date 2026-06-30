'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Instagram } from 'lucide-react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { resolveSocialProfiles } from '@/data/social-reels'
import { resolveHomepageSections } from '@/lib/storefront/homepage-defaults'
import { cn } from '@/lib/utils/cn'
import { SocialReelsPanel } from '@/components/home/InstagramSection/SocialReelsPanel'

const PANEL_ID = 'splaro-social-reels-panel'

export function SocialReelsDropdown() {
  const settings = useStorefrontSettings()
  const homepage = resolveHomepageSections(settings.config.homepage)
  const profiles = useMemo(() => resolveSocialProfiles(settings), [settings])
  const [open, setOpen] = useState(false)

  if (!homepage.instagram) return null

  return (
    <div className={cn('story-reels', open && 'story-reels--open')}>
      <button
        type="button"
        className="story-reels__trigger"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="story-reels__trigger-copy">
          <span className="story-reels__label">
            <Instagram className="story-reels__label-icon" strokeWidth={1.75} aria-hidden />
            Follow our world
          </span>
          <span className="story-reels__hint story-reels__hint--desktop">
            {profiles.instagram.handle} · Instagram, YouTube & Facebook
          </span>
          <span className="story-reels__hint story-reels__hint--mobile">
            {profiles.instagram.handle} · Reels & Shorts
          </span>
        </div>
        <span className="story-reels__chevron" aria-hidden>
          <ChevronDown strokeWidth={2.2} />
        </span>
      </button>

      <div
        id={PANEL_ID}
        className={cn('story-reels__panel', open && 'story-reels__panel--open')}
        aria-hidden={!open}
      >
        <div className="story-reels__panel-inner">
          <SocialReelsPanel compact dormant={!open} />
        </div>
      </div>
    </div>
  )
}

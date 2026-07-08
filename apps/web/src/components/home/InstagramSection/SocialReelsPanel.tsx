'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Instagram } from 'lucide-react'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import {
  reelsForPlatform,
  resolveSocialProfiles,
  type ReelPlatform,
  type SocialReelItem,
} from '@/data/social-reels'
import { PlatformSelect } from './PlatformSelect'
import { PlatformTabs } from './PlatformTabs'
import { ReelCard } from './ReelCard'
import { ReelModal } from './ReelModal'
import { cn } from '@/lib/utils/cn'

interface SocialReelsPanelProps {
  /** Compact layout for story accordion — no page-level header/cta */
  compact?: boolean
  /** Panel collapsed — pause videos & observers */
  dormant?: boolean
}

export function SocialReelsPanel({ compact = false, dormant = false }: SocialReelsPanelProps) {
  const settings = useStorefrontSettings()
  const profiles = useMemo(() => resolveSocialProfiles(settings), [settings])
  const [platform, setPlatform] = useState<ReelPlatform>('instagram')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [modalReel, setModalReel] = useState<SocialReelItem | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const reels = useMemo(() => reelsForPlatform(platform), [platform])
  const profile = profiles[platform]

  useEffect(() => {
    setActiveId(reels[0]?.id ?? null)
  }, [reels])

  useEffect(() => {
    if (dormant) return
    const track = trackRef.current
    if (!track) return

    const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-reel-id]'))
    if (!cards.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const id = best?.target.getAttribute('data-reel-id')
        if (id) setActiveId(id)
      },
      { root: track, threshold: [0.55, 0.72, 0.9] },
    )

    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [reels, dormant])

  const scrollToReel = useCallback((id: string) => {
    const track = trackRef.current
    const card = track?.querySelector<HTMLElement>(`[data-reel-id="${id}"]`)
    card?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    setActiveId(id)
  }, [])

  return (
    <div className={compact ? 'social-reels-panel social-reels-panel--compact' : 'social-reels-panel'}>
      {!compact ? (
        <div className="reels-section__header">
          <span className="reels-section__eyebrow">
            <Instagram className="h-3.5 w-3.5" strokeWidth={1.8} />
            Follow our world
          </span>
            <h2 id="reels-heading" className="reels-section__title">{profile.handle}</h2>
          <p className="reels-section__sub">Life through the lens of quiet luxury</p>
        </div>
      ) : null}

      <div className={cn('reels-shell', compact && 'reels-shell--embedded')}>
        {!compact ? <div className="reels-shell__shine" aria-hidden /> : null}
        <div className="reels-shell__toolbar">
          {compact ? (
            <PlatformTabs value={platform} onChange={setPlatform} />
          ) : (
            <PlatformSelect value={platform} profiles={profiles} onChange={setPlatform} />
          )}
          <Link
            href={profile.href}
            target="_blank"
            rel="noopener noreferrer"
            className="reels-shell__follow"
          >
            {compact ? `Follow ${profile.handle.replace(/^@/, '')}` : 'Follow'}
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        </div>

        {reels.length > 0 ? (
          <>
            <div className="reels-track-wrap">
              <div className="reels-track" ref={trackRef} data-lenis-prevent>
                {reels.map((reel) => (
                  <ReelCard
                    key={reel.id}
                    reel={reel}
                    isActive={!dormant && activeId === reel.id}
                    onActivate={() => setActiveId(reel.id)}
                    onExpand={() => setModalReel(reel)}
                  />
                ))}
              </div>
            </div>

            <div className="reels-shell__dots" aria-hidden>
              {reels.map((reel) => (
                <button
                  key={reel.id}
                  type="button"
                  className={`reels-shell__dot${activeId === reel.id ? ' reels-shell__dot--active' : ''}`}
                  onClick={() => scrollToReel(reel.id)}
                  aria-label={`Show ${reel.title}`}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="reels-shell__empty px-4 py-8 text-center text-sm text-luxury-gray">
            No reels published yet
          </p>
        )}
      </div>

      {!compact ? (
        <div className="reels-section__cta">
          <Link
            href={profile.href}
            target="_blank"
            rel="noopener noreferrer"
            className="reels-section__btn"
          >
            <Instagram className="h-3.5 w-3.5" strokeWidth={1.8} />
            Follow {profiles.instagram.handle}
          </Link>
        </div>
      ) : null}

      {modalReel ? (
        <ReelModal
          reel={modalReel}
          profile={profiles[modalReel.platform]}
          onClose={() => setModalReel(null)}
        />
      ) : null}
    </div>
  )
}

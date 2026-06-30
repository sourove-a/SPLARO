'use client'

import { useEffect } from 'react'
import { ExternalLink, X } from 'lucide-react'
import type { ReelPlatform, SocialReelItem } from '@/data/social-reels'
import type { SocialProfile } from '@/data/social-reels'

const PLATFORM_LABEL: Record<ReelPlatform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
}

interface ReelModalProps {
  reel: SocialReelItem
  profile: SocialProfile
  onClose: () => void
}

export function ReelModal({ reel, profile, onClose }: ReelModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const watchUrl = reel.youtubeId
    ? `https://www.youtube.com/watch?v=${reel.youtubeId}`
    : reel.watchUrl

  return (
    <div className="reels-modal" role="dialog" aria-modal="true" aria-label={`Watch ${reel.title}`}>
      <button type="button" className="reels-modal__backdrop" onClick={onClose} aria-label="Close" />
      <div className="reels-modal__panel">
        <button type="button" className="reels-modal__close" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="reels-modal__stage">
          {reel.youtubeId ? (
            <iframe
              className="reels-modal__iframe"
              src={`https://www.youtube-nocookie.com/embed/${reel.youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
              title={reel.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : reel.previewSrc ? (
            <video
              className="reels-modal__video"
              src={reel.previewSrc}
              poster={reel.poster}
              autoPlay
              playsInline
              controls
              loop
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="reels-modal__poster" src={reel.poster} alt={reel.title} />
          )}
        </div>

        <div className="reels-modal__meta">
          <p className="reels-modal__platform">{PLATFORM_LABEL[reel.platform]}</p>
          <h3 className="reels-modal__title">{reel.title}</h3>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="reels-modal__cta"
          >
            Watch on {PLATFORM_LABEL[reel.platform]}
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
          </a>
          <a
            href={profile.href}
            target="_blank"
            rel="noopener noreferrer"
            className="reels-modal__profile"
          >
            Follow {profile.handle}
          </a>
        </div>
      </div>
    </div>
  )
}

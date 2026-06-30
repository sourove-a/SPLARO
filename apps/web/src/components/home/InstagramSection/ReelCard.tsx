'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { Play } from 'lucide-react'
import type { SocialReelItem } from '@/data/social-reels'

interface ReelCardProps {
  reel: SocialReelItem
  isActive: boolean
  onActivate: () => void
  onExpand: () => void
}

export function ReelCard({ reel, isActive, onActivate, onExpand }: ReelCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || reel.youtubeId) return
    if (isActive) {
      void video.play().catch(() => {})
    } else {
      video.pause()
      video.currentTime = 0
    }
  }, [isActive, reel.youtubeId])

  return (
    <article
      className={`reels-card${isActive ? ' reels-card--active' : ''}`}
      data-reel-id={reel.id}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      tabIndex={0}
    >
      <div className="reels-card__media">
        {reel.youtubeId && isActive ? (
          <iframe
            className="reels-card__iframe"
            src={`https://www.youtube-nocookie.com/embed/${reel.youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${reel.youtubeId}&modestbranding=1&playsinline=1&rel=0`}
            title={reel.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        ) : reel.previewSrc ? (
          <video
            ref={videoRef}
            className="reels-card__video"
            src={reel.previewSrc}
            poster={reel.poster}
            muted
            loop
            playsInline
            preload={isActive ? 'auto' : 'metadata'}
          />
        ) : (
          <Image
            src={reel.poster}
            alt={reel.title}
            fill
            sizes="(max-width: 640px) 72vw, 280px"
            className="reels-card__poster"
          />
        )}
        <div className="reels-card__shine" aria-hidden />
        <div className="reels-card__gradient" aria-hidden />
      </div>

      <div className="reels-card__footer">
        <p className="reels-card__title">{reel.title}</p>
        <button
          type="button"
          className="reels-card__play"
          onClick={(event) => {
            event.stopPropagation()
            onExpand()
          }}
          aria-label={`Watch ${reel.title}`}
        >
          <Play className="h-3.5 w-3.5" strokeWidth={2} fill="currentColor" />
        </button>
      </div>
    </article>
  )
}

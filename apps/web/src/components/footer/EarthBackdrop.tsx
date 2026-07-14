'use client'

import { useEffect, useRef, useState } from 'react'

import { useFooterEarthActive } from '@/components/footer/earth-live/useFooterEarthActive'

const FOOTER_GLOBE_VIDEO = '/videos/footer-globe.mp4'
/** Same frame as video — no PNG → video jump on load */
const FOOTER_GLOBE_POSTER = '/videos/footer-globe-poster.jpg'

/**
 * Design Monks–style footer Earth:
 * looping muted autoplay VIDEO (same technique as designmonks.co footer_globe.mp4).
 * Camera fixed in the video — Earth rotates in place. No PNG shake.
 *
 * Decorative ambient motion — keep playing even when Windows has
 * "Animation effects" OFF (prefers-reduced-motion). Only pause when off-screen.
 */
export function EarthBackdrop() {
  const { ref, active } = useFooterEarthActive()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoReady, setVideoReady] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || videoFailed) return

    if (active) {
      video.playbackRate = 1
      const play = video.play()
      if (play && typeof play.catch === 'function') {
        play.catch(() => {
          /* muted autoplay usually works; ignore transient blocks */
        })
      }
    } else {
      video.pause()
    }
  }, [active, videoFailed])

  return (
    <div
      ref={ref}
      className="earth-backdrop"
      aria-hidden="true"
      data-earth-live={videoReady ? 'video' : videoFailed ? 'poster' : 'loading'}
      data-earth-active={active ? 'true' : 'false'}
    >
      <div className="earth-backdrop__video-wrap">
        {!videoFailed ? (
          <video
            ref={videoRef}
            className="earth-backdrop__video"
            src={FOOTER_GLOBE_VIDEO}
            poster={FOOTER_GLOBE_POSTER}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlayThrough={() => setVideoReady(true)}
            onLoadedData={() => setVideoReady(true)}
            onError={() => setVideoFailed(true)}
          />
        ) : null}

        <img
          className="earth-backdrop__poster-img"
          src={FOOTER_GLOBE_POSTER}
          alt=""
          width={1920}
          height={1080}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          draggable={false}
        />
      </div>

      <div className="earth-backdrop__atmosphere earth-backdrop__atmosphere--shimmer" />
      <div className="earth-backdrop__limb" />
      <div className="earth-backdrop__glass-shield" />
      <div className="earth-backdrop__scrim" />
      <div className="earth-backdrop__space earth-backdrop__space--a" />
      <div className="earth-backdrop__space earth-backdrop__space--b" />
    </div>
  )
}

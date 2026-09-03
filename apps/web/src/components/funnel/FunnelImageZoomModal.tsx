'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'

interface FunnelImageZoomModalProps {
  isOpen: boolean
  onClose: () => void
  images: string[]
  initialIdx?: number | undefined
  productTitle?: string | undefined
  productCode?: string | undefined
}

export function FunnelImageZoomModal({
  isOpen,
  onClose,
  images,
  initialIdx = 0,
  productTitle = 'Product',
  productCode,
}: FunnelImageZoomModalProps) {
  const [activeIdx, setActiveIdx] = useState(initialIdx)
  const [currentScale, setCurrentScale] = useState(1)
  const [showHint, setShowHint] = useState(true)
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null)

  useEffect(() => {
    setActiveIdx(initialIdx)
  }, [initialIdx])

  // Reset scale and auto-hide hint after 3.5s
  useEffect(() => {
    if (!isOpen) return
    setCurrentScale(1)
    setShowHint(true)
    const timer = setTimeout(() => setShowHint(false), 3800)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && images.length > 1) {
        setActiveIdx((prev) => (prev + 1) % images.length)
        transformRef.current?.resetTransform()
      }
      if (e.key === 'ArrowLeft' && images.length > 1) {
        setActiveIdx((prev) => (prev - 1 + images.length) % images.length)
        transformRef.current?.resetTransform()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, images.length, onClose])

  if (!isOpen || images.length === 0) return null

  const activeImage = images[activeIdx] || images[0]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image Zoom Lightbox"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: '#000000', // Pure pitch-black 100% opaque, zero bleed-through
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        overflow: 'hidden',
        animation: 'funnel-fade-in 180ms ease-out',
      }}
    >
      {/* Top Floating Controls Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 30,
          pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0) 100%)',
        }}
      >
        {/* Product Title Pill */}
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 20,
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            maxWidth: '55vw',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {productTitle}
          </span>
          {productCode && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.7)',
                background: 'rgba(255, 255, 255, 0.12)',
                padding: '2px 6px',
                borderRadius: 10,
              }}
            >
              #{productCode}
            </span>
          )}
        </div>

        {/* Right Controls: Zoom Pill + Close Button */}
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Zoom Buttons Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              padding: '3px 8px',
              borderRadius: 30,
              background: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
            }}
          >
            <button
              type="button"
              onClick={() => transformRef.current?.zoomOut(0.4)}
              title="Zoom Out"
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 18,
                fontWeight: 700,
                padding: '2px 8px',
                lineHeight: 1,
              }}
            >
              −
            </button>

            <button
              type="button"
              onClick={() => transformRef.current?.resetTransform()}
              title="Reset to 100%"
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 4px',
                minWidth: 38,
                textAlign: 'center',
              }}
            >
              {Math.round(currentScale * 100)}%
            </button>

            <button
              type="button"
              onClick={() => transformRef.current?.zoomIn(0.4)}
              title="Zoom In"
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 18,
                fontWeight: 700,
                padding: '2px 8px',
                lineHeight: 1,
              }}
            >
              +
            </button>
          </div>

          {/* Luxury Close Button */}
          <button
            type="button"
            onClick={onClose}
            title="বন্ধ করুন (Esc)"
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.18)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1.5px solid rgba(255, 255, 255, 0.4)',
              color: '#ffffff',
              fontSize: 17,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 150ms ease',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Viewport Stage - Full Screen Immersion */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        <TransformWrapper
          ref={transformRef}
          minScale={1}
          maxScale={5}
          centerOnInit
          limitToBounds
          smooth
          doubleClick={{
            mode: 'toggle',
            step: 2.5,
            animationTime: 200,
            animationType: 'easeOut',
          }}
          pinch={{ step: 5 }}
          wheel={{ step: 0.15, smoothStep: 0.04 }}
          onTransformed={(_ref, state) => {
            setCurrentScale(state.scale)
          }}
        >
          <TransformComponent
            wrapperStyle={{
              width: '100vw',
              height: '100vh',
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            contentStyle={{
              width: '100vw',
              height: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentScale > 1.05 ? 'grab' : 'zoom-in',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage}
              alt={productTitle}
              style={{
                maxWidth: '96vw',
                maxHeight: '94vh',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: 4,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.9)',
                pointerEvents: 'auto',
                transition: 'filter 150ms ease',
              }}
              draggable={false}
            />
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* Bottom Floating Area: Gesture Hint & Thumbnails */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          zIndex: 30,
          pointerEvents: 'none',
          background: 'linear-gradient(0deg, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0) 100%)',
        }}
      >
        {/* Bangla Gesture Hint Pill (Fades after 3.8s or stays clean) */}
        {showHint && (
          <div
            style={{
              pointerEvents: 'auto',
              fontSize: 11,
              fontWeight: 700,
              color: '#ffffff',
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              padding: '6px 16px',
              borderRadius: 30,
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
              animation: 'funnel-fade-in 200ms ease-out',
            }}
          >
            📱 দুই আঙুল দিয়ে (Pinch) অথবা Double Tap করে জুম করুন
          </div>
        )}

        {/* Compact Angle Thumbnails */}
        {images.length > 1 && (
          <div
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 8px',
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            {images.map((img, idx) => {
              const isSelected = activeIdx === idx
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveIdx(idx)
                    transformRef.current?.resetTransform()
                  }}
                  style={{
                    width: 44,
                    height: 54,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.2)',
                    padding: 0,
                    background: '#000000',
                    cursor: 'pointer',
                    opacity: isSelected ? 1 : 0.5,
                    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 150ms ease',
                    boxShadow: isSelected ? '0 0 10px rgba(255, 255, 255, 0.4)' : 'none',
                  }}
                >
                  <Image
                    src={img}
                    alt={`Angle ${idx + 1}`}
                    width={44}
                    height={54}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

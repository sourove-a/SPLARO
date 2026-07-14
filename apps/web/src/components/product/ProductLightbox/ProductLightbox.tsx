'use client'

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { AnimatePresence, motion } from '@/lib/motion/react'
import { ChevronLeft, ChevronRight, X as CloseIcon } from 'lucide-react'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import { MotionPressable } from '@/components/ui/MotionPressable'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { EASE_EXPO_OUT } from '@/lib/motion/config'
import { cn } from '@/lib/utils/cn'

export type ProductMediaItem = { type: 'image' | 'video'; url: string }

interface ProductLightboxProps {
  isOpen: boolean
  onClose: () => void
  productName: string
  media: ProductMediaItem[]
  activeIndex: number
  onPrev: () => void
  onNext: () => void
  showMotion: boolean
}

export function ProductLightbox({
  isOpen,
  onClose,
  productName,
  media,
  activeIndex,
  onPrev,
  onNext,
  showMotion,
}: ProductLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const pinchRef = useRef<ReactZoomPanPinchRef | null>(null)
  const swipeRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const active = media[activeIndex]

  useEffect(() => {
    if (!isOpen) return
    closeRef.current?.focus({ preventScroll: true })
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('product-lightbox-open')

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') onPrev()
      if (event.key === 'ArrowRight') onNext()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.classList.remove('product-lightbox-open')
    }
  }, [isOpen, onClose, onNext, onPrev])

  useEffect(() => {
    pinchRef.current?.resetTransform(0)
  }, [activeIndex, isOpen])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (media.length < 2) return
    swipeRef.current = { x: event.clientX, y: event.clientY, moved: false }
  }, [media.length])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) start.moved = true
  }, [])

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = swipeRef.current
      if (!start) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      const swiped = start.moved && Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.2
      swipeRef.current = null
      if (!swiped) return
      if (dx < 0) onNext()
      else onPrev()
    },
    [onNext, onPrev],
  )

  if (!media.length || typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="product-lightbox"
          className="pp-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} fullscreen preview`}
          initial={showMotion ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          {...(showMotion ? { exit: { opacity: 0 } } : {})}
          transition={{ duration: 0.28, ease: EASE_EXPO_OUT }}
          onClick={onClose}
        >
          <MotionPressable
            ref={closeRef}
            type="button"
            className="pp-lightbox__close pp-pressable"
            onClick={(event) => {
              event.stopPropagation()
              onClose()
            }}
            aria-label="Close fullscreen preview"
            variant="icon"
          >
            <CloseIcon size={22} strokeWidth={1.8} />
          </MotionPressable>

          {media.length > 1 ? (
            <MotionPressable
              type="button"
              className="pp-lightbox__nav pp-lightbox__nav--prev pp-pressable"
              onClick={(event) => {
                event.stopPropagation()
                onPrev()
              }}
              aria-label="Previous image"
              variant="nav"
            >
              <ChevronLeft size={30} strokeWidth={1.55} />
            </MotionPressable>
          ) : null}

          <motion.div
            className="pp-lightbox__stage"
            initial={showMotion ? { opacity: 0, scale: 0.985 } : false}
            animate={{ opacity: 1, scale: 1 }}
            {...(showMotion ? { exit: { opacity: 0, scale: 0.99 } } : {})}
            transition={{ duration: 0.32, ease: EASE_EXPO_OUT }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              swipeRef.current = null
            }}
          >
            {active?.type === 'video' ? (
              <video
                src={active.url}
                className="pp-lightbox__media"
                autoPlay
                muted
                loop
                playsInline
                controls
              />
            ) : (
              <TransformWrapper
                ref={pinchRef}
                initialScale={1}
                minScale={1}
                maxScale={4}
                centerOnInit
                wheel={{ step: 0.12 }}
                pinch={{ step: 5 }}
                doubleClick={{ mode: 'toggle', step: 1.6 }}
              >
                <TransformComponent
                  wrapperClass="pp-lightbox__pinch-wrap"
                  contentClass="pp-lightbox__pinch-content"
                >
                  <StorefrontImage
                    src={active?.url ?? PRODUCT_IMAGE_PLACEHOLDER}
                    alt={productName}
                    profile="lightbox"
                    fill
                    fit="cover"
                    sizes="100vw"
                    className={cn('pp-lightbox__media', 'pp-lightbox__media--pinch')}
                    draggable={false}
                  />
                </TransformComponent>
              </TransformWrapper>
            )}
          </motion.div>

          {active?.type !== 'video' ? (
            <p className="pp-lightbox__hint">Pinch or double-click to zoom · Swipe to change image</p>
          ) : null}

          {media.length > 1 ? (
            <MotionPressable
              type="button"
              className="pp-lightbox__nav pp-lightbox__nav--next pp-pressable"
              onClick={(event) => {
                event.stopPropagation()
                onNext()
              }}
              aria-label="Next image"
              variant="nav"
            >
              <ChevronRight size={30} strokeWidth={1.55} />
            </MotionPressable>
          ) : null}

          <div className="pp-lightbox__counter">
            {activeIndex + 1} / {media.length}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

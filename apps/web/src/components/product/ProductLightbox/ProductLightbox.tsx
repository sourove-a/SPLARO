'use client'

import '@/styles/pages/pdp.css'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { AnimatePresence, motion } from '@/lib/motion/react'
import { ChevronLeft, ChevronRight, X as CloseIcon } from 'lucide-react'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import { MotionPressable } from '@/components/ui/MotionPressable'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { videoEmbedSrc } from '@/lib/media/product-video'
import {
  beginSwipe as beginSwipeState,
  resolveSwipe,
  trackSwipe as trackSwipeState,
  SWIPE_ZOOM_EPSILON,
  type SwipeState,
} from '@/lib/media/lightbox-swipe'
import { useMobileViewport } from '@/lib/hooks/use-mobile-viewport'
import { EASE_EXPO_OUT } from '@/lib/motion/config'
import { cn } from '@/lib/utils/cn'
import { useDialogFocusTrap } from '@/hooks/useDialogFocusTrap'
import { useOverlayScrollLock } from '@/hooks/useOverlayScrollLock'

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
  const dialogRef = useRef<HTMLDivElement>(null)
  const pinchRef = useRef<ReactZoomPanPinchRef | null>(null)
  const swipeRef = useRef<SwipeState | null>(null)
  /** Live zoom level — a drag on a zoomed photo pans it instead of changing slide. */
  const scaleRef = useRef(1)
  const isMobile = useMobileViewport()
  const [zoomed, setZoomed] = useState(false)
  const active = media[activeIndex]
  useDialogFocusTrap(isOpen, dialogRef, onClose)
  useOverlayScrollLock(isOpen)

  useEffect(() => {
    if (!isOpen) return
    closeRef.current?.focus({ preventScroll: true })
    document.body.classList.add('product-lightbox-open')

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') onPrev()
      if (event.key === 'ArrowRight') onNext()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('product-lightbox-open')
    }
  }, [isOpen, onClose, onNext, onPrev])

  useEffect(() => {
    // Soft reset when changing slides — hard 0ms reset felt like a jump
    pinchRef.current?.resetTransform(220)
    scaleRef.current = 1
    setZoomed(false)
    swipeRef.current = null
  }, [activeIndex, isOpen])

  const beginSwipe = useCallback(
    (x: number, y: number) => {
      swipeRef.current = beginSwipeState(x, y, {
        mediaCount: media.length,
        scale: scaleRef.current,
      })
    },
    [media.length],
  )

  const trackSwipe = useCallback((x: number, y: number) => {
    const start = swipeRef.current
    if (!start) return
    swipeRef.current = trackSwipeState(start, x, y)
  }, [])

  const endSwipe = useCallback(
    (x: number, y: number) => {
      const start = swipeRef.current
      swipeRef.current = null
      if (!start) return
      const move = resolveSwipe(start, x, y)
      if (move === 'next') onNext()
      else if (move === 'prev') onPrev()
    },
    [onNext, onPrev],
  )

  /**
   * Touch is served by the touch handlers below, never here. Both streams fire
   * for one finger, and letting them share the swipe state meant a
   * `pointercancel` — which a mobile browser emits the moment it claims a
   * gesture — wiped the swipe that `touchend` was about to complete. Mouse and
   * pen keep the pointer path; touch keeps the one that cannot be cancelled out
   * from under it.
   */
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch') return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      beginSwipe(event.clientX, event.clientY)
    },
    [beginSwipe],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch') return
      trackSwipe(event.clientX, event.clientY)
    },
    [trackSwipe],
  )

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch') return
      endSwipe(event.clientX, event.clientY)
    },
    [endSwipe],
  )

  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return
    swipeRef.current = null
  }, [])

  const onTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0]
      // Two fingers down is a pinch, which the zoom wrapper owns.
      if (!touch || event.touches.length > 1) {
        swipeRef.current = null
        return
      }
      beginSwipe(touch.clientX, touch.clientY)
    },
    [beginSwipe],
  )

  const onTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (event.touches.length > 1) {
        swipeRef.current = null
        return
      }
      const touch = event.touches[0]
      if (!touch) return
      trackSwipe(touch.clientX, touch.clientY)
    },
    [trackSwipe],
  )

  const onTouchEnd = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const touch = event.changedTouches[0]
      if (!touch) {
        swipeRef.current = null
        return
      }
      endSwipe(touch.clientX, touch.clientY)
    },
    [endSwipe],
  )

  if (!media.length || typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          ref={dialogRef}
          key="product-lightbox"
          className="pp-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} fullscreen preview`}
          data-lenis-prevent
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
            data-zoomed={zoomed ? 'true' : 'false'}
            initial={showMotion ? { opacity: 0, scale: 0.985 } : false}
            animate={{ opacity: 1, scale: 1 }}
            {...(showMotion ? { exit: { opacity: 0, scale: 0.99 } } : {})}
            transition={{ duration: 0.32, ease: EASE_EXPO_OUT }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={() => {
              swipeRef.current = null
            }}
          >
            {active?.type === 'video' ? (
              videoEmbedSrc(active.url) ? (
                <iframe
                  src={videoEmbedSrc(active.url) as string}
                  className="pp-lightbox__media"
                  style={{ border: 0 }}
                  title={`${productName} video`}
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <video
                  src={active.url}
                  className="pp-lightbox__media"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                />
              )
            ) : (
              <TransformWrapper
                ref={pinchRef}
                initialScale={1}
                minScale={1}
                maxScale={3}
                centerOnInit
                limitToBounds
                smooth
                panning={{ velocityDisabled: true }}
                wheel={{ step: 0.12, smoothStep: 0.04 }}
                pinch={{ step: 5 }}
                doubleClick={{ mode: 'toggle', step: 1.5, animationTime: 220, animationType: 'easeOut' }}
                alignmentAnimation={{
                  sizeX: 0,
                  sizeY: 0,
                  animationTime: 220,
                  animationType: 'easeOut',
                }}
                velocityAnimation={{ disabled: true }}
                zoomAnimation={{ animationTime: 220, animationType: 'easeOut' }}
                onTransformed={(_ref, state) => {
                  scaleRef.current = state.scale
                  const next = state.scale > SWIPE_ZOOM_EPSILON
                  setZoomed((current) => (current === next ? current : next))
                }}
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
                    fit="contain"
                    sizes="100vw"
                    className={cn('pp-lightbox__media', 'pp-lightbox__media--pinch')}
                    draggable={false}
                  />
                </TransformComponent>
              </TransformWrapper>
            )}
          </motion.div>

          {active?.type !== 'video' ? (
            <p className="pp-lightbox__hint">
              {isMobile ? 'Pinch or double-tap to zoom' : 'Scroll or double-click to zoom'}
              {media.length > 1 ? ' · Swipe to change image' : ''}
            </p>
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

          <div className="pp-lightbox__counter" aria-live="polite">
            <span className="pp-lightbox__counter-label">
              {activeIndex + 1} / {media.length}
            </span>
            {media.length > 1 ? (
              <span className="pp-lightbox__counter-track" aria-hidden>
                <span
                  className="pp-lightbox__counter-fill"
                  style={{
                    width: `${((activeIndex + 1) / media.length) * 100}%`,
                  }}
                />
              </span>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

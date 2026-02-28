import React, { useCallback, useEffect, useRef, useState } from 'react';
import './ProductImageZoom.css';
import { OptimizedImage } from './OptimizedImage';

type ProductImageZoomProps = {
  src: string;
  alt?: string;
  highResSrc?: string;
  className?: string;
  imageClassName?: string;
  zoomScale?: number;
  tapZoomScale?: number;
  minPinchScale?: number;
  maxPinchScale?: number;
  showLens?: boolean;
  onHorizontalSwipe?: (direction: 'next' | 'prev') => void;
};

type PendingTransform = {
  scale: number;
  xPct: number;
  yPct: number;
  animate: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const SWIPE_THRESHOLD_PX = 35;
const TAP_MOVE_TOLERANCE_PX = 6;

const touchDistance = (touches: React.TouchList) => {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
};

export const ProductImageZoom: React.FC<ProductImageZoomProps> = ({
  src,
  alt = 'Product image',
  highResSrc,
  className = '',
  imageClassName = '',
  zoomScale = 2.2,
  tapZoomScale = 2.1,
  minPinchScale = 1,
  maxPinchScale = 3,
  showLens = true,
  onHorizontalSwipe
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isTouchDeviceRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<PendingTransform | null>(null);
  const currentScaleRef = useRef(1);
  const currentXPctRef = useRef(50);
  const currentYPctRef = useRef(50);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);
  const movedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [lensVisible, setLensVisible] = useState(false);
  const [mobileZoomed, setMobileZoomed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      isTouchDeviceRef.current = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    }
  }, []);

  const applyTransform = useCallback((scale: number, xPct: number, yPct: number, animate: boolean) => {
    const node = containerRef.current;
    if (!node) return;
    node.style.setProperty('--piz-scale', String(scale));
    node.style.setProperty('--piz-x', `${xPct}%`);
    node.style.setProperty('--piz-y', `${yPct}%`);
    node.style.setProperty('--piz-duration', animate ? '220ms' : '0ms');
    currentScaleRef.current = scale;
    currentXPctRef.current = xPct;
    currentYPctRef.current = yPct;
  }, []);

  const flushTransform = useCallback(() => {
    rafRef.current = null;
    if (!pendingRef.current) return;
    const { scale, xPct, yPct, animate } = pendingRef.current;
    pendingRef.current = null;
    applyTransform(scale, xPct, yPct, animate);
  }, [applyTransform]);

  const scheduleTransform = useCallback((scale: number, xPct: number, yPct: number, animate = false) => {
    pendingRef.current = {
      scale,
      xPct: clamp(xPct, 0, 100),
      yPct: clamp(yPct, 0, 100),
      animate
    };
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(flushTransform);
  }, [flushTransform]);

  const pointerToRatio = useCallback((clientX: number, clientY: number) => {
    const node = containerRef.current;
    if (!node) return { xPct: 50, yPct: 50 };
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { xPct: 50, yPct: 50 };
    const xPct = ((clientX - rect.left) / rect.width) * 100;
    const yPct = ((clientY - rect.top) / rect.height) * 100;
    return { xPct: clamp(xPct, 0, 100), yPct: clamp(yPct, 0, 100) };
  }, []);

  useEffect(() => {
    applyTransform(1, 50, 50, true);
    setLensVisible(false);
    setMobileZoomed(false);
    pinchStartDistanceRef.current = null;
    touchStartRef.current = null;
    movedRef.current = false;
  }, [src, applyTransform]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (isTouchDeviceRef.current) return;
    setLensVisible(showLens);
    scheduleTransform(zoomScale, currentXPctRef.current, currentYPctRef.current, true);
  }, [scheduleTransform, showLens, zoomScale]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (isTouchDeviceRef.current) return;
    const { xPct, yPct } = pointerToRatio(event.clientX, event.clientY);
    scheduleTransform(zoomScale, xPct, yPct, false);
  }, [pointerToRatio, scheduleTransform, zoomScale]);

  const handleMouseLeave = useCallback(() => {
    if (isTouchDeviceRef.current) return;
    setLensVisible(false);
    scheduleTransform(1, 50, 50, true);
  }, [scheduleTransform]);

  const handleTouchStartInternal = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      pinchStartDistanceRef.current = touchDistance(event.touches);
      pinchStartScaleRef.current = currentScaleRef.current;
      return;
    }
    if (event.touches.length === 1) {
      const t = event.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY };
      movedRef.current = false;
    }
  }, []);

  const handleTouchMoveInternal = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const startDistance = pinchStartDistanceRef.current;
      if (!startDistance || startDistance <= 0) return;
      if (event.cancelable) event.preventDefault();
      const currentDistance = touchDistance(event.touches);
      const scaleDelta = currentDistance / startDistance;
      const targetScale = clamp(pinchStartScaleRef.current * scaleDelta, minPinchScale, maxPinchScale);
      const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
      const { xPct, yPct } = pointerToRatio(midX, midY);
      scheduleTransform(targetScale, xPct, yPct, false);
      setMobileZoomed(targetScale > 1.01);
      return;
    }

    if (event.touches.length === 1 && currentScaleRef.current > 1.01) {
      const t = event.touches[0];
      const { xPct, yPct } = pointerToRatio(t.clientX, t.clientY);
      if (event.cancelable) event.preventDefault();
      scheduleTransform(currentScaleRef.current, xPct, yPct, false);
      const start = touchStartRef.current;
      if (start && (Math.abs(t.clientX - start.x) > TAP_MOVE_TOLERANCE_PX || Math.abs(t.clientY - start.y) > TAP_MOVE_TOLERANCE_PX)) {
        movedRef.current = true;
      }
      return;
    }

    if (event.touches.length === 1) {
      const t = event.touches[0];
      const start = touchStartRef.current;
      if (start && (Math.abs(t.clientX - start.x) > TAP_MOVE_TOLERANCE_PX || Math.abs(t.clientY - start.y) > TAP_MOVE_TOLERANCE_PX)) {
        movedRef.current = true;
      }
    }
  }, [maxPinchScale, minPinchScale, pointerToRatio, scheduleTransform]);

  const handleTouchEndInternal = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      pinchStartDistanceRef.current = null;
    }

    if (event.changedTouches.length !== 1) {
      touchStartRef.current = null;
      movedRef.current = false;
      return;
    }

    const touch = event.changedTouches[0];
    const start = touchStartRef.current;
    const deltaX = start ? touch.clientX - start.x : 0;
    const deltaY = start ? touch.clientY - start.y : 0;
    const currentlyZoomed = currentScaleRef.current > 1.01;

    if (
      !currentlyZoomed &&
      start &&
      Math.abs(deltaX) >= SWIPE_THRESHOLD_PX &&
      Math.abs(deltaX) > Math.abs(deltaY)
    ) {
      onHorizontalSwipe?.(deltaX < 0 ? 'next' : 'prev');
      touchStartRef.current = null;
      movedRef.current = false;
      return;
    }

    if (movedRef.current) {
      touchStartRef.current = null;
      movedRef.current = false;
      return;
    }

    const { xPct, yPct } = pointerToRatio(touch.clientX, touch.clientY);
    if (currentlyZoomed) {
      scheduleTransform(1, 50, 50, true);
      setMobileZoomed(false);
      touchStartRef.current = null;
      movedRef.current = false;
      return;
    }

    scheduleTransform(tapZoomScale, xPct, yPct, true);
    setMobileZoomed(true);
    touchStartRef.current = null;
    movedRef.current = false;
  }, [onHorizontalSwipe, pointerToRatio, scheduleTransform, tapZoomScale]);

  const handleTouchCancelInternal = useCallback(() => {
    pinchStartDistanceRef.current = null;
    touchStartRef.current = null;
    movedRef.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className={`product-image-zoom ${showLens ? 'product-image-zoom--lens' : ''} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStartInternal}
      onTouchMove={handleTouchMoveInternal}
      onTouchEnd={handleTouchEndInternal}
      onTouchCancel={handleTouchCancelInternal}
      role="img"
      aria-label={alt}
      aria-live="polite"
    >
      <OptimizedImage
        src={highResSrc || src}
        alt={alt}
        priority
        sizes="(max-width: 768px) 100vw, 55vw"
        draggable={false}
        className={`product-image-zoom__img ${imageClassName}`}
      />

      {showLens && (
        <div className={`product-image-zoom__lens ${lensVisible ? 'product-image-zoom__lens--visible' : ''}`} />
      )}

      <button
        type="button"
        className="product-image-zoom__mobile-toggle"
        onClick={() => {
          if (currentScaleRef.current > 1.01) {
            scheduleTransform(1, 50, 50, true);
            setMobileZoomed(false);
            return;
          }
          scheduleTransform(tapZoomScale, 50, 50, true);
          setMobileZoomed(true);
        }}
        aria-label={mobileZoomed ? 'Zoom out product image' : 'Zoom in product image'}
      >
        {mobileZoomed ? 'Zoom Out' : 'Zoom In'}
      </button>
    </div>
  );
};

export default ProductImageZoom;

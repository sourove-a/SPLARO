'use client'

import { useEffect, useRef } from 'react'

const PARTICLE_COUNT = 28

/**
 * Ambient ink motes drifting over the light collections canvas.
 * Skipped entirely when the visitor asks for reduced motion.
 */
export function CollectionsStardust() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId = 0
    let width = window.innerWidth
    let height = window.innerHeight

    const resizeCanvas = () => {
      width = window.innerWidth
      height = window.innerHeight
      // Match the device pixel ratio so the motes stay crisp instead of blurred.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas, { passive: true })

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.6,
      speedX: (Math.random() - 0.5) * 0.2,
      speedY: -Math.random() * 0.3 - 0.08, // gently floating upward
      alpha: Math.random() * 0.16 + 0.06,
      alphaChange: (Math.random() * 0.004 + 0.001) * (Math.random() > 0.5 ? 1 : -1),
    }))

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      for (const p of particles) {
        p.x += p.speedX
        p.y += p.speedY
        p.alpha += p.alphaChange

        if (p.alpha <= 0.04 || p.alpha >= 0.22) {
          p.alphaChange = -p.alphaChange
        }

        // Wrap around boundaries
        if (p.y < 0) {
          p.y = height
          p.x = Math.random() * width
        }
        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        // Ink on an off-white page — white motes were invisible here.
        ctx.fillStyle = `rgba(15, 16, 19, ${Math.max(0, Math.min(1, p.alpha))})`
        ctx.fill()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      aria-hidden
    />
  )
}

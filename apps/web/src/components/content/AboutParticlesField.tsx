'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion } from '@/lib/motion/react'
import { cn } from '@/lib/utils/cn'

type Particle = {
  x: number
  y: number
  z: number
  r: number
  vx: number
  vy: number
  life: number
  hue: number
}

type AboutParticlesFieldProps = {
  className?: string
}

function shouldPausePaint(): boolean {
  if (typeof document === 'undefined') return false
  const root = document.documentElement
  return (
    root.getAttribute('data-scrolling') === '1' || root.getAttribute('data-perf') === 'lite'
  )
}

/**
 * Spline-inspired particle moon field for About hero.
 * Canvas only — no Spline runtime (keeps Lenis / mobile smooth).
 * Visual language: https://app.spline.design/community/file/3ff7b617-2fe9-46c7-8e06-b6d7c382f4db
 */
export function AboutParticlesField({ className }: AboutParticlesFieldProps) {
  const reducedMotion = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reducedMotion) return
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let raf = 0
    let running = true
    let width = 0
    let height = 0
    let dpr = 1
    let particles: Particle[] = []
    let pointerX = 0.5
    let pointerY = 0.5
    let targetX = 0.5
    let targetY = 0.5
    let last = performance.now()

    const countForSize = (w: number) => {
      if (w < 420) return 36
      if (w < 720) return 52
      return 72
    }

    const seed = (w: number, _h: number) => {
      const n = countForSize(w)
      particles = Array.from({ length: n }, () => {
        const angle = Math.random() * Math.PI * 2
        const radius = 0.12 + Math.random() * 0.38
        return {
          x: 0.5 + Math.cos(angle) * radius,
          y: 0.5 + Math.sin(angle) * radius * 0.86,
          z: 0.25 + Math.random() * 0.75,
          r: 0.6 + Math.random() * 2.4,
          vx: (Math.random() - 0.5) * 0.00035,
          vy: (Math.random() - 0.5) * 0.00035,
          life: Math.random(),
          hue: Math.random() > 0.72 ? 42 : Math.random() > 0.45 ? 210 : 0,
        }
      })
    }

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed(width, height)
    }

    const drawMoon = () => {
      const cx = width * (0.5 + (pointerX - 0.5) * 0.04)
      const cy = height * (0.48 + (pointerY - 0.5) * 0.04)
      const radius = Math.min(width, height) * 0.34

      const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.55)
      glow.addColorStop(0, 'rgba(120, 150, 190, 0.28)')
      glow.addColorStop(0.45, 'rgba(40, 48, 68, 0.35)')
      glow.addColorStop(1, 'rgba(10, 12, 18, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, radius * 1.55, 0, Math.PI * 2)
      ctx.fill()

      const moon = ctx.createRadialGradient(
        cx - radius * 0.25,
        cy - radius * 0.28,
        radius * 0.08,
        cx,
        cy,
        radius,
      )
      moon.addColorStop(0, 'rgba(232, 236, 245, 0.95)')
      moon.addColorStop(0.35, 'rgba(170, 180, 205, 0.72)')
      moon.addColorStop(0.7, 'rgba(70, 78, 98, 0.88)')
      moon.addColorStop(1, 'rgba(18, 20, 28, 0.95)')
      ctx.fillStyle = moon
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()

      // Soft crater hints
      ctx.fillStyle = 'rgba(20, 24, 34, 0.18)'
      ctx.beginPath()
      ctx.arc(cx + radius * 0.22, cy - radius * 0.1, radius * 0.12, 0, Math.PI * 2)
      ctx.arc(cx - radius * 0.18, cy + radius * 0.2, radius * 0.08, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawParticle = (p: Particle, dt: number) => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life += dt * 0.00012

      // Soft orbital drift around center
      const dx = p.x - 0.5
      const dy = p.y - 0.5
      p.vx += -dy * 0.000002 * dt
      p.vy += dx * 0.000002 * dt
      p.vx += (pointerX - 0.5) * 0.0000015 * dt
      p.vy += (pointerY - 0.5) * 0.0000015 * dt

      // Keep in soft cloud
      const dist = Math.hypot(dx, dy)
      if (dist > 0.48) {
        p.vx -= dx * 0.00004 * dt
        p.vy -= dy * 0.00004 * dt
      }

      const px = (p.x + (pointerX - 0.5) * 0.03 * p.z) * width
      const py = (p.y + (pointerY - 0.5) * 0.03 * p.z) * height
      const size = p.r * (0.55 + p.z * 0.9)
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.life * 6 + p.z * 8))
      const alpha = Math.min(0.92, 0.25 + p.z * 0.55) * twinkle

      let color = `rgba(240, 244, 255, ${alpha})`
      if (p.hue === 42) color = `rgba(232, 205, 150, ${alpha})`
      if (p.hue === 210) color = `rgba(170, 200, 240, ${alpha})`

      ctx.beginPath()
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 8 + p.z * 10
      ctx.arc(px, py, size, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    const frame = (now: number) => {
      if (!running) return
      const dt = Math.min(34, now - last)
      last = now

      // Pause heavy paint while page is scrolling / lite
      if (shouldPausePaint()) {
        raf = requestAnimationFrame(frame)
        return
      }

      pointerX += (targetX - pointerX) * 0.06
      pointerY += (targetY - pointerY) * 0.06

      ctx.clearRect(0, 0, width, height)

      // Deep night wash
      const night = ctx.createLinearGradient(0, 0, width, height)
      night.addColorStop(0, 'rgba(8, 10, 16, 0.55)')
      night.addColorStop(0.5, 'rgba(14, 16, 26, 0.35)')
      night.addColorStop(1, 'rgba(8, 10, 16, 0.6)')
      ctx.fillStyle = night
      ctx.fillRect(0, 0, width, height)

      drawMoon()

      for (const p of particles) drawParticle(p, dt)

      raf = requestAnimationFrame(frame)
    }

    const onPointer = (event: PointerEvent) => {
      const rect = wrap.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      targetX = (event.clientX - rect.left) / rect.width
      targetY = (event.clientY - rect.top) / rect.height
    }

    const onLeave = () => {
      targetX = 0.5
      targetY = 0.5
    }

    resize()
    raf = requestAnimationFrame(frame)

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(wrap)
    window.addEventListener('resize', resize)
    wrap.addEventListener('pointermove', onPointer, { passive: true })
    wrap.addEventListener('pointerleave', onLeave)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', resize)
      wrap.removeEventListener('pointermove', onPointer)
      wrap.removeEventListener('pointerleave', onLeave)
    }
  }, [reducedMotion])

  if (reducedMotion) {
    return (
      <div className={cn('about-particles about-particles--static', className)} aria-hidden>
        <span className="about-particles__moon" />
      </div>
    )
  }

  return (
    <div ref={wrapRef} className={cn('about-particles', className)} aria-hidden>
      <canvas ref={canvasRef} className="about-particles__canvas" />
    </div>
  )
}

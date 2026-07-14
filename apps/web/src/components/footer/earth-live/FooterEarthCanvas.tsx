'use client'

import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

import { FooterEarthScene } from '@/components/footer/earth-live/FooterEarthScene'
import {
  acquireEarthWebGLSlot,
  globePixelRatioCap,
  isLowPowerDevice,
  isSoftwareRenderer,
  releaseEarthWebGLSlot,
} from '@/lib/earth/globe-performance'

const SLOT_TOKEN = 'footer-earth-live'

type FooterEarthCanvasProps = {
  active: boolean
  reducedMotion: boolean
  onUnavailable?: () => void
}

export function FooterEarthCanvas({ active, reducedMotion, onUnavailable }: FooterEarthCanvasProps) {
  const releasedRef = useRef(false)
  const lowPower = isLowPowerDevice() || isSoftwareRenderer()

  useEffect(() => {
    if (lowPower) {
      onUnavailable?.()
      return
    }
    if (!acquireEarthWebGLSlot(SLOT_TOKEN)) {
      onUnavailable?.()
    }

    return () => {
      if (!releasedRef.current) {
        releaseEarthWebGLSlot(SLOT_TOKEN)
        releasedRef.current = true
      }
    }
  }, [onUnavailable, lowPower])

  if (lowPower) return null

  return (
    <Canvas
      className="earth-backdrop__webgl"
      orthographic
      dpr={globePixelRatioCap(2)}
      gl={{
        alpha: true,
        antialias: !lowPower,
        powerPreference: lowPower ? 'low-power' : 'default',
        premultipliedAlpha: false,
      }}
      onCreated={({ gl, invalidate }) => {
        gl.setClearColor(0x000000, 0)
        gl.outputColorSpace = THREE.SRGBColorSpace
        invalidate()
      }}
      // Soft-GL / lite: never spin at 60fps on the CPU — starves Search + Lenis.
      frameloop={active && !reducedMotion && !lowPower ? 'always' : 'demand'}
      style={{ width: '100%', height: '100%' }}
    >
      <FooterEarthScene active={active} reducedMotion={reducedMotion} />
    </Canvas>
  )
}

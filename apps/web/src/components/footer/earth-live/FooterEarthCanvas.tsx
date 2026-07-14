'use client'

import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

import { FooterEarthScene } from '@/components/footer/earth-live/FooterEarthScene'
import {
  acquireEarthWebGLSlot,
  globePixelRatioCap,
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

  useEffect(() => {
    if (!acquireEarthWebGLSlot(SLOT_TOKEN)) {
      onUnavailable?.()
    }

    return () => {
      if (!releasedRef.current) {
        releaseEarthWebGLSlot(SLOT_TOKEN)
        releasedRef.current = true
      }
    }
  }, [onUnavailable])

  return (
    <Canvas
      className="earth-backdrop__webgl"
      orthographic
      dpr={globePixelRatioCap(2)}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        premultipliedAlpha: false,
      }}
      onCreated={({ gl, invalidate }) => {
        gl.setClearColor(0x000000, 0)
        gl.outputColorSpace = THREE.SRGBColorSpace
        invalidate()
      }}
      frameloop={active && !reducedMotion ? 'always' : 'demand'}
      style={{ width: '100%', height: '100%' }}
    >
      <FooterEarthScene active={active} reducedMotion={reducedMotion} />
    </Canvas>
  )
}

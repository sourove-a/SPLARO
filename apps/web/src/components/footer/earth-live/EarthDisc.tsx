'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

import {
  FOOTER_EARTH_IMAGE_ASPECT,
  FOOTER_EARTH_ROTATION_SECONDS,
  FOOTER_EARTH_TEXTURE_PNG,
} from '@/components/footer/earth-live/constants'
import {
  earthDiscFragmentShader,
  earthDiscVertexShader,
} from '@/components/footer/earth-live/shaders/earth-disc'

type EarthDiscProps = {
  active: boolean
  reducedMotion: boolean
}

/**
 * Fills the disc-anchor square — CSS handles position; WebGL only rotates texture.
 */
export function EarthDisc({ active, reducedMotion }: EarthDiscProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const { size } = useThree()

  const planeSize = Math.max(size.width, size.height, 1)

  const texture = useTexture(FOOTER_EARTH_TEXTURE_PNG, (map) => {
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    map.minFilter = THREE.LinearFilter
    map.magFilter = THREE.LinearFilter
  })

  const uniforms = useMemo(
    () => ({
      uMap: { value: texture },
      uAngle: { value: 0 },
      uTexAspect: { value: FOOTER_EARTH_IMAGE_ASPECT },
    }),
    [texture],
  )

  const rotationSpeed = (2 * Math.PI) / FOOTER_EARTH_ROTATION_SECONDS

  useFrame((_, delta) => {
    const material = materialRef.current
    if (!material || !active || reducedMotion) return
    const angle = material.uniforms.uAngle
    if (!angle) return
    angle.value += delta * rotationSpeed
  })

  return (
    <mesh renderOrder={0}>
      <planeGeometry args={[planeSize, planeSize]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={earthDiscVertexShader}
        fragmentShader={earthDiscFragmentShader}
        transparent
        depthWrite={false}
      />
    </mesh>
  )
}

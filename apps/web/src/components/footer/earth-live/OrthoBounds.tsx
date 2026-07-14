'use client'

import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Fixed orthographic camera — matches footer stage pixels; never pans or zooms. */
export function OrthoBounds() {
  const { camera, size } = useThree()

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return

    const { width, height } = size
    camera.left = -width / 2
    camera.right = width / 2
    camera.top = height / 2
    camera.bottom = -height / 2
    camera.near = 0.1
    camera.far = 100
    camera.position.set(0, 0, 10)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, size])

  return null
}

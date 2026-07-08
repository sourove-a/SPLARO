'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils/cn'

import { EARTH_TEXTURE_URLS } from '@/lib/earth/textures'

const TEXTURES = EARTH_TEXTURE_URLS

export type EarthGlobeVariant = 'story' | 'footer'

const STORY_CONFIG = {
  radius: 1,
  fov: 36,
  camera: { x: 0, y: 0.12, z: 2.85 },
  groupY: -0.02,
  groupScale: 1,
  rotationSpeed: 0.09,
  wobble: 0.035,
  segments: 128,
  wireSegments: 64,
  earthOpacity: 0.96,
  wireOpacity: 0.055,
  atmosphereStrength: 0.22,
  sparkleCount: 900,
  sparkleKeep: 0.58,
  pixelRatioCap: 3,
  orbitMultiplier: 1,
} as const

const FOOTER_CONFIG = {
  radius: 1,
  fov: 40,
  camera: { x: 0, y: 0.02, z: 2.45 },
  lookAtY: -0.08,
  groupScale: 1.34,
  groupY: -0.1,
  tiltX: -0.36,
  /** Middle East / Asia / Africa — natural land-forward (matches footer reference) */
  initialRotationY: 1.28,
  rotationSpeedY: 0.036,
  rotationSpeedX: 0.014,
  roll: 0.012,
  wobble: 0.008,
  segments: 128,
  pixelRatioCap: 3,
  maxWideBoost: 1.28,
  /** Portrait / mobile — bigger earth, richer colors */
  compactScaleBoost: 1.2,
  compactCameraZ: 2.22,
  compactAtmoStrength: 0.2,
  compactNightOpacity: 0.14,
  compactSunIntensity: 1.28,
  atmoInner: { color: 0x1a2838, strength: 0.2, topBoost: 0.1, scale: 1.086 },
  atmoOuter: { color: 0x243040, strength: 0.07, topBoost: 0.12, scale: 1.102 },
  moon: {
    radius: 0.155,
    x: 2.05,
    y: 0.1,
    z: 0.3,
    rotationSpeed: 0.011,
    /** Gentle drift — slow ellipse so the moon feels alive, not static. */
    flowSpeed: 0.13,
    flowX: 0.1,
    flowY: 0.048,
    flowZ: 0.065,
  },
} as const

function isCompactFooterViewport(width = window.innerWidth) {
  return width < 1024
}

function createOrbitArc(
  radiusX: number,
  radiusY: number,
  color: number,
  opacity: number,
): THREE.Line {
  const curve = new THREE.EllipseCurve(0, 0, radiusX, radiusY, 0, Math.PI * 2, false, 0)
  const points = curve.getPoints(180).map((p) => new THREE.Vector3(p.x, 0, p.y))
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  return new THREE.Line(geometry, material)
}

function createPremiumFooterAtmosphere(
  color: number,
  strength: number,
  topBoost: number,
  radius: number,
): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 96),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uStrength: { value: strength },
        uTopBoost: { value: topBoost },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uStrength;
        uniform float uTopBoost;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float fresnel = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.35);
          float top = pow(clamp(vNormal.y + 0.18, 0.0, 1.0), 1.55);
          float glow = fresnel * uStrength + top * uTopBoost;
          gl_FragColor = vec4(uColor, glow);
        }
      `,
    }),
  )
}

function createMuranoGlassShell(radius: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 96),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mvPosition.xyz);
          vPos = position;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vPos;
        void main() {
          float fresnel = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.4);
          float swirl = sin(vPos.x * 4.2 + vPos.y * 3.1 + uTime * 0.12) * 0.5 + 0.5;
          float ripple = sin(vPos.z * 5.5 - uTime * 0.18 + vPos.y * 2.2) * 0.5 + 0.5;
          vec3 deep = vec3(0.14, 0.2, 0.28);
          vec3 murano = mix(deep, vec3(0.38, 0.48, 0.58), swirl * 0.35);
          murano = mix(murano, vec3(0.52, 0.44, 0.58), ripple * 0.18);
          vec3 lightDir = normalize(vec3(0.15, 0.92, 0.35));
          float spec = pow(max(dot(reflect(-vView, vNormal), lightDir), 0.0), 18.0);
          float glass = fresnel * 0.28 + spec * 0.2 + swirl * 0.03;
          gl_FragColor = vec4(murano, glass * 0.34);
        }
      `,
    }),
  )
}

function createAtmosphere(color: number, strength: number, radius: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 72, 72),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uStrength: { value: strength },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uStrength;
        varying vec3 vNormal;
        void main() {
          float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.4);
          gl_FragColor = vec4(uColor, rim * uStrength);
        }
      `,
    }),
  )
}

function setTextureQuality(texture: THREE.Texture, renderer: THREE.WebGLRenderer) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
}

function buildFooterStarfield(count: number): THREE.Points {
  const positions: number[] = []
  const sizes: number[] = []
  const alphas: number[] = []
  const phases: number[] = []
  const speeds: number[] = []

  let placed = 0
  let attempts = 0
  while (placed < count && attempts < count * 10) {
    attempts++
    const r = 4.8 + Math.random() * 8.5
    const phi = Math.acos(1 - 2 * Math.random())
    const theta = Math.random() * Math.PI * 2
    const x = r * Math.sin(phi) * Math.cos(theta)
    const y = r * Math.sin(phi) * Math.sin(theta)
    const z = r * Math.cos(phi)

    const sideWeight = Math.abs(x) / r
    const keepChance = sideWeight * 0.68 + 0.22
    if (Math.random() > keepChance) continue

    positions.push(x, y, z)
    sizes.push(0.01 + Math.random() * 0.026)
    alphas.push(0.38 + Math.random() * 0.62)
    phases.push(Math.random() * Math.PI * 2)
    speeds.push(0.5 + Math.random() * 2.8)
    placed++
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1))
  geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1))
  geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1))
  geometry.setAttribute('speed', new THREE.Float32BufferAttribute(speeds, 1))

  return new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xffffff) },
        uTint: { value: new THREE.Color(0xc8dcf0) },
      },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute float phase;
        attribute float speed;
        uniform float uTime;
        varying float vAlpha;
        varying float vTwinkle;
        varying float vSize;
        void main() {
          vAlpha = alpha;
          vSize = size;
          float pulse = sin(uTime * speed + phase);
          float shimmer = sin(uTime * speed * 2.35 + phase * 1.7) * 0.5 + 0.5;
          vTwinkle = 0.38 + 0.62 * (0.5 + 0.5 * pulse) * (0.65 + 0.35 * shimmer);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z) * (0.85 + 0.3 * shimmer);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uTint;
        varying float vAlpha;
        varying float vTwinkle;
        varying float vSize;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;
          float core = smoothstep(0.5, 0.04, d);
          float halo = smoothstep(0.5, 0.18, d) * 0.35;
          float soft = core + halo;
          vec3 col = mix(uTint, uColor, 0.62 + vSize * 8.0);
          float cross = max(0.0, 0.14 - abs(c.x)) * max(0.0, 0.04 - abs(c.y)) * 6.0;
          col += vec3(cross) * vTwinkle;
          gl_FragColor = vec4(col, soft * vAlpha * vTwinkle);
        }
      `,
    }),
  )
}

interface EarthGlobeProps {
  variant?: EarthGlobeVariant
  className?: string
}

export function EarthGlobe({ variant = 'story', className }: EarthGlobeProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const isFooter = variant === 'footer'
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let disposed = false

    const scene = new THREE.Scene()
    const config = isFooter ? FOOTER_CONFIG : STORY_CONFIG
    const camera = new THREE.PerspectiveCamera(config.fov, 1, 0.1, 40)
    camera.position.set(config.camera.x, config.camera.y, config.camera.z)
    if (isFooter) {
      camera.lookAt(0, FOOTER_CONFIG.lookAtY, 0)
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ReinhardToneMapping
    renderer.toneMappingExposure = isFooter && isCompactFooterViewport() ? 1.16 : isFooter ? 1.2 : 1
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.pixelRatioCap))
    host.appendChild(renderer.domElement)

    const root = new THREE.Group()
    if (isFooter) {
      root.rotation.x = FOOTER_CONFIG.tiltX
      root.rotation.y = FOOTER_CONFIG.initialRotationY
      root.position.y = FOOTER_CONFIG.groupY
      root.scale.setScalar(FOOTER_CONFIG.groupScale)
    } else {
      root.position.y = STORY_CONFIG.groupY
      root.scale.setScalar(STORY_CONFIG.groupScale)
    }
    scene.add(root)

    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    const textures: THREE.Texture[] = []
    const disposables: Array<THREE.BufferGeometry | THREE.Material> = []

    let orbitGroup: THREE.Group | null = null
    let starMaterial: THREE.ShaderMaterial | null = null
    let glassMaterial: THREE.ShaderMaterial | null = null
    let moonGroup: THREE.Group | null = null

    const renderFrame = () => {
      if (!disposed) renderer.render(scene, camera)
    }

    const markEarthReady = () => {
      if (!disposed) host.dataset.earthReady = 'true'
    }

    const onDayTextureReady = () => {
      if (!disposed) {
        markEarthReady()
        renderFrame()
      }
    }

    const onTextureReady = () => {
      if (!disposed) renderFrame()
    }

    if (isFooter) {
      const compact = isCompactFooterViewport()
      const segments = FOOTER_CONFIG.segments
      const stars = buildFooterStarfield(compact ? 1000 : 1600)
      starMaterial = stars.material as THREE.ShaderMaterial
      scene.add(stars)
      disposables.push(stars.geometry, stars.material as THREE.Material)

      const dayMap = loader.load(TEXTURES.day, onDayTextureReady)
      const bumpMap = loader.load(TEXTURES.bump, onTextureReady)
      const nightMap = loader.load(TEXTURES.night, onTextureReady)
      const cloudMap = loader.load(TEXTURES.clouds, onTextureReady)
      const moonMap = loader.load(TEXTURES.moon, onTextureReady)
      textures.push(dayMap, nightMap, bumpMap, cloudMap, moonMap)
      ;[dayMap, nightMap, bumpMap, cloudMap, moonMap].forEach((t) => setTextureQuality(t, renderer))

      const dayGeo = new THREE.SphereGeometry(FOOTER_CONFIG.radius, segments, segments)
      const dayMat = new THREE.MeshStandardMaterial({
        map: dayMap,
        bumpMap,
        bumpScale: compact ? 0.048 : 0.042,
        roughness: 0.9,
        metalness: 0.02,
      })
      root.add(new THREE.Mesh(dayGeo, dayMat))
      disposables.push(dayGeo, dayMat)

      const cloudGeo = new THREE.SphereGeometry(FOOTER_CONFIG.radius * 1.004, segments, segments)
      const cloudMat = new THREE.MeshPhongMaterial({
        map: cloudMap,
        transparent: true,
        opacity: compact ? 0.15 : 0.17,
        depthWrite: false,
        specular: new THREE.Color(0x222222),
        shininess: 4,
      })
      root.add(new THREE.Mesh(cloudGeo, cloudMat))
      disposables.push(cloudGeo, cloudMat)

      const nightGeo = new THREE.SphereGeometry(FOOTER_CONFIG.radius * 1.006, segments, segments)
      const nightMat = new THREE.MeshBasicMaterial({
        map: nightMap,
        transparent: true,
        opacity: compact ? FOOTER_CONFIG.compactNightOpacity : 0.17,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      root.add(new THREE.Mesh(nightGeo, nightMat))
      disposables.push(nightGeo, nightMat)

      const atmoInner = createPremiumFooterAtmosphere(
        FOOTER_CONFIG.atmoInner.color,
        compact ? FOOTER_CONFIG.atmoInner.strength * 0.88 : FOOTER_CONFIG.atmoInner.strength,
        compact ? FOOTER_CONFIG.atmoInner.topBoost * 0.9 : FOOTER_CONFIG.atmoInner.topBoost,
        FOOTER_CONFIG.radius * FOOTER_CONFIG.atmoInner.scale,
      )
      root.add(atmoInner)
      disposables.push(atmoInner.geometry, atmoInner.material as THREE.Material)

      const atmoOuter = createPremiumFooterAtmosphere(
        FOOTER_CONFIG.atmoOuter.color,
        compact ? FOOTER_CONFIG.atmoOuter.strength * 0.9 : FOOTER_CONFIG.atmoOuter.strength,
        compact ? FOOTER_CONFIG.atmoOuter.topBoost * 0.92 : FOOTER_CONFIG.atmoOuter.topBoost,
        FOOTER_CONFIG.radius * FOOTER_CONFIG.atmoOuter.scale,
      )
      root.add(atmoOuter)
      disposables.push(atmoOuter.geometry, atmoOuter.material as THREE.Material)

      const glassShell = createMuranoGlassShell(FOOTER_CONFIG.radius * 1.014)
      glassMaterial = glassShell.material as THREE.ShaderMaterial
      root.add(glassShell)
      disposables.push(glassShell.geometry, glassShell.material as THREE.Material)

      scene.add(new THREE.AmbientLight(0x2a2530, compact ? 0.38 : 0.34))
      scene.add(new THREE.HemisphereLight(0xd8ecf8, 0x120e0a, compact ? 0.5 : 0.46))
      const sun = new THREE.DirectionalLight(
        0xeaf6ff,
        compact ? FOOTER_CONFIG.compactSunIntensity : 1.3,
      )
      sun.position.set(2.8, 5.2, 3.4)
      scene.add(sun)
      const limb = new THREE.DirectionalLight(0x2a4058, compact ? 0.1 : 0.12)
      limb.position.set(0, 7, 1.2)
      scene.add(limb)
      const fill = new THREE.DirectionalLight(0xc8b8a0, compact ? 0.14 : 0.12)
      fill.position.set(-2.8, 0.25, 3)
      scene.add(fill)
      const land = new THREE.DirectionalLight(0xfff8ee, compact ? 0.18 : 0.16)
      land.position.set(1.5, 0.6, 5)
      scene.add(land)

      moonGroup = new THREE.Group()
      moonGroup.position.set(
        FOOTER_CONFIG.moon.x,
        FOOTER_CONFIG.moon.y,
        FOOTER_CONFIG.moon.z,
      )
      const moonGeo = new THREE.SphereGeometry(FOOTER_CONFIG.moon.radius, 40, 40)
      const moonMat = new THREE.MeshPhongMaterial({
        map: moonMap,
        bumpMap: moonMap,
        bumpScale: 0.018,
        specular: new THREE.Color(0x111111),
        shininess: 4,
      })
      moonGroup.add(new THREE.Mesh(moonGeo, moonMat))
      disposables.push(moonGeo, moonMat)

      const moonGlowGeo = new THREE.SphereGeometry(FOOTER_CONFIG.moon.radius * 1.32, 32, 32)
      const moonGlowMat = new THREE.MeshBasicMaterial({
        color: 0x8898a8,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      moonGroup.add(new THREE.Mesh(moonGlowGeo, moonGlowMat))
      disposables.push(moonGlowGeo, moonGlowMat)
      scene.add(moonGroup)

      if (
        dayMap.image &&
        'complete' in dayMap.image &&
        (dayMap.image as HTMLImageElement).complete
      ) {
        onDayTextureReady()
      }

      renderFrame()
    } else {
      const nightMap = loader.load(TEXTURES.night, onTextureReady)
      textures.push(nightMap)
      setTextureQuality(nightMap, renderer)

      const oceanGeo = new THREE.SphereGeometry(STORY_CONFIG.radius * 0.998, STORY_CONFIG.segments, STORY_CONFIG.segments)
      const oceanMat = new THREE.MeshPhongMaterial({
        color: 0x14283a,
        emissive: 0x081018,
        shininess: 28,
        specular: 0x223344,
      })
      root.add(new THREE.Mesh(oceanGeo, oceanMat))
      disposables.push(oceanGeo, oceanMat)

      const earthGeo = new THREE.SphereGeometry(STORY_CONFIG.radius, STORY_CONFIG.segments, STORY_CONFIG.segments)
      const earthMat = new THREE.MeshBasicMaterial({
        map: nightMap,
        transparent: true,
        opacity: STORY_CONFIG.earthOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      root.add(new THREE.Mesh(earthGeo, earthMat))
      disposables.push(earthGeo, earthMat)

      const wireGeo = new THREE.SphereGeometry(STORY_CONFIG.radius * 1.002, STORY_CONFIG.wireSegments, STORY_CONFIG.wireSegments)
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xc8a97e,
        wireframe: true,
        transparent: true,
        opacity: STORY_CONFIG.wireOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      root.add(new THREE.Mesh(wireGeo, wireMat))
      disposables.push(wireGeo, wireMat)

      const atmo = createAtmosphere(0x6f9ab8, STORY_CONFIG.atmosphereStrength, STORY_CONFIG.radius * 1.07)
      root.add(atmo)
      disposables.push(atmo.geometry, atmo.material as THREE.Material)

      const equator = createOrbitArc(1.03, 1.03, 0xc8a97e, 0.1)
      equator.rotation.x = Math.PI / 2
      root.add(equator)
      disposables.push(equator.geometry, equator.material as THREE.Material)

      orbitGroup = new THREE.Group()
      const orbitSpecs = [
        { rx: 1.5, ry: 1.08, color: 0x8eb4d4, opacity: 0.2, tiltX: 1.18, tiltY: 0.28 },
        { rx: 1.68, ry: 1.2, color: 0x6f98b8, opacity: 0.14, tiltX: 0.58, tiltY: 0.92 },
        { rx: 1.34, ry: 1.28, color: 0xa8c6de, opacity: 0.16, tiltX: 1.42, tiltY: -0.36 },
      ]
      orbitSpecs.forEach((spec) => {
        const arc = createOrbitArc(spec.rx, spec.ry, spec.color, spec.opacity)
        arc.rotation.x = spec.tiltX
        arc.rotation.y = spec.tiltY
        orbitGroup!.add(arc)
        disposables.push(arc.geometry, arc.material as THREE.Material)
      })
      root.add(orbitGroup)

      scene.add(new THREE.AmbientLight(0x405068, 0.55))
      const keyLight = new THREE.DirectionalLight(0xd8e8f8, 0.85)
      keyLight.position.set(2.5, 1.2, 3)
      scene.add(keyLight)
      const rimLight = new THREE.DirectionalLight(0xc8a97e, 0.35)
      rimLight.position.set(-2, -0.5, -2)
      scene.add(rimLight)

      const pointPositions: number[] = []
      const pointSizes: number[] = []
      for (let i = 0; i < STORY_CONFIG.sparkleCount; i++) {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / STORY_CONFIG.sparkleCount)
        const theta = Math.PI * (1 + Math.sqrt(5)) * i
        if (Math.random() > STORY_CONFIG.sparkleKeep) continue
        pointPositions.push(
          STORY_CONFIG.radius * Math.sin(phi) * Math.cos(theta),
          STORY_CONFIG.radius * Math.sin(phi) * Math.sin(theta),
          STORY_CONFIG.radius * Math.cos(phi),
        )
        pointSizes.push(0.014 + Math.random() * 0.018)
      }
      const pointGeom = new THREE.BufferGeometry()
      pointGeom.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3))
      pointGeom.setAttribute('size', new THREE.Float32BufferAttribute(pointSizes, 1))
      const sparkles = new THREE.Points(
        pointGeom,
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uColor: { value: new THREE.Color(0xe8d4b0) } },
          vertexShader: `
            attribute float size;
            void main() {
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = size * (300.0 / -mvPosition.z);
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
          fragmentShader: `
            uniform vec3 uColor;
            void main() {
              vec2 c = gl_PointCoord - vec2(0.5);
              float d = length(c);
              if (d > 0.5) discard;
              float soft = smoothstep(0.5, 0.05, d);
              gl_FragColor = vec4(uColor, soft * 0.7);
            }
          `,
        }),
      )
      root.add(sparkles)
      disposables.push(pointGeom, sparkles.material as THREE.Material)
    }

    const applyFooterFraming = (width: number, height: number) => {
      const compact = isCompactFooterViewport(width)
      const aspect = width / height
      const wideBoost = Math.min(
        FOOTER_CONFIG.maxWideBoost,
        1 + Math.max(0, aspect - 1.1) * 0.24,
      )
      const portraitBoost =
        aspect < 1
          ? Math.min(1.16, 1 + (1 - aspect) * 0.22)
          : 1
      const compactBoost = compact ? FOOTER_CONFIG.compactScaleBoost * portraitBoost : 1
      const scale = FOOTER_CONFIG.groupScale * wideBoost * compactBoost
      root.scale.setScalar(scale)
      const baseZ = compact ? FOOTER_CONFIG.compactCameraZ : FOOTER_CONFIG.camera.z
      camera.position.z = baseZ + (scale - FOOTER_CONFIG.groupScale) * 0.62
      root.position.y = compact ? FOOTER_CONFIG.groupY - 0.06 : FOOTER_CONFIG.groupY
      camera.position.y = compact ? FOOTER_CONFIG.camera.y + 0.05 : FOOTER_CONFIG.camera.y
      camera.lookAt(0, FOOTER_CONFIG.lookAtY, 0)
      renderer.toneMappingExposure = compact ? 1.16 : 1.2
    }

    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      if (width < 1 || height < 1) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.pixelRatioCap))
      renderer.setSize(width, height, false)

      if (isFooter) {
        applyFooterFraming(width, height)
      }
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)

    let frameId = 0
    let running = true
    const startedAt = performance.now()

    if (!isFooter) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          running = entry?.isIntersecting ?? true
        },
        { threshold: 0, rootMargin: '0px' },
      )
      observer.observe(host)

      const rotationSpeedY = STORY_CONFIG.rotationSpeed
      const wobble = STORY_CONFIG.wobble

      const animate = () => {
        if (disposed) return
        frameId = window.requestAnimationFrame(animate)
        if (!running || reducedMotion) return

        const t = (performance.now() - startedAt) / 1000
        root.rotation.y = t * rotationSpeedY
        root.rotation.x = Math.sin(t * 0.14) * wobble
        if (orbitGroup) {
          orbitGroup.rotation.y = t * 0.025
          orbitGroup.children.forEach((child, index) => {
            const line = child as THREE.Line
            const mat = line.material as THREE.LineBasicMaterial
            mat.opacity = 0.1 + Math.sin(t * 0.45 + index * 1.2) * 0.04
            line.rotation.z = t * (0.035 + index * 0.01) * (index % 2 === 0 ? 1 : -1)
          })
        }

        renderFrame()
      }

      if (!reducedMotion) animate()
      else renderFrame()

      return () => {
        disposed = true
        running = false
        window.cancelAnimationFrame(frameId)
        observer.disconnect()
        resizeObserver.disconnect()
        textures.forEach((t) => t.dispose())
        disposables.forEach((d) => d.dispose())
        renderer.dispose()
        if (renderer.domElement.parentNode === host) {
          host.removeChild(renderer.domElement)
        }
      }
    }

    const rotationSpeedY = FOOTER_CONFIG.rotationSpeedY
    const rotationSpeedX = FOOTER_CONFIG.rotationSpeedX
    const wobble = FOOTER_CONFIG.wobble
    const roll = FOOTER_CONFIG.roll

    const animate = () => {
      if (disposed) return
      frameId = window.requestAnimationFrame(animate)
      if (reducedMotion) return

      const t = (performance.now() - startedAt) / 1000
      root.rotation.y = FOOTER_CONFIG.initialRotationY + t * rotationSpeedY
      root.rotation.x =
        FOOTER_CONFIG.tiltX + t * rotationSpeedX + Math.sin(t * 0.14) * wobble
      root.rotation.z = Math.sin(t * 0.11) * roll
      if (starMaterial?.uniforms.uTime) {
        starMaterial.uniforms.uTime.value = t
      }
      if (glassMaterial?.uniforms.uTime) {
        glassMaterial.uniforms.uTime.value = t
      }
      if (moonGroup) {
        const moon = FOOTER_CONFIG.moon
        const flow = t * moon.flowSpeed
        moonGroup.rotation.y = t * moon.rotationSpeed
        moonGroup.position.set(
          moon.x + Math.cos(flow) * moon.flowX,
          moon.y + Math.sin(flow * 1.22) * moon.flowY,
          moon.z + Math.sin(flow * 0.88) * moon.flowZ,
        )
      }

      renderFrame()
    }

    if (!reducedMotion) animate()
    else renderFrame()

    return () => {
      disposed = true
      running = false
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      textures.forEach((t) => t.dispose())
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement)
      }
    }
  }, [variant])

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none', className)}
      aria-hidden
    />
  )
}

/** @type {import('next').NextConfig} */
const apiOrigin = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ?? 'http://localhost:4000'
const isProd = process.env.NODE_ENV === 'production'
const cdnOrigin = process.env.NEXT_PUBLIC_CDN_URL?.replace(/\/$/, '')
/** Contabo VPS (same-box web+api). SPLARO_HOSTINGER=1 is a legacy alias only. */
const onSameBoxVps =
  process.env.SPLARO_VPS === '1' || process.env.SPLARO_HOSTINGER === '1'

const connectSrc = [
  "'self'",
  apiOrigin,
  ...(isProd ? [] : ['http://localhost:4000', 'http://127.0.0.1:4000']),
  'https://splaro.co',
  'https://api.splaro.co',
  'https://www.google-analytics.com',
  'https://accounts.google.com',
  'https://oauth2.googleapis.com',
  'https://www.googleapis.com',
  'https://www.facebook.com',
  'https://connect.facebook.net',
]
  .filter(Boolean)
  .join(' ')

// cdn.splaro.co and cdn.splaro.com.bd are planned CDN hosts but not in DNS yet —
// do not allowlist dead origins in production CSP (assets use splaro.co + R2).
const cspImgSrc = [
  "'self'",
  'data:',
  'blob:',
  'https://splaro.co',
  'https://splaro.com.bd',
  'https://*.r2.cloudflarestorage.com',
  'https://images.unsplash.com',
  'https://images.pexels.com',
  'https://media.aarong.com',
  'https://placehold.co',
  'https://cdn.jsdelivr.net',
  'https://raw.githubusercontent.com',
  'https://www.solarsystemscope.com',
  'https://www.facebook.com',
].join(' ')

const cspMediaSrc = [
  "'self'",
  'blob:',
  'https://splaro.co',
  'https://splaro.com.bd',
  'https://*.r2.cloudflarestorage.com',
  'https:',
].join(' ')

const nextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion/react', 'date-fns'],
    // CloudLinux NPROC counts threads — parallel build workers get the process killed
    ...(onSameBoxVps ? { cpus: 1, workerThreads: false } : {}),
  },
  eslint: {
    ignoreDuringBuilds: onSameBoxVps,
  },
  typescript: {
    ignoreBuildErrors: onSameBoxVps,
  },

  images: {
    // Dev always unoptimized. Prod same-box VPS: unoptimized (sharp would peg CPU).
    // Only enable optimizer when deliberately on a CDN/edge worker without SPLARO_VPS.
    unoptimized: !isProd || onSameBoxVps,
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.splaro.co' },
      { protocol: 'https', hostname: 'splaro.co' },
      { protocol: 'https', hostname: 'cdn.splaro.com.bd' },
      { protocol: 'https', hostname: 'splaro.com.bd' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      {
        protocol: 'https',
        hostname: 'media.aarong.com',
        pathname: '/media/catalog/product/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3000',
        pathname: '/uploads/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [375, 640, 750, 828, 1080, 1200, 1440, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512, 640],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  async headers() {
    if (!isProd) return []

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // No app code or dependency (incl. three.js) calls eval()/new Function() in
              // production, so 'unsafe-eval' is dropped. 'unsafe-inline' stays — GTM/FB
              // pixel and Next.js hydration inline scripts need a nonce-based CSP to
              // remove safely, which needs its own dedicated rollout/testing pass.
              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://accounts.google.com https://apis.google.com https://connect.facebook.net",
              "style-src 'self' 'unsafe-inline' https://accounts.google.com",
              `img-src ${cspImgSrc}`,
              `media-src ${cspMediaSrc}`,
              "font-src 'self' data: https://fonts.gstatic.com",
              `connect-src ${connectSrc}`,
              // youtube-nocookie: Instagram/social reels embed on the homepage story
              // section (SocialReelsDropdown → ReelCard iframe) — 'none' silently
              // blocked every reel video with no visible error, just a dead player.
              // accounts.google.com: Google Identity Services button iframe (login/signup).
              "frame-src 'self' https://www.youtube-nocookie.com https://accounts.google.com",
            ].join('; '),
          },
        ],
      },
      {
        source: '/fonts/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/((?!_next/static|_next/image|fonts|images|favicon).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, max-age=0',
          },
        ],
      },
    ]
  },

  async rewrites() {
    const rules = []
    const apiPort = process.env.API_PORT ?? process.env.PORT_API ?? '4000'
    rules.push({
      source: '/api/v1/:path*',
      destination: `http://127.0.0.1:${apiPort}/api/v1/:path*`,
    })
    if (cdnOrigin) {
      rules.push({
        source: '/uploads/:path*',
        destination: `${cdnOrigin}/uploads/:path*`,
      })
    }
    return rules
  },

  async redirects() {
    return [
      { source: '/wishlist', destination: '/account?tab=wishlist', permanent: false },
      { source: '/account/wishlist', destination: '/account?tab=wishlist', permanent: false },
    ]
  },
}

export default nextConfig

import type { NextConfig } from 'next'

const apiOrigin = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ?? 'http://localhost:4000'
const isProd = process.env.NODE_ENV === 'production'
const cdnOrigin = process.env.NEXT_PUBLIC_CDN_URL?.replace(/\/$/, '')

const connectSrc = [
  "'self'",
  apiOrigin,
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'https://splaro.co',
  'https://api.splaro.co',
  'https://www.google-analytics.com',
  'https://www.facebook.com',
  'https://connect.facebook.net',
]
  .filter(Boolean)
  .join(' ')

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'date-fns'],
  },
  eslint: {
    // Lint runs in CI via pnpm lint — do not skip silently in production builds.
    ignoreDuringBuilds: false,
  },

  images: {
    unoptimized: !isProd,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.splaro.com.bd',
      },
      {
        protocol: 'https',
        hostname: 'cdn.splaro.co',
      },
      {
        protocol: 'https',
        hostname: 'splaro.co',
      },
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: 'splaro.com.bd',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
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
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  async headers() {
    // Strict CSP + HSTS break localhost dev (styles/fonts/cache). Production only.
    if (!isProd) {
      return []
    }

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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://cdn.splaro.com.bd https://cdn.splaro.co https://splaro.co https://*.r2.cloudflarestorage.com https://images.unsplash.com https://media.aarong.com https://placehold.co https://cdn.jsdelivr.net https://raw.githubusercontent.com https://www.solarsystemscope.com",
              "media-src 'self' blob: https://cdn.splaro.com.bd https://cdn.splaro.co https://splaro.co https://*.r2.cloudflarestorage.com https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              `connect-src ${connectSrc}`,
              "frame-src 'none'",
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
        source: '/shop',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/c/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/collections/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
    ]
  },

  async rewrites() {
    const rules: { source: string; destination: string }[] = []
    if (cdnOrigin) {
      rules.push({
        source: '/uploads/:path*',
        destination: `${cdnOrigin}/uploads/:path*`,
      })
    }
    return rules
  },

  async redirects() {
    return []
  },
}

export default nextConfig

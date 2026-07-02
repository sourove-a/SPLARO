import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

const config: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@splaro/database', '@splaro/config', '@splaro/types'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'cdn.splaro.com' },
      { protocol: 'https', hostname: 'cdn.splaro.com.bd' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'media.aarong.com', pathname: '/media/catalog/product/**' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'http', hostname: 'localhost', port: '3000', pathname: '/uploads/**' },
    ],
  },
  async rewrites() {
    const webOrigin = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'
    const web = webOrigin.replace(/\/$/, '')
    return [
      {
        source: '/uploads/:path*',
        destination: `${web}/uploads/:path*`,
      },
      {
        source: '/images/logo/:path*',
        destination: `${web}/images/logo/:path*`,
      },
    ]
  },
  async headers() {
    // Never apply CSP/HSTS in dev — breaks localhost CSS and fonts (see apps/web/next.config.ts).
    if (!isProd) {
      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          ],
        },
      ]
    }

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default config

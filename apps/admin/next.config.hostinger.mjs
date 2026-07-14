/** @type {import('next').NextConfig} */
/**
 * Hostinger shared hosting uses this .mjs (see infrastructure/hostinger/build-admin.sh).
 * Keep in sync with next.config.ts — canonical source for local dev.
 */
const isProd = process.env.NODE_ENV === 'production'
const onHostinger = process.env.SPLARO_HOSTINGER === '1'
const webOrigin = process.env.NEXT_PUBLIC_WEB_URL ?? (isProd ? 'https://splaro.co' : 'http://localhost:3000')
const web = webOrigin.replace(/\/$/, '')
const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.splaro.co').replace(/\/api\/v1\/?$/, '')

const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@splaro/database', '@splaro/config', '@splaro/types'],
  experimental: onHostinger ? { cpus: 1, workerThreads: false } : {},
  eslint: { ignoreDuringBuilds: onHostinger },
  typescript: { ignoreBuildErrors: onHostinger },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'cdn.splaro.co' },
      { protocol: 'https', hostname: 'cdn.splaro.com.bd' },
      { protocol: 'https', hostname: 'splaro.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      {
        protocol: 'https',
        hostname: 'media.aarong.com',
        pathname: '/media/catalog/product/**',
      },
      { protocol: 'https', hostname: 'placehold.co' },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/uploads/**',
      },
    ],
  },
  async rewrites() {
    return [
      { source: '/uploads/:path*', destination: `${web}/uploads/:path*` },
      { source: '/images/logo/:path*', destination: `${web}/images/logo/:path*` },
    ]
  },
  async headers() {
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
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://cdn.splaro.co https://splaro.co https://*.r2.cloudflarestorage.com https://images.unsplash.com https://placehold.co",
              "media-src 'self' blob: https://cdn.splaro.co https://splaro.co https://*.r2.cloudflarestorage.com",
              "font-src 'self' data:",
              `connect-src 'self' ${web} ${apiOrigin}`,
              "frame-src 'none'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig

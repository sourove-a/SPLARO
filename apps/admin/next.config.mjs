/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'
const onHostinger = process.env.SPLARO_HOSTINGER === '1'
const webOrigin = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://splaro.co'
const web = webOrigin.replace(/\/$/, '')

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
        ],
      },
    ]
  },
}

export default nextConfig

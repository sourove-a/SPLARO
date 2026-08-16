import type { NextConfig } from 'next'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Admin HMAC cookies must share ADMIN_SESSION_SECRET with Nest.
 * Next does not auto-load monorepo root `.env` — pull it in at config time.
 */
function loadMonorepoRootEnv() {
  const candidates = [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')]
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue
    for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      if (!key || process.env[key] !== undefined) continue
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
    break
  }
}

loadMonorepoRootEnv()

const isProd = process.env.NODE_ENV === 'production'
const onHostinger = process.env.SPLARO_HOSTINGER === '1'
const webOrigin =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_WEB_URL ??
  (isProd ? 'https://splaro.co' : 'http://localhost:3000')
const web = webOrigin.replace(/\/$/, '')
const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.splaro.co').replace(/\/api\/v1\/?$/, '')

const config: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@splaro/database', '@splaro/config', '@splaro/types'],
  experimental: onHostinger ? { cpus: 1, workerThreads: false } : {},
  // Never hide type/lint errors on build — Hostinger is legacy; CI must stay green.
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'cdn.splaro.co' },
      { protocol: 'https', hostname: 'cdn.splaro.com.bd' },
      { protocol: 'https', hostname: 'splaro.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'vumbnail.com' },
      { protocol: 'https', hostname: 'media.aarong.com', pathname: '/media/catalog/product/**' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'http', hostname: 'localhost', port: '3000', pathname: '/uploads/**' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/mcp',
        destination: '/api/mcp/mcp',
      },
      {
        source: '/mcp/:path*',
        destination: '/api/mcp/:path*',
      },
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

    const securityHeaders = [
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
          "img-src 'self' data: blob: https:",
          "media-src 'self' blob: https:",
          "font-src 'self' data:",
          `connect-src 'self' ${web} ${apiOrigin}`,
          "frame-src 'none'",
          "object-src 'none'",
          // Stops an injected <base> tag from re-pointing every relative script URL.
          "base-uri 'self'",
          // Modern equivalent of the X-Frame-Options header above (clickjacking).
          "frame-ancestors 'none'",
          // Admin posts only to its own BFF routes.
          "form-action 'self'",
        ].join('; '),
      },
    ]

    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default config

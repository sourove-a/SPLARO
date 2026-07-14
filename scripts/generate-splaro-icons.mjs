#!/usr/bin/env node
/**
 * Generate unified SPLARO tab / PWA / favicon icons for web + admin.
 * Black premium wordmark on white — clean tab chrome (Mac, Windows, phones).
 */
import { createRequire } from 'module'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../apps/admin/package.json'))
const sharp = require('sharp')

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** Native black premium Arabic + SPLARO lockup (transparent). */
const SRC = resolve(ROOT, 'apps/web/public/images/logo/splaro-logo-black-premium.png')
const BG = { r: 255, g: 255, b: 255, alpha: 1 }

const TARGETS = [
  resolve(ROOT, 'apps/admin/public/images/logo'),
  resolve(ROOT, 'apps/web/public/images/logo'),
]

const FILES = [
  { size: 16, name: 'splaro-brand-mark-tab-16.png', padding: 0.14 },
  { size: 32, name: 'splaro-brand-mark-tab.png', padding: 0.12 },
  { size: 48, name: 'splaro-brand-mark-tab-48.png', padding: 0.12 },
  { size: 64, name: 'splaro-admin-icon.png', padding: 0.12 },
  { size: 180, name: 'splaro-brand-mark-tab-180.png', padding: 0.1 },
  { size: 192, name: 'splaro-brand-mark-tab-192.png', padding: 0.1 },
  { size: 512, name: 'splaro-brand-mark-tab-512.png', padding: 0.1 },
]

/** PNG-in-ICO container — trusted by Windows Edge/Chrome for /favicon.ico */
function encodeIco(entries) {
  const count = entries.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  let offset = 6 + 16 * count
  const dir = []
  const blobs = []
  for (const item of entries) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(item.width >= 256 ? 0 : item.width, 0)
    entry.writeUInt8(item.height >= 256 ? 0 : item.height, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(item.png.length, 8)
    entry.writeUInt32LE(offset, 12)
    dir.push(entry)
    blobs.push(item.png)
    offset += item.png.length
  }
  return Buffer.concat([header, ...dir, ...blobs])
}

async function buildIcon(size, padding) {
  if (!existsSync(SRC)) {
    throw new Error(`Missing premium logo source: ${SRC}`)
  }

  const trimmed = await sharp(SRC).trim({ threshold: 8 }).png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  const inner = Math.round(size * (1 - padding * 2))
  const mark = await sharp(trimmed)
    .resize({
      width: meta.width >= meta.height ? inner : undefined,
      height: meta.height > meta.width ? inner : undefined,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer()

  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toBuffer()
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
}

console.log('\n🖼  SPLARO unified icons (black wordmark on white · Mac + Windows)\n')

const built = new Map()
for (const file of FILES) {
  built.set(file.name, await buildIcon(file.size, file.padding))
  console.log(`  ✅ ${file.name} (${file.size}×${file.size})`)
}

for (const dir of TARGETS) {
  ensureDir(dir)
  for (const file of FILES) {
    await sharp(built.get(file.name)).toFile(resolve(dir, file.name))
  }
}

const ico = encodeIco([
  { width: 16, height: 16, png: built.get('splaro-brand-mark-tab-16.png') },
  { width: 32, height: 32, png: built.get('splaro-brand-mark-tab.png') },
  { width: 48, height: 48, png: built.get('splaro-brand-mark-tab-48.png') },
])

for (const icoPath of [
  resolve(ROOT, 'apps/web/public/favicon.ico'),
  resolve(ROOT, 'apps/admin/public/favicon.ico'),
  resolve(ROOT, 'apps/web/public/icons/favicon.ico'),
]) {
  ensureDir(dirname(icoPath))
  writeFileSync(icoPath, ico)
  console.log(`  ✅ ${icoPath.replace(ROOT + '/', '')}`)
}

const webIcons = resolve(ROOT, 'apps/web/public/icons')
ensureDir(webIcons)
await sharp(built.get('splaro-brand-mark-tab.png')).toFile(resolve(webIcons, 'favicon-32x32.png'))
await sharp(built.get('splaro-brand-mark-tab-180.png')).toFile(resolve(webIcons, 'apple-touch-icon.png'))
await sharp(built.get('splaro-brand-mark-tab-192.png')).toFile(resolve(webIcons, 'icon-192.png'))
await sharp(built.get('splaro-brand-mark-tab-512.png')).toFile(resolve(webIcons, 'icon-512.png'))

const appIcon = built.get('splaro-brand-mark-tab-48.png')
for (const appIconPath of [
  resolve(ROOT, 'apps/admin/src/app/icon.png'),
  resolve(ROOT, 'apps/web/src/app/icon.png'),
]) {
  ensureDir(dirname(appIconPath))
  await sharp(appIcon).toFile(appIconPath)
}

const manifest = {
  name: "SPLARO — Luxury Women's Fashion",
  short_name: 'SPLARO',
  description: 'Timeless luxury women\'s fashion crafted for the modern woman.',
  start_url: '/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#ffffff',
  icons: [
    {
      src: '/images/logo/splaro-brand-mark-tab.png',
      sizes: '32x32',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/images/logo/splaro-brand-mark-tab-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/images/logo/splaro-brand-mark-tab-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
    {
      src: '/images/logo/splaro-brand-mark-tab-180.png',
      sizes: '180x180',
      type: 'image/png',
      purpose: 'any',
    },
  ],
}

writeFileSync(
  resolve(webIcons, 'site.webmanifest'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
console.log('  ✅ apps/web/public/icons/site.webmanifest')

console.log('\n  ↳ synced web + admin (PNG tabs, favicon.ico, PWA 192/512, app icon.png)\n')

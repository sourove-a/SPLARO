#!/usr/bin/env node
/**
 * Generate unified SPLARO tab icons for web + admin (same files, same look).
 * White mark on #111111 — consistent in every browser tab and theme.
 */
import { createRequire } from 'module'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../apps/admin/package.json'))
const sharp = require('sharp')

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(ROOT, 'apps/admin/public/images/logo/splaro-brand-mark-transparent.png')
const BG = { r: 17, g: 17, b: 17, alpha: 1 }

const TARGETS = [
  resolve(ROOT, 'apps/admin/public/images/logo'),
  resolve(ROOT, 'apps/web/public/images/logo'),
]

const FILES = [
  { size: 32, name: 'splaro-brand-mark-tab.png', padding: 0.1 },
  { size: 48, name: 'splaro-brand-mark-tab-48.png', padding: 0.1 },
  { size: 64, name: 'splaro-admin-icon.png', padding: 0.1 },
  { size: 180, name: 'splaro-brand-mark-tab-180.png', padding: 0.1 },
  { size: 192, name: 'splaro-brand-mark-tab-192.png', padding: 0.1 },
]

async function buildIcon(size, padding) {
  const trimmed = await sharp(SRC).trim().negate({ alpha: false }).toBuffer()
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

console.log('\n🖼  SPLARO unified tab icons (web + admin)\n')

const built = new Map()
for (const file of FILES) {
  built.set(file.name, await buildIcon(file.size, file.padding))
  console.log(`  ✅ ${file.name} (${file.size}×${file.size})`)
}

for (const dir of TARGETS) {
  ensureDir(dir)
  for (const file of FILES) {
    const out = resolve(dir, file.name)
    await sharp(built.get(file.name)).toFile(out)
  }
}

const webIcons = resolve(ROOT, 'apps/web/public/icons')
ensureDir(webIcons)
await sharp(built.get('splaro-brand-mark-tab.png')).toFile(resolve(webIcons, 'favicon-32x32.png'))
await sharp(built.get('splaro-brand-mark-tab-180.png')).toFile(resolve(webIcons, 'apple-touch-icon.png'))

const appIcon = built.get('splaro-brand-mark-tab-48.png')
for (const appIconPath of [
  resolve(ROOT, 'apps/admin/src/app/icon.png'),
  resolve(ROOT, 'apps/web/src/app/icon.png'),
]) {
  ensureDir(dirname(appIconPath))
  await sharp(appIcon).toFile(appIconPath)
}

console.log('  ↳ synced to apps/web + apps/admin\n')

#!/usr/bin/env node
/**
 * Admin auth contrast + regression gate (CI-safe, no browser).
 *
 * 1) WCAG AA ratios for locked auth pairs (dark glass + DM violet CTA).
 * 2) Source guard: never paint .admin-auth-card with light foundation surface
 *    while auth type stays light-on-dark.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const surfacesPath = join(root, 'apps/admin/src/styles/admin-surfaces.css')
const globalsPath = join(root, 'apps/admin/src/app/globals.css')

function parseHex(input) {
  const s = String(input).trim()
  if (s.startsWith('#')) {
    const h = s.slice(1)
    if (h.length === 3) {
      return [
        parseInt(h[0] + h[0], 16),
        parseInt(h[1] + h[1], 16),
        parseInt(h[2] + h[2], 16),
        1,
      ]
    }
    if (h.length === 6) {
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]
    }
  }
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])]
  throw new Error(`Unsupported color: ${input}`)
}

function blend(fg, bg) {
  const [fr, fg_, fb, fa] = parseHex(fg)
  const [br, bg_, bb] = parseHex(bg)
  const a = fa
  return [
    Math.round(fr * a + br * (1 - a)),
    Math.round(fg_ * a + bg_ * (1 - a)),
    Math.round(fb * a + bb * (1 - a)),
  ]
}

function channel(c) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(rgb) {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

function contrastRatio(fg, bg) {
  const L1 = luminance(blend(fg, bg))
  const L2 = luminance(parseHex(bg).slice(0, 3))
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Locked pairs — must stay AA after auth theme changes. */
const PAIRS = [
  { name: 'auth title on dark card', fg: 'rgba(255,255,255,0.96)', bg: 'rgba(12,14,20,0.92)', under: '#04070d', min: 4.5 },
  { name: 'auth label on dark card', fg: 'rgba(255,255,255,0.62)', bg: 'rgba(12,14,20,0.92)', under: '#04070d', min: 4.5 },
  { name: 'auth subtitle on dark card', fg: 'rgba(255,255,255,0.55)', bg: 'rgba(12,14,20,0.92)', under: '#04070d', min: 3 },
  { name: 'submit white on DM violet', fg: '#ffffff', bg: '#712eff', min: 4.5 },
]

function effectiveBg(bg, under) {
  if (!under) return bg
  const [r, g, b, a] = parseHex(bg)
  if (a >= 0.999) return `rgb(${r},${g},${b})`
  const blended = blend(bg, under)
  return `rgb(${blended[0]},${blended[1]},${blended[2]})`
}

const failures = []

for (const pair of PAIRS) {
  const bg = effectiveBg(pair.bg, pair.under)
  const ratio = contrastRatio(pair.fg, bg)
  if (ratio < pair.min) {
    failures.push(`${pair.name}: ${ratio.toFixed(2)}:1 < ${pair.min}:1`)
  } else {
    console.log(`OK  ${pair.name}: ${ratio.toFixed(2)}:1`)
  }
}

if (!existsSync(surfacesPath)) {
  failures.push(`missing ${surfacesPath}`)
} else {
  const surfaces = readFileSync(surfacesPath, 'utf8')
  // Regression: white foundation surface on auth card (light text becomes invisible)
  if (
    /\.admin-auth-card[\s\S]{0,400}background:\s*var\(--admin-foundation-surface\)/.test(surfaces) ||
    /\.admin-auth-glass-panel[\s\S]{0,400}background:\s*var\(--admin-foundation-surface\)/.test(surfaces)
  ) {
    failures.push(
      'admin-surfaces.css paints auth card with --admin-foundation-surface (white) — breaks light-on-dark auth type',
    )
  }
  if (!/background:\s*rgba\(12,\s*14,\s*20/.test(surfaces)) {
    failures.push('admin-surfaces.css missing dark auth card background rgba(12, 14, 20, …)')
  }
  if (!/\.admin-auth-submit[\s\S]{0,300}(--admin-c-712eff|--admin-foundation-primary)/.test(surfaces)) {
    failures.push('admin-surfaces.css missing flat DM violet token on .admin-auth-submit')
  }
}

if (existsSync(globalsPath)) {
  const globals = readFileSync(globalsPath, 'utf8')
  // Ensure base auth type stays light (dark cosmos login)
  if (!/\.admin-auth-label[\s\S]{0,200}rgba\(255,\s*255,\s*255/.test(globals)) {
    failures.push('globals.css .admin-auth-label no longer uses light text')
  }
}

if (failures.length) {
  console.error('\nAdmin auth contrast gate FAILED:')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log('\nAdmin auth contrast gate OK')

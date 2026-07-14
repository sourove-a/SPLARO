#!/usr/bin/env node
/**
 * Probe running dev servers — layout.css must return 200 (catches stale .next / 404 CSS).
 * Usage: pnpm css:health
 */
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { isPortListening } from './port-utils.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const targets = [
  { name: 'web', url: 'http://127.0.0.1:3000', port: 3000 },
  { name: 'admin', url: 'http://127.0.0.1:3001', port: 3001 },
]

async function headStatus(url) {
  const res = await fetch(url, {
    method: 'HEAD',
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  })
  return res.status
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  })
  return { status: res.status, html: await res.text() }
}

let failed = 0

console.log('\n🎨 CSS health probe (running dev servers)\n')

for (const t of targets) {
  if (!isPortListening(t.port)) {
    console.log(`  ⏭️  ${t.name} — not running on :${t.port}`)
    continue
  }

  try {
    const { status, html: home } = await fetchHtml(t.url)
    if (status !== 200 && status !== 307) {
      throw new Error(`home returned HTTP ${status}`)
    }

    const cssMatch = home.match(/href="(\/_next\/static\/css\/[^"]+)"/)
    if (!cssMatch) {
      console.log(`  ⚠️  ${t.name} — no layout.css link in HTML (may still be compiling)`)
      continue
    }

    const cssPath = cssMatch[1].split('?')[0]
    const cssStatus = await headStatus(`${t.url}${cssPath}`)
    if (cssStatus !== 200) {
      throw new Error(`layout.css returned HTTP ${cssStatus} — run pnpm css:fix`)
    }

    console.log(`  ✅ ${t.name} — layout.css OK (${cssPath})`)
  } catch (e) {
    console.log(`  ❌ ${t.name}: ${e.message}`)
    failed++
  }
}

const webCssDir = resolve(ROOT, 'apps/web/.next/static/css')
if (existsSync(webCssDir)) {
  console.log(`  ✅ web build has .next/static/css`)
} else {
  console.log(`  ⏭️  web build CSS dir not found (run pnpm build:web to verify production CSS)`)
}

console.log(`\n${'─'.repeat(40)}`)
if (failed > 0) {
  console.log('  Fix: pnpm css:fix  then restart dev servers\n')
  process.exit(1)
}
console.log('  🎉 CSS health OK\n')

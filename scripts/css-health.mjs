#!/usr/bin/env node
/**
 * Probe running dev servers — layout.css must return 200 (catches stale .next / 404 CSS).
 * Usage: pnpm css:health
 */
import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const targets = [
  { name: 'web', url: 'http://localhost:3000', port: 3000 },
  { name: 'admin', url: 'http://localhost:3001', port: 3001 },
]

function curl(path) {
  const result = spawnSync('curl', ['-sI', path], { encoding: 'utf8', timeout: 8000 })
  if (result.error) throw result.error
  return result.stdout ?? ''
}

function portOpen(port) {
  const result = spawnSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8', timeout: 5000 })
  return result.status === 0 && result.stdout?.trim()
}

let failed = 0

console.log('\n🎨 CSS health probe (running dev servers)\n')

for (const t of targets) {
  if (!portOpen(t.port)) {
    console.log(`  ⏭️  ${t.name} — not running on :${t.port}`)
    continue
  }

  try {
    const home = curl(t.url)
    const status = home.match(/^HTTP\/[\d.]+ (\d+)/m)?.[1]
    if (status !== '200' && status !== '307') {
      throw new Error(`home returned HTTP ${status ?? 'unknown'}`)
    }

    const cssMatch = home.match(/href="(\/_next\/static\/css\/[^"]+)"/)
    if (!cssMatch) {
      console.log(`  ⚠️  ${t.name} — no layout.css link in HTML (may still be compiling)`)
      continue
    }

    const cssPath = cssMatch[1].split('?')[0]
    const cssHead = curl(`${t.url}${cssPath}`)
    const cssStatus = cssHead.match(/^HTTP\/[\d.]+ (\d+)/m)?.[1]
    if (cssStatus !== '200') {
      throw new Error(`layout.css returned HTTP ${cssStatus ?? 'unknown'} — run pnpm css:fix`)
    }

    console.log(`  ✅ ${t.name} — layout.css OK (${cssPath})`)
  } catch (e) {
    console.log(`  ❌ ${t.name}: ${e.message}`)
    failed++
  }
}

// Built CSS artifacts (post-build)
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

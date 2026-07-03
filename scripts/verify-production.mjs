#!/usr/bin/env node
/**
 * Production smoke test — web, admin, API health.
 * Usage: node scripts/verify-production.mjs
 *        SPLARO_DOMAIN=splaro.co node scripts/verify-production.mjs
 */
import { spawnSync } from 'node:child_process'

const domain = process.env.SPLARO_DOMAIN || 'splaro.co'
const targets = [
  { name: 'web', url: `https://${domain}`, expect: [200, 301, 302, 307, 308] },
  { name: 'admin', url: `https://admin.${domain}`, expect: [200, 301, 302, 307, 308] },
  { name: 'api-health', url: `https://api.${domain}/api/v1/health`, expect: [200] },
]

let failed = 0

for (const { name, url, expect } of targets) {
  const result = spawnSync('curl', ['-sI', '--max-time', '25', url], { encoding: 'utf8' })
  const statusLine = result.stdout.split('\n')[0] || ''
  const match = statusLine.match(/HTTP\/[\d.]+ (\d+)/)
  const code = match ? Number(match[1]) : 0

  if (expect.includes(code)) {
    console.log(`✅ ${name} — ${code} ${url}`)
  } else {
    console.error(`❌ ${name} — ${code || 'timeout'} ${url}`)
    if (result.stderr) console.error(result.stderr.trim())
    failed += 1
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}

console.log('\nAll production checks passed')

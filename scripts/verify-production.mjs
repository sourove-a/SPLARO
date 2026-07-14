#!/usr/bin/env node
/**
 * Production smoke test — web, admin, API health.
 * Uses fetch (cross-platform). curl kept as optional fast path on Unix.
 */
import { spawnSync } from 'node:child_process'
import { cliSpawnOpts } from './spawn-utils.mjs'

const domain = process.env.SPLARO_DOMAIN || 'splaro.co'
const isLocal = domain === '127.0.0.1' || domain === 'localhost'
const scheme = isLocal ? 'http' : 'https'
const webHost = isLocal ? `${domain}:3000` : domain
const adminHost = isLocal ? `${domain}:3001` : `admin.${domain}`
const apiHost = isLocal ? `${domain}:4000` : domain
const targets = [
  { name: 'web', url: `${scheme}://${webHost}`, expect: [200, 301, 302, 307, 308] },
  { name: 'admin', url: `${scheme}://${adminHost}/login`, expect: [200, 301, 302, 307, 308] },
  { name: 'api-health', url: `${scheme}://${apiHost}/api/v1/health`, expect: [200] },
]

let failed = 0

async function probeWithFetch(url) {
  const res = await fetch(url, {
    method: 'HEAD',
    redirect: 'manual',
    signal: AbortSignal.timeout(25_000),
  })
  return res.status
}

function probeWithCurl(url) {
  const result = spawnSync('curl', ['-sI', '--max-time', '25', url], {
    encoding: 'utf8',
    ...cliSpawnOpts(),
  })
  const statusLine = result.stdout.split('\n')[0] || ''
  const match = statusLine.match(/HTTP\/[\d.]+ (\d+)/)
  return match ? Number(match[1]) : 0
}

for (const { name, url, expect } of targets) {
  let code = 0
  try {
    code = await probeWithFetch(url)
  } catch {
    code = probeWithCurl(url)
  }

  if (expect.includes(code)) {
    console.log(`✅ ${name} — ${code} ${url}`)
  } else {
    console.error(`❌ ${name} — ${code || 'timeout'} ${url}`)
    failed += 1
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}

console.log('\nAll production checks passed')

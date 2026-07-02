#!/usr/bin/env node
/**
 * Hostinger runs `npm install` only (often skips `npm run build`).
 * After npm install (no pnpm workspace), bootstrap + build the storefront here.
 */
import { existsSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MARKER = resolve(ROOT, '.hostinger-build-done')
const STANDALONE = resolve(ROOT, 'apps/web/.next/standalone/apps/web/server.js')
const ua = process.env.npm_config_user_agent ?? ''

if (process.env.SKIP_SPLARO_POSTINSTALL === '1') process.exit(0)
if (ua.includes('pnpm') || ua.includes('yarn')) process.exit(0)
if (existsSync(resolve(ROOT, 'node_modules/.pnpm'))) process.exit(0)
if (existsSync(MARKER) && existsSync(STANDALONE)) {
  console.log('[postinstall] SPLARO storefront already built — skip')
  process.exit(0)
}

console.log('[postinstall] Hostinger npm install detected — running hostinger-build.sh')
const result = spawnSync('bash', ['scripts/hostinger-build.sh'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
})

if (result.status === 0) {
  writeFileSync(MARKER, `${new Date().toISOString()}\n`)
}

process.exit(result.status ?? 1)

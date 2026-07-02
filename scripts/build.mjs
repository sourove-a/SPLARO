#!/usr/bin/env node
/**
 * Root build entry — Hostinger runs `npm install` then `npm run build`.
 * npm install only installs root deps (no pnpm workspaces) → route to hostinger-build.sh.
 * Local dev uses pnpm → node_modules/.pnpm exists → turbo build.
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STANDALONE = resolve(ROOT, 'apps/web/.next/standalone/apps/web/server.js')

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: process.env })
  process.exit(result.status ?? 1)
}

if (existsSync(STANDALONE) && existsSync(resolve(ROOT, '.hostinger-build-done'))) {
  console.log('[build] Storefront already built (postinstall) — skip')
  process.exit(0)
}

const forceHostinger = process.env.SPLARO_HOSTINGER === '1'
const pnpmWorkspaceReady = existsSync(resolve(ROOT, 'node_modules/.pnpm'))
const useHostingerBuild = forceHostinger || !pnpmWorkspaceReady

if (useHostingerBuild) {
  console.log('[build] Hostinger / npm-only install detected → hostinger-build.sh')
  run('bash', ['scripts/hostinger-build.sh'])
} else {
  console.log('[build] pnpm workspace ready → turbo build')
  run('pnpm', ['exec', 'turbo', 'run', 'build'])
}

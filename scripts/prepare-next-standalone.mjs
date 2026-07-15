#!/usr/bin/env node
/**
 * Copy public + .next/static into Next.js standalone output (required for production).
 * Usage: node scripts/prepare-next-standalone.mjs apps/web
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRel = process.argv[2] || 'apps/web'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const appDir = join(root, appRel)
const standaloneRoot = join(appDir, '.next/standalone')

if (!existsSync(standaloneRoot)) {
  console.error(`Missing standalone build at ${standaloneRoot} — run next build first`)
  process.exit(1)
}

// Monorepo layout: apps/web/.next/standalone/apps/web/server.js
const nested = join(standaloneRoot, appRel)
const flat = join(standaloneRoot, 'server.js')
const target = existsSync(join(nested, 'server.js')) ? nested : standaloneRoot

if (!existsSync(join(target, 'server.js'))) {
  console.error(`server.js not found under ${target}`)
  process.exit(1)
}

const publicSrc = join(appDir, 'public')
if (existsSync(publicSrc)) {
  cpSync(publicSrc, join(target, 'public'), { recursive: true })
}

const staticSrc = join(appDir, '.next/static')
const staticDest = join(target, '.next/static')
mkdirSync(join(target, '.next'), { recursive: true })
if (existsSync(staticSrc)) {
  cpSync(staticSrc, staticDest, { recursive: true })
} else if (existsSync(staticDest)) {
  // Nginx aliases apps/web/.next/static — restore from standalone after a wiped build dir.
  mkdirSync(join(appDir, '.next'), { recursive: true })
  cpSync(staticDest, staticSrc, { recursive: true })
}

const buildIdSrc = join(appDir, '.next/BUILD_ID')
const buildIdDest = join(target, '.next/BUILD_ID')
if (existsSync(buildIdSrc) && !existsSync(buildIdDest)) {
  cpSync(buildIdSrc, buildIdDest)
} else if (existsSync(buildIdDest) && !existsSync(buildIdSrc)) {
  mkdirSync(join(appDir, '.next'), { recursive: true })
  cpSync(buildIdDest, buildIdSrc)
}

console.log(`[prepare-next-standalone] OK — ${target}`)


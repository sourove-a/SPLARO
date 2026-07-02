#!/usr/bin/env node
/**
 * Purge stale/corrupt Next.js .next caches before dev.
 * Prevents:
 *   Cannot find module './vendor-chunks/@tanstack+query-core@…'
 *   Cannot find module './76.js'
 */
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOCKFILE = resolve(ROOT, 'pnpm-lock.yaml')
const APPS = ['apps/web', 'apps/admin']
const VENDOR_RE = /vendor-chunks\/([^'"]+\.js)/g
const STATIC_REL_RE = /require\(["']\.\/([^"']+\.js)["']\)/g
const WEBPACK_CHUNK_RE = /\.X\(\d+,?\[([^\]]+)\]/g

const forceFresh = process.argv.includes('--fresh')

function purge(appDir, reason) {
  const nextDir = resolve(ROOT, appDir, '.next')
  const tsbuild = resolve(ROOT, appDir, 'tsconfig.tsbuildinfo')
  if (existsSync(nextDir)) rmSync(nextDir, { recursive: true, force: true })
  if (existsSync(tsbuild)) rmSync(tsbuild, { force: true })
  console.log(`  🧹 ${appDir}: cleared .next — ${reason}`)
}

function collectJsFiles(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) collectJsFiles(path, out)
    else if (entry.name.endsWith('.js')) out.push(path)
  }
  return out
}

function missingReferencedChunks(appDir) {
  const serverDir = join(resolve(ROOT, appDir, '.next'), 'server')
  if (!existsSync(serverDir)) return []

  const missing = new Set()

  for (const file of collectJsFiles(serverDir)) {
    const content = readFileSync(file, 'utf8')
    const fileDir = dirname(file)

    let match = VENDOR_RE.exec(content)
    while (match) {
      const target = join(serverDir, 'vendor-chunks', match[1])
      if (!existsSync(target)) missing.add(`vendor-chunks/${match[1]}`)
      match = VENDOR_RE.exec(content)
    }
    VENDOR_RE.lastIndex = 0

    match = STATIC_REL_RE.exec(content)
    while (match) {
      const target = join(fileDir, match[1])
      if (!existsSync(target)) missing.add(match[1])
      match = STATIC_REL_RE.exec(content)
    }
    STATIC_REL_RE.lastIndex = 0

    match = WEBPACK_CHUNK_RE.exec(content)
    while (match) {
      for (const id of match[1].split(',')) {
        const chunk = `${id.trim()}.js`
        if (!chunk || chunk === '.js') continue
        const target = join(serverDir, chunk)
        if (!existsSync(target)) missing.add(chunk)
      }
      match = WEBPACK_CHUNK_RE.exec(content)
    }
    WEBPACK_CHUNK_RE.lastIndex = 0
  }

  return [...missing]
}

function isProductionBuildCache(appDir) {
  const nextDir = resolve(ROOT, appDir, '.next')
  if (!existsSync(nextDir)) return false
  return (
    existsSync(join(nextDir, 'BUILD_ID')) ||
    existsSync(join(nextDir, 'standalone')) ||
    existsSync(join(nextDir, 'required-server-files.json'))
  )
}

function lockfileNewerThanCache(appDir) {
  const nextDir = resolve(ROOT, appDir, '.next')
  if (!existsSync(nextDir) || !existsSync(LOCKFILE)) return false
  return statSync(LOCKFILE).mtimeMs > statSync(nextDir).mtimeMs
}

function ensureApp(appDir) {
  const nextDir = resolve(ROOT, appDir, '.next')

  if (forceFresh) {
    if (existsSync(nextDir)) purge(appDir, 'dev stack fresh start')
    return
  }

  if (!existsSync(nextDir)) return

  if (isProductionBuildCache(appDir)) {
    purge(appDir, 'production next build cache — restart next dev fresh')
    return
  }

  if (lockfileNewerThanCache(appDir)) {
    purge(appDir, 'pnpm-lock.yaml newer than .next (deps changed)')
    return
  }

  const missing = missingReferencedChunks(appDir)
  if (missing.length > 0) {
    const preview = missing.slice(0, 3).join(', ')
    const suffix = missing.length > 3 ? ` +${missing.length - 3} more` : ''
    purge(appDir, `missing server chunks (${preview}${suffix})`)
  }
}

const filter = process.argv.filter((arg) => !arg.startsWith('--'))
const apps = filter.length > 2 ? filter.slice(2).map((p) => p.replace(/^\/+/, '')) : APPS

let purged = false
for (const app of apps) {
  const before = existsSync(resolve(ROOT, app, '.next'))
  ensureApp(app)
  if (before && !existsSync(resolve(ROOT, app, '.next'))) purged = true
}

if (purged || forceFresh) {
  console.log('  ↳ Next dev will rebuild a fresh cache on startup.\n')
}

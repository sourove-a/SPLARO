#!/usr/bin/env node
/**
 * Forbid re-importing retired admin CSS layers.
 * Works from repo root or apps/admin.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const adminSrc = join(repoRoot, 'apps/admin/src')

if (!existsSync(adminSrc)) {
  console.error('admin src not found:', adminSrc)
  process.exit(1)
}

const IMPORT_RE =
  /(?:@import|from|require\()\s*['"][^'"]*(admin-luxury-2027|admin-ui-strength|admin-ui-polish|admin-designmonks-accent|admin-theme-unify|admin-interactions-premium|admin-liquid-shell|_retired\/)/

function walk(dir, out = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) {
      if (name.name === '_retired' || name.name === 'node_modules') continue
      walk(p, out)
    } else if (/\.(tsx?|css|mjs|js)$/.test(name.name)) out.push(p)
  }
  return out
}

const hits = []
for (const file of walk(adminSrc)) {
  const text = readFileSync(file, 'utf8')
  if (IMPORT_RE.test(text)) hits.push(file)
}

if (hits.length) {
  console.error('Retired admin CSS re-import forbidden:\n' + hits.join('\n'))
  process.exit(1)
}
console.log('OK: no retired admin CSS imports')

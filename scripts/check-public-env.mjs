#!/usr/bin/env node
/**
 * Fail if tracked source/examples expose secrets via NEXT_PUBLIC_*.
 * Client-safe IDs (GA, Pixel, OAuth client id) are allowed.
 */
import { fileURLToPath } from 'node:url'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FORBIDDEN = /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|API_KEY)[A-Z0-9_]*/g
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'coverage',
  '.turbo',
])

const hits = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full)
      continue
    }
    if (!/\.(ts|tsx|js|mjs|md|example|yml|yaml)$/.test(name) && name !== '.env.example') continue
    const text = readFileSync(full, 'utf8')
    const rel = relative(ROOT, full)
    for (const match of text.matchAll(FORBIDDEN)) {
      hits.push({ file: rel, name: match[0] })
    }
  }
}

walk(ROOT)

if (hits.length) {
  console.error('Forbidden NEXT_PUBLIC_* secret-shaped names:')
  for (const hit of hits) console.error(`  ${hit.file}: ${hit.name}`)
  process.exit(1)
}

console.log('Public env allowlist OK — no NEXT_PUBLIC secret-shaped names')

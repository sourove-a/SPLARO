#!/usr/bin/env node
/**
 * One token system: move every #hex in apps/admin/src into admin-tokens.css,
 * replace consumers with var(--admin-c-XXXXXX) or semantic aliases.
 *
 * Usage:
 *   node scripts/admin-hex-to-tokens.mjs           # write tokens + rewrite files
 *   node scripts/admin-hex-to-tokens.mjs --check   # fail if hex remains outside tokens
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const adminSrc = join(root, 'apps/admin/src')
const tokensPath = join(adminSrc, 'styles/admin-tokens.css')
const checkOnly = process.argv.includes('--check')

const SKIP_DIRS = new Set(['_retired', 'node_modules', '.next', 'dist'])
/** Product swatch / EyeDropper data — must stay real #rrggbb (CSS vars break <input type="color">). */
const HEX_ALLOW_FILES = new Set([
  join(adminSrc, 'lib/admin/colour-names.ts').replace(/\\/g, '/'),
])
const HEX_RE = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g

function isHexAllowed(file) {
  const norm = file.replace(/\\/g, '/')
  return HEX_ALLOW_FILES.has(norm) || [...HEX_ALLOW_FILES].some((a) => norm.endsWith('lib/admin/colour-names.ts'))
}

/** Expand #rgb → #rrggbb (lowercase). Drop alpha-only 8-digit if last 2 are not meaningful for token id. */
function normalizeHex(raw) {
  let h = raw.slice(1).toLowerCase()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length === 8) {
    // keep full 8 for distinct tokens
    return h
  }
  return h.slice(0, 6)
}

function tokenName(norm) {
  return `--admin-c-${norm}`
}

/** Semantic aliases written on top of raw --admin-c-* */
const SEMANTIC = {
  ffffff: '--admin-color-white',
  fff: '--admin-color-white',
  '000000': '--admin-color-black',
  '000': '--admin-color-black',
  fafafa: '--admin-foundation-canvas',
  f4f4f5: '--admin-color-zinc-100',
  '18181b': '--admin-color-zinc-900',
  '09090b': '--admin-color-zinc-950',
  '0a0a0a': '--admin-foundation-ink',
  '712eff': '--admin-foundation-primary',
  '5b1fd9': '--admin-foundation-primary-hover',
  '4a18b5': '--admin-foundation-primary-pressed',
  '8b5cff': '--admin-color-violet-bright',
  a078ff: '--admin-color-violet-soft',
  '22c55e': '--admin-success',
  '16a34a': '--admin-success-strong',
  '15803d': '--admin-success-ink',
  dc2626: '--admin-danger',
  b91c1c: '--admin-danger-strong',
  ef4444: '--admin-danger-bright',
  d97706: '--admin-warning',
  b45309: '--admin-warning-ink',
  f59e0b: '--admin-warning-bright',
  '3f3f46': '--admin-foundation-ink-secondary',
  '71717a': '--admin-foundation-ink-muted',
  '04070d': '--admin-auth-cosmos',
  '101114': '--admin-color-ink-elevated',
  '111111': '--admin-color-ink-near',
  '5e7cff': '--admin-color-accent-blue',
  '6b6b6b': '--admin-color-neutral-500',
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(css|tsx|ts|jsx|js)$/.test(name)) out.push(p)
  }
  return out
}

function collectHexes(files) {
  const set = new Set()
  for (const file of files) {
    if (isHexAllowed(file)) continue
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(HEX_RE)) {
      set.add(normalizeHex(m[0]))
    }
  }
  return [...set].sort()
}

function buildTokenBlock(hexes) {
  const lines = [
    '  /* ─── Auto palette: sole hex source (generated) ─── */',
    '  /* Do not put #hex outside this file. Use var(--admin-c-*) or semantic aliases. */',
  ]
  for (const h of hexes) {
    const display = h.length === 8 ? `#${h}` : `#${h}`
    lines.push(`  ${tokenName(h)}: ${display};`)
  }
  lines.push('')
  lines.push('  /* ─── Semantic aliases → palette ─── */')
  const seen = new Set()
  for (const [hex, alias] of Object.entries(SEMANTIC)) {
    const n = normalizeHex(`#${hex}`)
    if (!hexes.includes(n) && n.length === 6) continue
    if (seen.has(alias)) continue
    seen.add(alias)
    // only alias if we have the raw token
    const target = hexes.includes(n) ? tokenName(n) : null
    if (!target) continue
    // Don't redefine foundation tokens that already exist with same meaning earlier —
    // write as comment-safe duplicates only for new aliases not already in :root.
    if (
      alias.startsWith('--admin-foundation-') ||
      alias === '--admin-success' ||
      alias === '--admin-danger' ||
      alias === '--admin-warning'
    ) {
      // keep existing foundation definitions; skip overwrite
      continue
    }
    lines.push(`  ${alias}: var(${target});`)
  }
  return lines.join('\n')
}

function ensureTokensFile(hexes) {
  let text = readFileSync(tokensPath, 'utf8')
  const block = buildTokenBlock(hexes)
  const startMark = '  /* ─── Auto palette: sole hex source'
  const endMark = '  /* ─── End auto palette ─── */'

  const section = `${block}\n${endMark}`

  if (text.includes(startMark)) {
    const start = text.indexOf(startMark)
    const end = text.indexOf(endMark)
    if (end === -1) throw new Error('tokens file: start mark without end mark')
    text = text.slice(0, start) + section + text.slice(end + endMark.length)
  } else {
    // Insert after :root { opening — after press-scale line block near top
    const anchor = '  --admin-press-scale: 0.98;'
    const idx = text.indexOf(anchor)
    if (idx === -1) throw new Error('tokens file: cannot find insert anchor')
    const insertAt = idx + anchor.length
    text = `${text.slice(0, insertAt)}\n\n${section}\n${text.slice(insertAt)}`
  }
  writeFileSync(tokensPath, text)
}

function replaceHexInFile(file, hexesSet) {
  if (file === tokensPath || isHexAllowed(file)) return { file, changed: false, count: 0 }
  let text = readFileSync(file, 'utf8')
  let count = 0
  const next = text.replace(HEX_RE, (match, _g, offset) => {
    // Do not rewrite Tailwind/CSS arbitrary selectors like .text-[#fff] or .bg-\\[#fff\\]
    const before = text.slice(Math.max(0, offset - 12), offset)
    if (/(\\|)\[$/.test(before) || before.endsWith('[') || before.endsWith('\\[')) {
      return match
    }
    const n = normalizeHex(match)
    if (!hexesSet.has(n)) return match
    count += 1
    // Prefer semantic alias when available
    const sem =
      SEMANTIC[n] ||
      SEMANTIC[n.slice(0, 6)] ||
      (n.length === 6 && SEMANTIC[n[0] + n[2] + n[4]])
    // Only use semantic if it's a safe redirect alias we actually emit
    const safeSem =
      sem &&
      !sem.startsWith('--admin-foundation-') &&
      sem !== '--admin-success' &&
      sem !== '--admin-danger' &&
      sem !== '--admin-warning'
        ? sem
        : null
    if (safeSem === '--admin-color-white') return 'var(--admin-color-white)'
    if (safeSem === '--admin-color-black') return 'var(--admin-color-black)'
    if (safeSem) return `var(${safeSem})`
    // foundation colors: still use --admin-c-* to avoid circular self-ref when foundation
    // was defined as hex then we'd replace foundation block itself — tokens file skipped.
    return `var(${tokenName(n)})`
  })
  if (next !== text) {
    writeFileSync(file, next)
    return { file, changed: true, count }
  }
  return { file, changed: false, count: 0 }
}

function assertZeroOutside(files) {
  const offenders = []
  for (const file of files) {
    if (file === tokensPath || isHexAllowed(file)) continue
    const rel = relative(root, file)
    // allow scripts that document hex / contrast checks outside src? only admin src
    const text = readFileSync(file, 'utf8')
    const hits = [...text.matchAll(HEX_RE)].map((m) => m[0].toLowerCase())
    if (hits.length) offenders.push({ rel, hits: [...new Set(hits)] })
  }
  return offenders
}

const files = walk(adminSrc)
const hexes = collectHexes(files)
const hexesSet = new Set(hexes)

console.log(`Unique hex colors: ${hexes.length}`)

if (checkOnly) {
  const offenders = assertZeroOutside(files)
  if (offenders.length) {
    console.error(`FAIL: ${offenders.length} files still contain raw #hex outside admin-tokens.css`)
    for (const o of offenders.slice(0, 40)) {
      console.error(`  ${o.rel}: ${o.hits.slice(0, 12).join(', ')}${o.hits.length > 12 ? '…' : ''}`)
    }
    if (offenders.length > 40) console.error(`  … +${offenders.length - 40} more files`)
    process.exit(1)
  }
  console.log('OK: zero raw #hex outside admin-tokens.css')
  process.exit(0)
}

ensureTokensFile(hexes)
console.log(`Updated ${relative(root, tokensPath)} with ${hexes.length} palette entries`)

let changedFiles = 0
let replacements = 0
for (const file of files) {
  const r = replaceHexInFile(file, hexesSet)
  if (r.changed) {
    changedFiles += 1
    replacements += r.count
  }
}
console.log(`Rewrote ${changedFiles} files (${replacements} hex → var())`)

const offenders = assertZeroOutside(walk(adminSrc))
if (offenders.length) {
  console.error(`WARN: ${offenders.length} files still have hex after rewrite:`)
  for (const o of offenders.slice(0, 20)) console.error(`  ${o.rel}: ${o.hits.join(', ')}`)
  process.exit(1)
}
console.log('OK: one token system — 0 hex outside admin-tokens.css')

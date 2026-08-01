#!/usr/bin/env node
/**
 * Guards the mobile fix for admin tables.
 *
 * A `width: 100%` table with eight columns does not shrink gracefully on a
 * 390px phone — it crushes every column into a two-character sliver. The fix is
 * that each table carries a `minWidth` and sits inside a container that scrolls
 * horizontally, so the columns keep their size and the table scrolls instead of
 * the page.
 *
 * This script fails if a DC-family screen grows a table without both parts.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'apps/admin/src/components')

/** Directories whose tables are part of the DC redesign and must be responsive. */
const DC_DIRS = [
  'dc',
  'orders',
  'products',
  'customers',
  'courier',
  'operations',
  'finance',
  'dashboard',
  'settings',
]

/**
 * Pre-redesign panels still on the old body. They are exempt until they are
 * ported; remove an entry here when its screen moves to DC.
 */
const LEGACY_EXEMPT = new Set([
  'finance/PartnerHubPage.tsx',
  'finance/FinanceDashboard.tsx',
  'finance/DailyClosingPanel.tsx',
  'finance/GoogleSheetsPanel.tsx',
  'finance/FinanceAuditLogsPanel.tsx',
  'customers/Customer360Profile.tsx',
  'dashboard/RecentOrdersTable.tsx',
  'settings/sections/NotificationsSection.tsx',
])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.tsx')) out.push(full)
  }
  return out
}

const files = DC_DIRS.flatMap((d) => {
  try {
    return walk(join(SRC, d))
  } catch {
    return []
  }
})

const problems = []

for (const file of files) {
  const rel = relative(SRC, file)
  if (LEGACY_EXEMPT.has(rel)) continue

  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')

  lines.forEach((line, i) => {
    if (!line.includes('<table')) return

    // 1. The table must declare a min width, or it will compress on a phone.
    if (!line.includes('minWidth')) {
      problems.push(`${rel}:${i + 1}  <table> has no minWidth — it will crush on mobile`)
    }

    // 2. Some ancestor within a few lines must establish a scroll context.
    const above = lines.slice(Math.max(0, i - 6), i).join('\n')
    if (!/overflowX:\s*'auto'|overflow:\s*'auto'/.test(above)) {
      problems.push(
        `${rel}:${i + 1}  <table> is not inside an overflowX:'auto' container — it will overflow the card`,
      )
    }
  })
}

if (problems.length > 0) {
  console.error('Admin table responsiveness gate FAILED\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    `\n${problems.length} problem(s). Wrap the table:\n` +
      `  <div style={{ overflowX: 'auto' }}>\n` +
      `    <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>\n`,
  )
  process.exit(1)
}

console.log(`Admin table responsiveness gate OK — ${files.length} files checked`)

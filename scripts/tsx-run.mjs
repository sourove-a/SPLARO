#!/usr/bin/env node
/**
 * Run a tsx script in a workspace package with root .env loaded (Windows-safe).
 *
 * Usage: node scripts/tsx-run.mjs <package-dir> <script.ts> [args...]
 * Example: node scripts/tsx-run.mjs packages/database prisma/configure-telegram.ts
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { loadRootEnv } from './load-env.mjs'
import { cliSpawnOpts } from './spawn-utils.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

loadRootEnv()

const [pkgDir, script, ...args] = process.argv.slice(2)
if (!pkgDir || !script) {
  console.error('Usage: node scripts/tsx-run.mjs <package-dir> <script.ts> [args...]')
  process.exit(1)
}

const result = spawnSync('npx', ['tsx', script, ...args], {
  cwd: resolve(ROOT, pkgDir),
  stdio: 'inherit',
  env: process.env,
  ...cliSpawnOpts(),
})

process.exit(result.status ?? 1)

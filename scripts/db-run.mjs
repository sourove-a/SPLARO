#!/usr/bin/env node
/**
 * Run Prisma CLI in packages/database with root .env loaded.
 * Cross-platform replacement for `bash -lc 'source .env && prisma …'`.
 *
 * Usage: node scripts/db-run.mjs <prisma-args...>
 * Example: node scripts/db-run.mjs migrate dev
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRootEnv } from './load-env.mjs'
import { cliSpawnOpts } from './spawn-utils.mjs'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DB_DIR = resolve(ROOT, 'packages/database')

loadRootEnv()

const args = process.argv.slice(2)
if (!args.length) {
  console.error('Usage: node scripts/db-run.mjs <prisma-args...>')
  process.exit(1)
}

const result = spawnSync('npx', ['prisma', ...args], {
  cwd: DB_DIR,
  stdio: 'inherit',
  env: process.env,
  ...cliSpawnOpts(),
})

process.exit(result.status ?? 1)

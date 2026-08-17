#!/usr/bin/env node
/**
 * Atomic package build for the shared workspace packages.
 *
 * The old inline build did `rm -rf dist && tsc -p tsconfig.build.json`. That
 * leaves `dist/` missing for the whole length of the compile, and every running
 * dev process resolves `@splaro/config` through `dist/index.js`. ts-node-dev
 * sees the change, restarts mid-compile, cannot resolve the module and exits —
 * so a plain `pnpm check:api` (which builds dependencies first) killed the API
 * dev server with `Cannot find module .../config/dist/index.js`.
 *
 * Here tsc compiles into a scratch directory and the result is swapped in with
 * two renames, so consumers only ever see a complete `dist/`. A full clean is
 * still performed — the scratch dir starts empty, so files deleted from src do
 * not survive in the output.
 *
 * Usage: node ../../scripts/build-package.mjs [tsconfig] (default tsconfig.build.json)
 */
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync, renameSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

const cwd = process.cwd()
const project = process.argv[2] ?? 'tsconfig.build.json'
const dist = resolve(cwd, 'dist')
const staging = resolve(cwd, '.dist-build')
const previous = resolve(cwd, '.dist-previous')
const buildInfo = resolve(cwd, 'tsconfig.build.tsbuildinfo')

function wipe(dir) {
  rmSync(dir, { recursive: true, force: true })
}

wipe(staging)
wipe(previous)
// Incremental state describes the old output tree; keeping it would make tsc
// skip emitting into the empty staging dir.
if (existsSync(buildInfo)) unlinkSync(buildInfo)

const tsc = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsc', '-p', project, '--outDir', staging],
  { stdio: 'inherit', cwd },
)

if (tsc.status !== 0) {
  // Leave the existing dist untouched so anything running keeps working.
  wipe(staging)
  process.exit(tsc.status ?? 1)
}

if (existsSync(dist)) {
  renameSync(dist, previous)
}
renameSync(staging, dist)
wipe(previous)

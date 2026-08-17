#!/usr/bin/env node
/**
 * Install Playwright browsers into repo-local .playwright-browsers (cross-platform).
 * Skipped when binaries already present.
 */
import { existsSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PLAYWRIGHT_BROWSERS_DIR,
  applyPlaywrightBrowsersPath,
} from './playwright-browsers-path.mjs'
import { cliSpawnOpts } from './spawn-utils.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function browsersReady() {
  if (!existsSync(PLAYWRIGHT_BROWSERS_DIR)) return false
  try {
    return readdirSync(PLAYWRIGHT_BROWSERS_DIR).some((name) =>
      /^(chromium|firefox|webkit)-/.test(name),
    )
  } catch {
    return false
  }
}

function main() {
  applyPlaywrightBrowsersPath()

  if (browsersReady()) {
    console.log(`[playwright] browsers ready at ${PLAYWRIGHT_BROWSERS_DIR}`)
    return
  }

  console.log('[playwright] downloading chromium, firefox, webkit (one-time)...')
  const result = spawnSync(
    'pnpm',
    ['exec', 'playwright', 'install', 'chromium', 'firefox', 'webkit'],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: PLAYWRIGHT_BROWSERS_DIR },
      ...cliSpawnOpts(),
    },
  )
  if (result.status !== 0) process.exit(result.status ?? 1)
}

main()

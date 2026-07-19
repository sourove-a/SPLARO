#!/usr/bin/env node
/**
 * Start Redis for local dev — cross-platform.
 * Windows: Docker Compose only (no Homebrew).
 * macOS: Homebrew service, else Docker Compose.
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IS_WIN, cliSpawnOpts } from './spawn-utils.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function tryDockerCompose() {
  // Docker Desktop (modern): `docker compose`
  let result = spawnSync('docker', ['compose', 'up', '-d', 'redis'], {
    cwd: ROOT,
    stdio: 'inherit',
    ...cliSpawnOpts(),
  })
  if (result.status === 0) return true

  // Older installs / some Windows PATH setups: `docker-compose`
  result = spawnSync('docker-compose', ['up', '-d', 'redis'], {
    cwd: ROOT,
    stdio: 'inherit',
    ...cliSpawnOpts(),
  })
  return result.status === 0
}

function tryBrew() {
  if (IS_WIN) return false
  const result = spawnSync('bash', ['-lc', 'brew services start redis 2>/dev/null'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  })
  return result.status === 0
}

if (IS_WIN) {
  console.log('📦 Windows — starting Redis via Docker Compose…')
  if (!tryDockerCompose()) {
    console.warn('⚠️  Redis not started — install Docker Desktop or run Redis manually.')
    console.warn('   Prefer REDIS_URL=redis://127.0.0.1:6379 (not localhost).')
    console.warn('   Dev stack continues; cache/queues fall back until Redis is up.')
  }
} else if (!tryBrew()) {
  console.log('📦 Homebrew Redis unavailable — trying Docker Compose…')
  if (!tryDockerCompose()) {
    console.warn('⚠️  Redis not started — run: pnpm infra:up')
  }
}

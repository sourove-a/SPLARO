#!/usr/bin/env node
/**
 * API preflight — run before pnpm dev:api to avoid known failure modes.
 */
import { spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { checkApiHealth, getApiPort, getListeningPids, reclaimPort } from './api-port.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API_PKG = resolve(ROOT, 'apps/api/package.json')

function fail(msg) {
  console.error(`\n❌ API preflight: ${msg}\n`)
  process.exit(1)
}

function warn(msg) {
  console.warn(`⚠️  API preflight: ${msg}`)
}

const pkg = JSON.parse(readFileSync(API_PKG, 'utf8'))
if (pkg.scripts?.dev?.includes('tsx watch') || pkg.scripts?.dev?.includes('tsx src')) {
  fail('apps/api dev script must use ts-node-dev (tsx breaks NestJS DI).')
}

if (process.env.NODE_OPTIONS?.includes('tsx')) {
  fail('NODE_OPTIONS contains tsx loader — unset it before starting the API.')
}

const port = getApiPort()
const listeners = getListeningPids(port)
if (listeners.length) {
  const healthy = await checkApiHealth(port)
  if (healthy) {
    warn(
      `Port ${port} already serves SPLARO API (PID ${listeners[0]}). ` +
        `Stop the other dev:api / dev:stack before starting another instance.`,
    )
  } else {
    const reclaim = await reclaimPort(port)
    if (reclaim.reclaimed) {
      console.log(`🔧 Cleared stale listener on :${port}`)
    } else {
      warn(`Port ${port} is in use (PID ${listeners[0]}). Stop the old API or set API_PORT.`)
    }
  }
}

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const redisPing = spawnSync(
  'redis-cli',
  ['-u', redisUrl, 'ping'],
  { encoding: 'utf8', timeout: 5000 },
)
if (redisPing.stdout?.trim() === 'PONG') {
  console.log('✅ Redis reachable')
} else {
  warn('Redis not reachable — run: pnpm infra:redis (caching/queues fall back until Redis is up)')
}

const mainPath = resolve(ROOT, 'apps/api/src/main.ts')
if (!existsSync(mainPath) || !readFileSync(mainPath, 'utf8').includes('reflect-metadata')) {
  fail('apps/api/src/main.ts must import reflect-metadata first.')
}

const rootEnv = resolve(ROOT, '.env')
if (!existsSync(rootEnv)) {
  warn('Root .env missing — copy .env.example to .env (API loads ../../.env from apps/api cwd).')
}

const sessionSecret = process.env.ADMIN_SESSION_SECRET ?? process.env.JWT_SECRET
if (!sessionSecret && process.env.NODE_ENV === 'production') {
  warn('ADMIN_SESSION_SECRET or JWT_SECRET must be set in production for API admin auth.')
}

const tsconfig = resolve(ROOT, 'apps/api/tsconfig.json')
if (!readFileSync(tsconfig, 'utf8').includes('emitDecoratorMetadata')) {
  fail('apps/api/tsconfig.json must set emitDecoratorMetadata: true')
}

console.log('✅ API preflight passed — safe to start NestJS API\n')

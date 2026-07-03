/**
 * Hostinger Passenger — SPLARO API (api.splaro.co)
 */
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

function resolveRepoDir() {
  if (process.env.SPLARO_REPO_DIR) return process.env.SPLARO_REPO_DIR
  const home = process.env.HOME || ''
  if (home.includes('/domains/api.splaro.co')) {
    return path.join(home, 'public_html/.builds/source/repository')
  }
  return path.join(home, 'domains/splaro.co/public_html/.builds/source/repository')
}

const repo = resolveRepoDir()

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function ensurePostgres() {
  const home = process.env.HOME || ''
  const pgCtl = path.join(home, 'pgenv/bin/pg_ctl')
  const pgReady = path.join(home, 'pgenv/bin/pg_isready')
  const pgData = path.join(home, 'pgsql/data')
  if (!fs.existsSync(pgCtl) || !fs.existsSync(pgData)) return

  const ready = spawnSync(pgReady, ['-h', '127.0.0.1', '-p', '5433', '-q'], { stdio: 'ignore' })
  if (ready.status === 0) return

  console.log('[splaro-api] starting PostgreSQL on :5433')
  spawnSync(
    pgCtl,
    ['-D', pgData, '-l', path.join(home, 'pgsql/postgres.log'), '-o', '-p 5433', 'start'],
    { stdio: 'inherit' },
  )
}

loadEnvFile(path.join(repo, '.env'))
ensurePostgres()

process.env.NODE_ENV = process.env.NODE_ENV || 'production'
process.env.REDIS_ENABLED = process.env.REDIS_ENABLED || 'false'
process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://splaro.co'
process.env.NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://api.splaro.co/api/v1'
process.env.NEXT_PUBLIC_ADMIN_URL =
  process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.splaro.co'
process.env.WEB_URL = process.env.WEB_URL || 'https://splaro.co'
process.env.API_URL = process.env.API_URL || 'https://api.splaro.co'
process.env.CORS_ORIGINS =
  process.env.CORS_ORIGINS || 'https://splaro.co,https://admin.splaro.co'
process.env.API_PORT = process.env.API_PORT || '4000'
process.env.PORT = process.env.API_PORT

const apiMain = path.join(repo, 'apps/api/dist/main.js')
if (!fs.existsSync(apiMain)) {
  console.error('[splaro-api] API build missing:', apiMain)
  process.exit(1)
}

process.chdir(path.join(repo, 'apps/api'))
require(apiMain)

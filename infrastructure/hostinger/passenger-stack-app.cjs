/**
 * Hostinger Passenger — reverse proxy (:PORT) → API :4000 + Next.js :3001
 */
const { fork, spawnSync } = require('child_process')
const http = require('http')
const path = require('path')
const fs = require('fs')
const Module = require('module')

function resolveRepoDir() {
  if (process.env.SPLARO_REPO_DIR) return process.env.SPLARO_REPO_DIR
  const home = process.env.HOME || ''
  if (home.includes('/domains/splaro.co')) {
    return path.join(home, 'public_html/.builds/source/repository')
  }
  return path.join(home, 'domains/splaro.co/public_html/.builds/source/repository')
}

const repo = resolveRepoDir()

const API_PORT = Number(process.env.API_PORT || 4000)
const WEB_PORT = Number(process.env.INTERNAL_WEB_PORT || 3001)
const PASSENGER_PORT = Number(process.env.PORT || 3000)

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

loadEnvFile(path.join(repo, '.env'))

function ensurePostgres() {
  const home = process.env.HOME || ''
  const pgCtl = path.join(home, 'pgenv/bin/pg_ctl')
  const pgReady = path.join(home, 'pgenv/bin/pg_isready')
  const pgData = path.join(home, 'pgsql/data')
  if (!fs.existsSync(pgCtl) || !fs.existsSync(pgData)) return

  const ready = spawnSync(pgReady, ['-h', '127.0.0.1', '-p', '5433', '-q'], { stdio: 'ignore' })
  if (ready.status === 0) return

  console.log('[splaro-stack] starting PostgreSQL on :5433')
  spawnSync(
    pgCtl,
    ['-D', pgData, '-l', path.join(home, 'pgsql/postgres.log'), '-o', '-p 5433', 'start'],
    { stdio: 'inherit' },
  )
}

ensurePostgres()

process.env.NODE_ENV = process.env.NODE_ENV || 'production'
process.env.REDIS_ENABLED = process.env.REDIS_ENABLED || 'false'
process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://splaro.co'
process.env.NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://splaro.co/api/v1'
process.env.NEXT_PUBLIC_ADMIN_URL =
  process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.splaro.co'
process.env.WEB_URL = process.env.WEB_URL || 'https://splaro.co'
process.env.API_URL = process.env.API_URL || 'https://splaro.co'
process.env.CORS_ORIGINS =
  process.env.CORS_ORIGINS || 'https://splaro.co,https://admin.splaro.co'

const apiDir = path.join(repo, 'apps/api')
const apiMain = path.join(apiDir, 'dist/main.js')
const standaloneRoot = path.join(repo, 'apps/web/.next/standalone')
const standaloneWeb = path.join(standaloneRoot, 'apps/web')
const webServer = path.join(standaloneWeb, 'server.js')

const nodePaths = [
  path.join(standaloneRoot, 'node_modules'),
  path.join(standaloneWeb, 'node_modules'),
  path.join(repo, 'node_modules'),
  path.join(repo, 'apps/api/node_modules'),
  path.join(repo, 'apps/web/node_modules'),
  path.join(repo, 'packages/database/node_modules'),
].filter((p) => fs.existsSync(p))

const nodePathStr = nodePaths.join(path.delimiter)
process.env.NODE_PATH = nodePathStr
Module._initPaths()

const children = []

function startChild(label, script, opts) {
  const child = fork(script, [], { stdio: 'inherit', ...opts })
  child.on('exit', (code, signal) => {
    console.error(`[splaro-stack] ${label} exited (code=${code}, signal=${signal})`)
    if (label === 'web' && code !== 0 && fs.existsSync(script)) {
      console.error(`[splaro-stack] restarting ${label} in 3s...`)
      setTimeout(() => startChild(label, script, opts), 3000)
    }
  })
  children.push(child)
  return child
}

if (fs.existsSync(apiMain)) {
  startChild('api', apiMain, {
    cwd: apiDir,
    env: { ...process.env, API_PORT: String(API_PORT), PORT: String(API_PORT) },
  })
} else {
  console.error('[splaro-stack] API build missing:', apiMain)
}

if (fs.existsSync(webServer)) {
  startChild('web', webServer, {
    cwd: standaloneWeb,
    env: {
      ...process.env,
      NODE_PATH: nodePathStr,
      PORT: String(WEB_PORT),
      HOSTNAME: '127.0.0.1',
    },
  })
} else {
  console.error('[splaro-stack] Web standalone missing:', webServer)
}

function proxyRequest(req, res, port) {
  const headers = { ...req.headers, host: `127.0.0.1:${port}` }
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )

  upstream.on('error', (err) => {
    console.error(`[splaro-stack] proxy :${port} error:`, err.message)
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
    }
    res.end('Upstream unavailable')
  })

  req.pipe(upstream)
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

setTimeout(() => {
  const server = http.createServer((req, res) => {
    const url = req.url || '/'
    if (url === '/api/v1' || url.startsWith('/api/v1/')) {
      proxyRequest(req, res, API_PORT)
      return
    }
    proxyRequest(req, res, WEB_PORT)
  })

  server.listen(PASSENGER_PORT, '0.0.0.0', () => {
    console.log(
      `[splaro-stack] listening :${PASSENGER_PORT} → api:${API_PORT} web:${WEB_PORT}`,
    )
  })
}, 8000)

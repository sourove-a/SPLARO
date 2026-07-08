#!/usr/bin/env node
/**
 * Post-deploy regression guard — catches mass route probe failures (401 storm, timeouts).
 * Usage: node scripts/verify-deploy-health.mjs
 * Env: API_HEALTH_BASE (default http://127.0.0.1:4000/api/v1)
 */
const base = (process.env.API_HEALTH_BASE ?? 'http://127.0.0.1:4000/api/v1').replace(/\/+$/, '')
const minRatio = Number(process.env.HEALTH_MIN_HEALTHY_RATIO ?? '0.95')
const routesTimeoutMs = Number(process.env.HEALTH_ROUTES_TIMEOUT_MS ?? 120_000)
const pingTimeoutMs = Number(process.env.HEALTH_PING_TIMEOUT_MS ?? 30_000)

function fail(msg) {
  console.error(`❌ Deploy health: ${msg}`)
  process.exit(1)
}

async function checkApiRootRedirect() {
  const res = await fetch(`${base.replace(/\/api\/v1$/, '')}/`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
  }).catch(() => null)
  if (!res) fail('API root / unreachable')
  if (res.status !== 302 && res.status !== 301) {
    fail(`API root / expected 302 redirect, got HTTP ${res.status}`)
  }
  const location = res.headers.get('location') ?? ''
  if (!location.includes('/api/v1')) {
    fail(`API root redirect missing /api/v1 (location: ${location || 'none'})`)
  }
  console.log('✅ API root → /api/v1 redirect')
}

async function checkRouteProbes() {
  const res = await fetch(`${base}/health/routes?storeId=splaro`, {
    signal: AbortSignal.timeout(routesTimeoutMs),
  }).catch((err) => {
    fail(err instanceof Error ? err.message : 'health/routes fetch failed')
  })

  const body = await res.text()
  if (!res.ok) fail(`health/routes HTTP ${res.status}: ${body.slice(0, 300)}`)

  let data
  try {
    data = JSON.parse(body)
  } catch {
    fail(`health/routes invalid JSON: ${body.slice(0, 300)}`)
  }

  const summary = data.summary ?? {}
  const total = Number(summary.total ?? 0)
  const healthy = Number(summary.healthy ?? 0)
  const down = Number(summary.down ?? 0)
  const degraded = Number(summary.degraded ?? 0)

  if (!total) fail('health/routes returned zero probes')

  const ratio = healthy / total
  const authFailures = (data.checks ?? []).filter(
    (c) => c.status !== 'healthy' && String(c.message ?? '').includes('401'),
  ).length

  console.log(
    `   routes: ${healthy}/${total} healthy, ${degraded} degraded, ${down} down (${Math.round(ratio * 100)}%)`,
  )

  if (authFailures > 0) {
    fail(
      `${authFailures} route(s) returned HTTP 401 — INTERNAL_HEALTH_SECRET bypass broken in admin-auth.guard`,
    )
  }
  if (down > 0) fail(`${down} route probe(s) down`)
  if (ratio < minRatio) {
    fail(`healthy ratio ${(ratio * 100).toFixed(1)}% below minimum ${(minRatio * 100).toFixed(0)}%`)
  }

  console.log('✅ health/routes probe suite')
}

async function checkAdminPing() {
  const adminBase = (process.env.ADMIN_HEALTH_BASE ?? 'http://127.0.0.1:3002').replace(/\/+$/, '')
  const res = await fetch(`${adminBase}/api/ping`, {
    signal: AbortSignal.timeout(pingTimeoutMs),
  }).catch(() => null)
  if (!res?.ok) {
    console.warn('⚠️  admin /api/ping skipped (admin not running on this host)')
    return
  }
  const data = await res.json()
  if (!data.services?.database?.online) {
    fail(`admin database probe offline: ${data.services?.database?.message ?? 'unknown'}`)
  }
  console.log('✅ admin /api/ping database online')
}

async function checkWeb() {
  const webBase = (process.env.WEB_HEALTH_BASE ?? '').replace(/\/+$/, '')
  if (!webBase) {
    console.log('ℹ️  web check skipped (set WEB_HEALTH_BASE=https://splaro.co to enable)')
    return
  }
  const res = await fetch(`${webBase}/`, { signal: AbortSignal.timeout(20_000) }).catch(() => null)
  if (!res?.ok) fail(`web ${webBase} not reachable (HTTP ${res?.status ?? 'timeout'})`)
  console.log(`✅ web ${webBase} → ${res.status}`)
}

function checkDevStubs() {
  if (process.env.NODE_ENV !== 'production' && process.env.SPLARO_HOSTINGER !== '1') return
  for (const flag of ['PAYMENT_DEV_STUB', 'COURIER_DEV_STUB']) {
    if (process.env[flag]?.trim() === 'true') {
      fail(`${flag}=true in production environment — dev stubs must be off`)
    }
  }
  console.log('✅ no dev stub flags in production env')
}

console.log('═══ Deploy health verify ═══')
checkDevStubs()
await checkWeb()
await checkApiRootRedirect()
await checkRouteProbes()
await checkAdminPing()
console.log('═══ Deploy health OK ═══\n')

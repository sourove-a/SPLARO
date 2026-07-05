/**
 * SPLARO Hostinger Passenger combined proxy (serves splaro.co AND api.splaro.co via one lsnode app).
 * Host-aware routing:
 *   api.*  → API :4000 (all paths)
 *   else   → /api/v1* → API :4000, everything else → web :3001
 */
const http = require('http')

const API_PORT = Number(process.env.API_PORT || 4000)
const WEB_PORT = Number(process.env.INTERNAL_WEB_PORT || 3001)
const PASSENGER_PORT = Number(process.env.PORT || 3000)

function proxyRequest(req, res, port) {
  const headers = { ...req.headers, host: `127.0.0.1:${port}` }
  const upstream = http.request(
    { hostname: '127.0.0.1', port, path: req.url, method: req.method, headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )
  upstream.on('error', (err) => {
    console.error(`[splaro-proxy] :${port} error:`, err.message)
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('Upstream unavailable')
  })
  req.pipe(upstream)
}

function redirectWww(req, res) {
  const host = String(req.headers.host || '').toLowerCase().split(':')[0]
  if (host === 'www.splaro.co') {
    const target = `https://splaro.co${req.url || '/'}`
    res.writeHead(301, { Location: target, 'Content-Type': 'text/plain' })
    res.end(`Redirecting to ${target}`)
    return true
  }
  return false
}

const server = http.createServer((req, res) => {
  if (redirectWww(req, res)) return
  const host = String(req.headers.host || '').toLowerCase()
  const url = req.url || '/'
  if (host.startsWith('api.')) {
    proxyRequest(req, res, API_PORT)
    return
  }
  if (url === '/api/v1' || url.startsWith('/api/v1/')) {
    proxyRequest(req, res, API_PORT)
    return
  }
  proxyRequest(req, res, WEB_PORT)
})

server.listen(PASSENGER_PORT, '0.0.0.0', () => {
  console.log(`[splaro-proxy] :${PASSENGER_PORT} → api:${API_PORT} web:${WEB_PORT} (host-aware)`)
})

// ── SPLARO_WATCHDOG: self-heal upstreams every 5 min ──
const { execFile } = require('child_process')
function checkAndHeal() {
  let dead = 0,
    pending = 3
  const probe = (port, path) => {
    const r = http.get({ hostname: '127.0.0.1', port, path, timeout: 8000 }, (res) => {
      res.resume()
      done(res.statusCode >= 500)
    })
    r.on('error', () => done(true))
    r.on('timeout', () => {
      r.destroy()
      done(true)
    })
  }
  const done = (bad) => {
    if (bad) dead++
    if (--pending === 0 && dead > 0) {
      console.log(`[splaro-watchdog] ${dead} upstream(s) dead — running heal script`)
      execFile('/bin/bash', [process.env.HOME + '/splaro-scripts/splaro-watchdog.sh'], { timeout: 120000 }, () => {})
    }
  }
  probe(3001, '/')
  // products endpoint touches the DB — catches dead Postgres, not just dead API
  probe(4000, '/api/v1/storefront/products?limit=1')
  probe(3002, '/login')
}
setInterval(checkAndHeal, 5 * 60 * 1000)
setTimeout(checkAndHeal, 60 * 1000)

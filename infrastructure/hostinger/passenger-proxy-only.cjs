/**
 * Hostinger Passenger — proxy only (:PORT) → web :3001 + API :4000
 * Use when web/API are started separately (next start + node dist/main.js).
 */
const http = require('http')

const API_PORT = Number(process.env.API_PORT || 4000)
const WEB_PORT = Number(process.env.INTERNAL_WEB_PORT || 3001)
const PASSENGER_PORT = Number(process.env.PORT || 3000)

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
    console.error(`[splaro-proxy] :${port} error:`, err.message)
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
    }
    res.end('Upstream unavailable')
  })

  req.pipe(upstream)
}

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
    `[splaro-proxy] listening :${PASSENGER_PORT} → api:${API_PORT} web:${WEB_PORT}`,
  )
})

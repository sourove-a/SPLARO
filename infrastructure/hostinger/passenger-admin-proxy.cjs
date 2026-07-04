/**
 * Hostinger Passenger — admin.splaro.co → Next.js admin on :3002
 */
const http = require('http')

const ADMIN_PORT = Number(process.env.ADMIN_PORT || 3002)
const PORT = Number(process.env.PORT || 3000)

const server = http.createServer((req, res) => {
  const headers = { ...req.headers, host: `127.0.0.1:${ADMIN_PORT}` }
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: ADMIN_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('Admin upstream unavailable')
  })
  req.pipe(upstream)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[splaro-admin-proxy] :${PORT} → admin:${ADMIN_PORT}`)
})

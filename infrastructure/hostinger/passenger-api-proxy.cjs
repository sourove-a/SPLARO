/**
 * Hostinger Passenger — api.splaro.co → NestJS API on :4000
 */
const http = require('http')

const API_PORT = Number(process.env.API_PORT || 4000)
const PORT = Number(process.env.PORT || 3000)

const server = http.createServer((req, res) => {
  const headers = { ...req.headers, host: `127.0.0.1:${API_PORT}` }
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: API_PORT,
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
    res.end('API upstream unavailable')
  })
  req.pipe(upstream)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[splaro-api-proxy] :${PORT} → api:${API_PORT}`)
})

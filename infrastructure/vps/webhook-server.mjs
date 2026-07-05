#!/usr/bin/env node
/**
 * SPLARO GitHub webhook → deploy (optional backup when Actions SSH unavailable)
 * Env: GITHUB_WEBHOOK_SECRET, SPLARO_APP_DIR, GITHUB_WEBHOOK_PORT, SPLARO_BRANCH
 */
import { createServer } from 'node:http'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'
import { appendFileSync } from 'node:fs'

const SECRET = process.env.GITHUB_WEBHOOK_SECRET
const APP_DIR = process.env.SPLARO_APP_DIR || '/var/www/splaro'
const PORT = Number(process.env.GITHUB_WEBHOOK_PORT || 9000)
const BRANCH = process.env.SPLARO_BRANCH || 'main'
const LOG = '/var/log/splaro/webhook.log'

if (!SECRET) {
  console.error('GITHUB_WEBHOOK_SECRET required')
  process.exit(1)
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  appendFileSync(LOG, line)
  console.log(msg)
}

function verifySig(body, sig) {
  if (!sig?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', SECRET).update(body).digest('hex')
  const actual = sig.slice(7)
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  } catch {
    return false
  }
}

createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  if (req.method !== 'POST' || req.url !== '/hook') {
    res.writeHead(404).end()
    return
  }

  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8')
    const sig = req.headers['x-hub-signature-256']

    if (!verifySig(body, sig)) {
      log('Invalid webhook signature')
      res.writeHead(401).end('Unauthorized')
      return
    }

    let payload
    try {
      payload = JSON.parse(body)
    } catch {
      res.writeHead(400).end('Bad JSON')
      return
    }

    if (payload.ref !== `refs/heads/${BRANCH}`) {
      log(`Ignored: ${payload.ref}`)
      res.writeHead(200).end('Ignored')
      return
    }

    log(`Deploy triggered — push to ${BRANCH}`)
    spawn('bash', [`${APP_DIR}/infrastructure/vps/deploy.sh`], {
      detached: true,
      stdio: 'ignore',
    }).unref()

    res.writeHead(202).end('Accepted')
  })
}).listen(PORT, '127.0.0.1', () => log(`Webhook listening 127.0.0.1:${PORT}/hook`))

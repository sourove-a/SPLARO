#!/usr/bin/env node
/**
 * Hostinger hPanel runs `npm start` after Git deploy build.
 * Hostinger → passenger-stack-app (web :3001 + API :4000 + admin :3002 + proxy :PORT)
 */
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STANDALONE_DIR = resolve(ROOT, 'apps/web/.next/standalone/apps/web')
const STANDALONE = resolve(STANDALONE_DIR, 'server.js')
const STACK_APP = resolve(ROOT, 'infrastructure/hostinger/passenger-stack-app.cjs')

const onHostinger =
  process.env.SPLARO_HOSTINGER === '1' ||
  ROOT.includes('.builds/source/repository') ||
  existsSync(resolve(process.env.HOME ?? '', 'domains/splaro.co'))

function runNode(script, opts = {}) {
  const child = spawn(process.execPath, [script], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, SPLARO_HOSTINGER: '1' },
    ...opts,
  })
  child.on('exit', (code) => process.exit(code ?? 0))
}

if (onHostinger && existsSync(STACK_APP)) {
  console.log('[start] Hostinger Git deploy → passenger-stack-app (web + api + admin + proxy)')
  runNode(STACK_APP)
} else {
  if (!existsSync(STANDALONE)) {
    console.error(`Missing ${STANDALONE} — run: npm run build`)
    process.exit(1)
  }

  const port = process.env.PORT ?? '3000'
  console.log(`[start] Next standalone :${port}`)
  runNode(STANDALONE, {
    cwd: STANDALONE_DIR,
    env: { ...process.env, PORT: port, HOSTNAME: '0.0.0.0', NODE_ENV: 'production' },
  })
}

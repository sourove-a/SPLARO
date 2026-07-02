#!/usr/bin/env node
/**
 * Production start — Hostinger Express preset runs `npm start`.
 * Serves Next.js standalone when built; otherwise exits with a clear message.
 */
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STANDALONE = resolve(ROOT, 'apps/web/.next/standalone/apps/web/server.js')

if (!existsSync(STANDALONE)) {
  console.error(`Missing ${STANDALONE}`)
  console.error('Run build first: npm run build (or bash scripts/hostinger-build.sh)')
  process.exit(1)
}

const port = process.env.PORT ?? '3000'
const hostname = process.env.HOSTNAME ?? '0.0.0.0'

const child = spawn(process.execPath, [STANDALONE], {
  cwd: ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: hostname,
    NODE_ENV: 'production',
  },
})

child.on('exit', (code) => process.exit(code ?? 0))

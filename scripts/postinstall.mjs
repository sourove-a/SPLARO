#!/usr/bin/env node
/**
 * Hostinger Git deploy: npm install → npm run build (separate steps).
 * Do NOT run full next build here — postinstall timeout (~2–3 min) kills deploy.
 * Build runs via scripts/build.mjs → hostinger-build.sh on `npm run build`.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ua = process.env.npm_config_user_agent ?? ''

if (process.env.SKIP_SPLARO_POSTINSTALL === '1') process.exit(0)
if (ua.includes('pnpm') || ua.includes('yarn')) process.exit(0)
if (existsSync(resolve(ROOT, 'node_modules/.pnpm'))) process.exit(0)

console.log('[postinstall] Hostinger — defer build to `npm run build` (avoids install timeout)')
process.exit(0)

#!/usr/bin/env node
/**
 * Block accidental `npm install` at the monorepo root.
 * SPLARO uses pnpm (packageManager in package.json). npm breaks the workspace graph.
 */
const ua = process.env.npm_config_user_agent || ''
const isPnpm = /\bpnpm\//.test(ua)
const isYarn = /\byarn\//.test(ua)

if (!isPnpm && !isYarn && process.env.npm_command) {
  console.error('\n❌ This repo uses pnpm — do not run npm install here.\n')
  console.error('   Fix:')
  console.error('     corepack enable')
  console.error('     pnpm install')
  console.error('   Swiper (and other web deps) live in apps/web — already declared.\n')
  process.exit(1)
}

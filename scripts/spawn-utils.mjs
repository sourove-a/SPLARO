#!/usr/bin/env node
/**
 * Cross-platform child_process helpers — Windows needs shell for pnpm/npx/git.
 */
import { spawn, spawnSync } from 'child_process'
import { killProcessTree } from './port-utils.mjs'

export const IS_WIN = process.platform === 'win32'

/** Prefer 127.0.0.1 over localhost — avoids Windows IPv6 (::1) stalls. */
export function loopbackUrl(port, path = '') {
  const normalized = path.startsWith('/') ? path : path ? `/${path}` : ''
  return `http://127.0.0.1:${Number(port)}${normalized}`
}

/** Default spawn options for CLI tools (pnpm, npx, prisma, git). */
export function cliSpawnOpts(extra = {}) {
  return { shell: IS_WIN, windowsHide: IS_WIN, ...extra }
}

export function runSync(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, cliSpawnOpts(opts))
  if (result.error) throw result.error
  return result
}

/**
 * Spawn a long-lived CLI (pnpm/turbo). On Windows uses shell so .cmd resolves;
 * callers must shut down via killProcessTree (not child.kill alone).
 */
export function spawnCli(cmd, args, opts = {}) {
  return spawn(cmd, args, {
    stdio: 'inherit',
    ...cliSpawnOpts(opts),
  })
}

export { killProcessTree }

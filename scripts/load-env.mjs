#!/usr/bin/env node
/**
 * Load root .env into process.env (cross-platform — no bash required).
 * Existing process.env values are never overwritten.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function loadRootEnv(root = ROOT) {
  const envPath = resolve(root, '.env')
  if (!existsSync(envPath)) return false

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue

    const key = line.slice(0, eq).trim()
    if (!key || process.env[key] !== undefined) continue

    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
  return true
}

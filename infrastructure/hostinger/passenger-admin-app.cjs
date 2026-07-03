/**
 * Hostinger Passenger — SPLARO admin (admin.splaro.co)
 */
const path = require('path')
const fs = require('fs')
const Module = require('module')

function resolveRepoDir() {
  if (process.env.SPLARO_REPO_DIR) return process.env.SPLARO_REPO_DIR
  const home = process.env.HOME || ''
  if (home.includes('/domains/splaro.co')) {
    return path.join(home, 'public_html/.builds/source/repository')
  }
  if (home.includes('/domains/admin.splaro.co')) {
    return path.join(home, 'public_html/.builds/source/repository')
  }
  return path.join(home, 'domains/splaro.co/public_html/.builds/source/repository')
}

const repo = resolveRepoDir()
const standaloneAdmin = path.join(repo, 'apps/admin/.next/standalone/apps/admin')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(path.join(repo, '.env'))

process.env.NODE_ENV = process.env.NODE_ENV || 'production'
process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://splaro.co'
process.env.NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://splaro.co/api/v1'
process.env.NEXT_PUBLIC_ADMIN_URL =
  process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.splaro.co'

const nodePaths = [
  path.join(repo, 'node_modules'),
  path.join(repo, 'apps/admin/node_modules'),
].filter((p) => fs.existsSync(p))

process.env.NODE_PATH = nodePaths.join(path.delimiter)
Module._initPaths()

process.chdir(standaloneAdmin)
require(path.join(standaloneAdmin, 'server.js'))

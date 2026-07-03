/**
 * Hostinger Passenger startup — SPLARO storefront (splaro.co)
 * Resolves pnpm monorepo deps from the Git-deploy repository path.
 */
const path = require('path')
const Module = require('module')

function resolveRepoDir() {
  if (process.env.SPLARO_REPO_DIR) return process.env.SPLARO_REPO_DIR
  const home = process.env.HOME || ''
  if (home.includes('/domains/splaro.co')) {
    return path.join(home, 'public_html/.builds/source/repository')
  }
  return path.join(home, 'domains/splaro.co/public_html/.builds/source/repository')
}

const repo =
  process.env.SPLARO_REPO_DIR || resolveRepoDir()
const standaloneWeb = path.join(repo, 'apps/web/.next/standalone/apps/web')

process.env.NODE_PATH = [
  path.join(repo, 'node_modules'),
  path.join(repo, 'apps/web/node_modules'),
]
  .filter(Boolean)
  .join(path.delimiter)
Module._initPaths()

process.chdir(standaloneWeb)
require(path.join(standaloneWeb, 'server.js'))

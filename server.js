/**
 * Hostinger hPanel Node.js entry file (Deployments → Entry file: server.js).
 *
 * hPanel's Git deploy only runs `npm install` — it wipes build artifacts on
 * every push and never runs `npm run build`. So on boot: if any artifact is
 * missing, kick the full build + service start in the background while the
 * proxy comes up immediately (visitors see the site as soon as upstreams are
 * healthy, ~5-7 min on a fresh wipe).
 */
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const home = process.env.HOME || ''
// hPanel has used two checkout layouts so far — probe for whichever exists.
// __dirname is last: hPanel copies this entry into the runtime app root.
const domainRoot = home.includes('/domains/splaro.co') ? home : path.join(home, 'domains/splaro.co')
const repoCandidates = [
  process.env.SPLARO_REPO_DIR,
  path.join(domainRoot, 'public_html/.builds/source/repository'),
  path.join(domainRoot, 'nodejs'),
  __dirname,
].filter(Boolean)
const repo =
  repoCandidates.find((dir) => fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) ||
  repoCandidates[1]

const REQUIRED_ARTIFACTS = [
  'apps/web/.next/BUILD_ID',
  'apps/admin/.next/BUILD_ID',
  'apps/api/dist/main.js',
  'packages/config/dist/index.js',
  'packages/types/dist/index.js',
]

const missing = REQUIRED_ARTIFACTS.filter((p) => !fs.existsSync(path.join(repo, p)))
const lockFile = path.join(home, '.splaro-selfheal-build.lock')
const lockFresh = fs.existsSync(lockFile) && Date.now() - fs.statSync(lockFile).mtimeMs < 30 * 60 * 1000

if (missing.length > 0 && !lockFresh) {
  console.log(`[server.js] missing build artifacts (${missing.join(', ')}) — starting self-heal build`)
  fs.writeFileSync(lockFile, new Date().toISOString())
  const logFd = fs.openSync(path.join(home, 'splaro-selfheal.log'), 'a')
  const env = {
    ...process.env,
    PATH: `${home}/.local/bin:${home}/.local/share/pnpm:/opt/alt/alt-nodejs20/root/usr/bin:${process.env.PATH || ''}`,
  }
  const child = spawn(
    '/bin/bash',
    ['-c', 'bash scripts/hostinger-build.sh && bash infrastructure/hostinger/splaro-start-services.sh; rm -f "$HOME/.splaro-selfheal-build.lock"'],
    { cwd: repo, env, detached: true, stdio: ['ignore', logFd, logFd] },
  )
  child.unref()
}

// Proxy starts immediately; upstreams join as soon as they are built/booted.
require('./infrastructure/hostinger/passenger-stack-app.cjs')

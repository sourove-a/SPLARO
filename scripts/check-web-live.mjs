#!/usr/bin/env node
/**
 * Storefront console error smoke test for key routes.
 * Run: node scripts/check-web-live.mjs
 */
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { puppeteerLaunchOptions } from './puppeteer-chrome.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const require = createRequire(resolve(ROOT, 'apps/api/package.json'))

const BASE = process.env.WEB_URL ?? 'http://127.0.0.1:3000'
const ROUTES = ['/', '/shop', '/login']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function checkRoute(page, path) {
  const errors = []
  const onConsole = (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  }
  const onPageError = (err) => errors.push(String(err.message))

  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 45000 })
  await sleep(800)

  page.off('console', onConsole)
  page.off('pageerror', onPageError)

  const hydrationErrors = errors.filter(
    (e) => e.includes('Hydration') || e.includes('did not match'),
  )

  return { path, errors, hydrationErrors, ok: errors.length === 0 }
}

async function main() {
  const puppeteer = require('puppeteer')
  const browser = await puppeteer.launch(puppeteerLaunchOptions())

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    const results = []
    for (const path of ROUTES) {
      results.push(await checkRoute(page, path))
    }
    const ok = results.every((r) => r.ok)
    console.log(JSON.stringify({ ok, base: BASE, results }, null, 2))
    process.exit(ok ? 0 : 1)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

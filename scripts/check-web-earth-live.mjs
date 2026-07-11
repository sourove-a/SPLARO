#!/usr/bin/env node
/**
 * Refresh-cycle earth test for localhost storefront.
 * Run: node scripts/check-web-earth-live.mjs
 */
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const require = createRequire(resolve(ROOT, 'apps/api/package.json'))

const BASE = process.env.WEB_URL ?? 'http://localhost:3000'
const isRemoteBase = /^https?:\/\//.test(BASE) && !/localhost|127\.0\.0\.1/.test(BASE)
const NAV_WAIT = process.env.AUDIT_WAIT_UNTIL ?? (isRemoteBase ? 'domcontentloaded' : 'networkidle2')
const NAV_TIMEOUT = Number(process.env.AUDIT_NAV_TIMEOUT ?? (isRemoteBase ? 60000 : 30000))
const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

async function inspectPage(page) {
  return page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    window.scrollTo(0, document.body.scrollHeight)
    await sleep(1200)
    const map = document.querySelector('.site-footer__earth-fallback-map')
    const pos1 = map ? getComputedStyle(map).backgroundPosition : null
    await sleep(1500)
    const pos2 = map ? getComputedStyle(map).backgroundPosition : null
    return {
      pathname: location.pathname,
      footerMapMoved: pos1 !== pos2,
      footerMapStatic: map?.classList.contains('site-footer__earth-fallback-map--static') ?? null,
      footerWebGL: !!document.querySelector('.site-footer__earth-canvas canvas'),
      footerReady: document.querySelector('.site-footer__earth-canvas')?.getAttribute('data-earth-ready') === 'true',
      storyWebGL: !!document.querySelector('.story-earth-panel canvas'),
      storyReady: document.querySelector('.story-earth-panel [data-earth-ready="true"]') != null,
    }
  })
}

async function main() {
  const puppeteer = require('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH || CHROME
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? CHROME }
      : {}),
  })

  const results = []
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })

    for (const path of ['/', '/collections']) {
      for (let i = 0; i < 2; i++) {
        await page.goto(`${BASE}${path}`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
        const state = await inspectPage(page)
        results.push({ path, refresh: i + 1, ...state })
      }
    }

    const ok = results.every((r) => r.footerMapMoved || r.footerWebGL || r.footerReady)
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

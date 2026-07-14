#!/usr/bin/env node
/**
 * Full local storefront audit — API, catalog, contact, a11y basics.
 * Run: node scripts/audit-storefront-full.mjs
 */
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { puppeteerLaunchOptions } from './puppeteer-chrome.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const require = createRequire(resolve(ROOT, 'apps/api/package.json'))

const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:3000'
const API = process.env.API_URL ?? 'http://127.0.0.1:4000'
const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  const body = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, body }
}

async function browserChecks() {
  const puppeteer = require('puppeteer')
  const browser = await puppeteer.launch(puppeteerLaunchOptions())

  const out = { homepage: {}, shop: {}, login: {}, chatHref: null, consoleErrors: [] }

  try {
    const page = await browser.newPage()
    page.on('console', (msg) => {
      if (msg.type() === 'error') out.consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => out.consoleErrors.push(String(err.message)))

    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(`${WEB}/`, { waitUntil: 'networkidle2', timeout: 45000 })
    out.chatHref = await page.$eval('a[href*="wa.me"]', (a) => a.getAttribute('href')).catch(() => null)
    out.homepage.productCards = await page.$$eval('.splaro-card, .pc-shell', (els) => els.length).catch(() => 0)
    await sleep(8200)
    out.homepage.heroDotChanged = await page.evaluate(() => {
      const dots = [...document.querySelectorAll('.home-hero-slider .hero-dot')]
      return dots.some((d) => d.getAttribute('aria-current') !== 'true')
    })

    await page.goto(`${WEB}/shop`, { waitUntil: 'networkidle2', timeout: 45000 })
    out.shop.h1 = await page.$eval('h1', (el) => el.textContent?.trim() ?? null).catch(() => null)
    out.shop.productCards = await page.$$eval('.splaro-card, .pc-shell', (els) => els.length).catch(() => 0)

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle2', timeout: 45000 })
    await sleep(600)
    out.login.earthCanvas = await page.$('.auth-shell__earth-canvas canvas') !== null
    out.login.hydrationErrors = out.consoleErrors.filter(
      (e) => e.includes('Hydration') || e.includes('did not match'),
    )
  } finally {
    await browser.close()
  }

  return out
}

async function main() {
  const health = await fetchJson(`${API}/api/v1/health`)
  const products = await fetchJson(
    `${API}/api/v1/storefront/products?storeId=${STORE_ID}&limit=8`,
  )
  const settings = await fetchJson(`${API}/api/v1/storefront/settings?storeId=${STORE_ID}`)

  const browser = await browserChecks()

  const productTotal = products.body?.total ?? products.body?.products?.length ?? 0
  const whatsapp =
    settings.body?.social?.whatsapp ||
    settings.body?.store?.phone ||
    ''
  const phone = settings.body?.store?.phone || ''

  const checks = {
    apiHealth: health.ok && health.status === 200,
    dbConnected: health.body?.database === 'connected',
    productsTotalGt0: productTotal > 0,
    whatsappConfigured: Boolean(String(whatsapp).replace(/\D/g, '').length >= 10),
    shopHasH1: Boolean(browser.shop.h1),
    loginNoHydration: browser.login.hydrationErrors.length === 0,
    chatRealNumber: Boolean(browser.chatHref?.includes('8801905010205') || browser.chatHref?.includes('88019')),
    homepageHasProducts: browser.homepage.productCards > 0 || browser.shop.productCards > 0,
    heroAutoplay: browser.homepage.heroDotChanged === true,
    loginEarth: browser.login.earthCanvas === true,
  }

  const report = {
    ok: Object.values(checks).every(Boolean),
    web: WEB,
    api: API,
    checks,
    apiHealth: health.body,
    catalog: { total: productTotal, status: products.status },
    contact: { phone, whatsapp },
    browser,
  }

  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

#!/usr/bin/env node
/**
 * Cross-device UX smoke test — horizontal scroll rails, pointer safety, console errors.
 * Run: node scripts/check-web-device-ux.mjs
 */
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { puppeteerLaunchOptions } from './puppeteer-chrome.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const require = createRequire(resolve(ROOT, 'apps/api/package.json'))

const BASE = process.env.WEB_URL ?? 'http://127.0.0.1:3000'
const isRemoteBase = /^https?:\/\//.test(BASE) && !/localhost|127\.0\.0\.1/.test(BASE)
const NAV_WAIT = process.env.AUDIT_WAIT_UNTIL ?? (isRemoteBase ? 'domcontentloaded' : 'networkidle2')
const NAV_TIMEOUT = Number(process.env.AUDIT_NAV_TIMEOUT ?? (isRemoteBase ? 60000 : 45000))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const POST_NAV_SLEEP_MS = isRemoteBase ? 2000 : 800

function isIgnorableConsoleError(text) {
  return (
    /Content Security Policy directive/i.test(text) ||
    /googletagmanager\.com/i.test(text) ||
    /connect\.facebook\.net/i.test(text) ||
    /Meta pixel.*Bot traffic/i.test(text) ||
    /Failed to load resource: the server responded with a status of 503/i.test(text) ||
    /Failed to load resource.*404/.test(text) ||
    /Failed to fetch RSC payload.*Falling back to browser navigation/i.test(text) ||
    /\[GSI_LOGGER\]/i.test(text) ||
    /origin is not allowed for the given client ID/i.test(text)
  )
}

const SCENARIOS = [
  { path: '/', viewport: { width: 1366, height: 768 } },
  { path: '/', viewport: { width: 390, height: 844 } },
  { path: '/shop', viewport: { width: 1366, height: 768 } },
  { path: '/shop', viewport: { width: 390, height: 844 } },
  { path: '/shop', viewport: { width: 1024, height: 768 } },
  { path: '/collections', viewport: { width: 390, height: 844 } },
  { path: '/products/heritage-block-print-kurti', viewport: { width: 390, height: 844 } },
  { path: '/footwear', viewport: { width: 1366, height: 768 } },
  { path: '/footwear', viewport: { width: 390, height: 844 } },
  { path: '/accessories', viewport: { width: 390, height: 844 } },
  { path: '/login', viewport: { width: 1366, height: 768 } },
]

async function auditRoute(page, path, viewport) {
  const errors = []
  const onConsole = (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (isIgnorableConsoleError(text)) return
    errors.push(text)
  }
  const onPageError = (err) => errors.push(String(err.message))

  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  await page.setViewport(viewport)
  await page.goto(`${BASE}${path}`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
  await sleep(POST_NAV_SLEEP_MS)

  const ux = await page.evaluate(async () => {
    const sleepLocal = (ms) => new Promise((r) => setTimeout(r, ms))

    const bodyPointer = document.body.style.pointerEvents
    const scrollHints = document.documentElement.getAttribute('data-scroll-hints')

    const rails = [...document.querySelectorAll('.h-scroll-rail')]
    const railStates = rails.map((rail) => {
      const track = rail.querySelector('.h-scroll-rail__track')
      const prev = rail.querySelector('.h-scroll-rail__btn--prev')
      const next = rail.querySelector('.h-scroll-rail__btn--next')
      const overflow = track ? track.scrollWidth > track.clientWidth + 2 : false
      const prevStyle = prev ? getComputedStyle(prev) : null
      return {
        overflow,
        btnVisible: prevStyle ? prevStyle.display !== 'none' : false,
        btnSized: prev ? prev.offsetWidth >= 28 && prev.offsetHeight >= 28 : false,
        hasEdgeFade: rail.classList.contains('h-scroll-rail--can-right') ||
          rail.classList.contains('h-scroll-rail--can-left'),
      }
    })

    const overflowRails = railStates.filter((r) => r.overflow)
    const track =
      document.querySelector('.h-scroll-rail--controls .h-scroll-rail__track') ??
      document.querySelector('[data-h-scroll="true"]')

    let wheelScrollWorks = false
    if (track && track.scrollWidth > track.clientWidth + 2) {
      const before = track.scrollLeft
      track.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }))
      await sleepLocal(100)
      wheelScrollWorks = track.scrollLeft !== before
    }

    return {
      bodyPointer,
      scrollHints,
      railCount: rails.length,
      overflowRailCount: overflowRails.length,
      overflowWithButtons: overflowRails.filter((r) => r.btnVisible && r.btnSized).length,
      wheelScrollWorks,
    }
  })

  page.off('console', onConsole)
  page.off('pageerror', onPageError)

  const hydrationErrors = errors.filter(
    (e) => e.includes('Hydration') || e.includes('did not match'),
  )

  const buttonsOk =
    ux.overflowRailCount === 0 || ux.overflowWithButtons === ux.overflowRailCount

  return {
    path,
    viewport: `${viewport.width}x${viewport.height}`,
    errors,
    hydrationErrors,
    ux,
    ok:
      errors.length === 0 &&
      hydrationErrors.length === 0 &&
      ux.bodyPointer !== 'none' &&
      buttonsOk,
  }
}

async function resolveProductPath(page) {
  const findLink = () =>
    page.evaluate(() => {
      const link =
        document.querySelector('a[href^="/products/"]') ??
        document.querySelector('.splaro-card a[href^="/products/"]') ??
        document.querySelector('.shop-product-card a[href^="/products/"]')
      return link?.getAttribute('href') ?? null
    })

  for (const path of ['/', '/shop']) {
    await page.goto(`${BASE}${path}`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
    await sleep(POST_NAV_SLEEP_MS)
    const href = await findLink()
    if (href) return href
  }
  return null
}

async function auditHomeToProductHeader(page) {
  const errors = []
  const onConsole = (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (isIgnorableConsoleError(text)) return
    errors.push(text)
  }
  page.on('console', onConsole)

  const viewport = { width: 1366, height: 768 }
  await page.setViewport(viewport)
  await page.goto(`${BASE}/`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
  await sleep(POST_NAV_SLEEP_MS)

  const { before, productHref } = await page.evaluate(() => {
    const header = document.querySelector('[data-header-chrome]')
    const rect = header?.getBoundingClientRect()
    const link =
      document.querySelector('a[href^="/products/"]') ??
      document.querySelector('.splaro-card a[href^="/products/"]') ??
      document.querySelector('.shop-product-card a[href^="/products/"]')
    return {
      before: {
        topbar: document.documentElement.getAttribute('data-topbar'),
        headerTop: rect?.top ?? null,
      },
      productHref: link?.getAttribute('href') ?? null,
    }
  })

  let href = productHref
  if (!href) {
    href = await resolveProductPath(page)
  }

  let leavePath = href
  if (!leavePath) {
    leavePath = '/shop'
  }

  if (!href) {
    await page.setViewport(viewport)
    await page.goto(`${BASE}/`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
    await sleep(POST_NAV_SLEEP_MS)
  }

  if (!leavePath) {
    page.off('console', onConsole)
    return {
      path: '/ → leave home',
      viewport: `${viewport.width}x${viewport.height}`,
      errors,
      ok: false,
      skip: 'no leave-home link',
    }
  }

  await page.evaluate((targetHref) => {
    document.querySelector(`a[href="${targetHref}"]`)?.click()
  }, leavePath)
  await page.waitForFunction(() => window.location.pathname !== '/', { timeout: NAV_TIMEOUT })
  await sleep(400)

  const after = await page.evaluate(() => {
    const header = document.querySelector('[data-header-chrome]')
    const rect = header?.getBoundingClientRect()
    return {
      topbar: document.documentElement.getAttribute('data-topbar'),
      headerTop: rect?.top ?? null,
    }
  })

  page.off('console', onConsole)

  const headerSnapped = after.headerTop !== null && after.headerTop <= 2
  const topbarHidden = after.topbar === 'hidden'

  return {
    path: '/ → leave home',
    viewport: `${viewport.width}x${viewport.height}`,
    errors,
    before,
    after,
    leavePath,
    productHref: href ?? (leavePath.startsWith('/products/') ? leavePath : null),
    ok: errors.length === 0 && headerSnapped && topbarHidden,
  }
}

async function auditPdpMobileFabClear(page, productHref) {
  if (!productHref) {
    productHref = await resolveProductPath(page)
  }
  if (!productHref) {
    productHref = '/products/heritage-block-print-kurti'
  }

  const viewport = { width: 390, height: 844 }
  await page.setViewport(viewport)
  await page.goto(`${BASE}${productHref}`, {
    waitUntil: NAV_WAIT,
    timeout: NAV_TIMEOUT,
  })
  await sleep(POST_NAV_SLEEP_MS)

  await page.evaluate(async () => {
    const sleepLocal = (ms) => new Promise((r) => setTimeout(r, ms))
    window.scrollTo(0, document.body.scrollHeight * 0.45)
    await sleepLocal(500)
  })

  const state = await page.evaluate(() => {
    const sticky = document.querySelector('.pp-mobile-sticky-bar:not(.pp-mobile-sticky-bar--hidden)')
    const fab = document.querySelector('[data-floating-system]')
    const fabStyle = fab ? getComputedStyle(fab) : null
    return {
      stickyVisible: Boolean(sticky),
      fabPointerEvents: fabStyle?.pointerEvents ?? null,
      fabOpacity: fabStyle?.opacity ?? null,
      bodyFlag: document.body.getAttribute('data-pdp-sticky-cta'),
    }
  })

  const fabClear =
    !state.stickyVisible ||
    state.bodyFlag === 'true' ||
    state.fabPointerEvents === 'none' ||
    Number(state.fabOpacity) < 0.05

  return {
    path: '/products/* mobile FAB',
    viewport: `${viewport.width}x${viewport.height}`,
    state,
    ok: fabClear,
  }
}

async function main() {
  const puppeteer = require('puppeteer')
  const browser = await puppeteer.launch(puppeteerLaunchOptions())

  try {
    const page = await browser.newPage()
    const results = []

    for (const scenario of SCENARIOS) {
      results.push(await auditRoute(page, scenario.path, scenario.viewport))
    }

    const headerResult = await auditHomeToProductHeader(page)
    results.push(headerResult)
    results.push(await auditPdpMobileFabClear(page, headerResult.productHref))

    const ok = results.every((r) => r.ok)
    console.log(JSON.stringify({ ok, base: BASE, scanned: results.length, results }, null, 2))
    process.exit(ok ? 0 : 1)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

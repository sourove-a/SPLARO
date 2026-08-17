#!/usr/bin/env node
/**
 * Cross-browser storefront matrix — Chromium (Mac + Windows UA), Firefox, WebKit.
 * Windows pass: native scroll, no Lenis, wheel scroll, overlay lock release.
 *
 * Prereq: pnpm dev:stack (or WEB_URL)
 * Run: pnpm check:web:browsers
 */
import { applyPlaywrightBrowsersPath } from './playwright-browsers-path.mjs'
import {
  BASE,
  NAV_TIMEOUT,
  NAV_WAIT,
  POST_NAV_SLEEP_MS,
  WIN_CHROME_UA,
  isIgnorableConsoleError,
  sleep,
} from './web-audit-shared.mjs'

applyPlaywrightBrowsersPath()

const { chromium, firefox, webkit } = await import('playwright')

const SKIP = new Set(
  (process.env.BROWSER_MATRIX_SKIP ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

const ONLY = new Set(
  (process.env.BROWSER_MATRIX_ONLY ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

const ROUTES = [
  { path: '/', viewport: { width: 1366, height: 768 } },
  { path: '/', viewport: { width: 390, height: 844 } },
  { path: '/shop', viewport: { width: 1366, height: 768 } },
  { path: '/shop', viewport: { width: 390, height: 844 } },
  { path: '/login', viewport: { width: 1366, height: 768 } },
  { path: '/cart', viewport: { width: 390, height: 844 } },
]

/** @type {{ id: string; label: string; launcher: typeof chromium; context?: object; windowsPass?: boolean }[]} */
const BROWSERS = [
  {
    id: 'chromium',
    label: 'Chromium (default UA)',
    launcher: chromium,
  },
  {
    id: 'chromium',
    label: 'Chromium (Windows Chrome UA)',
    launcher: chromium,
    windowsPass: true,
    context: {
      userAgent: WIN_CHROME_UA,
      viewport: { width: 1366, height: 768 },
    },
  },
  {
    id: 'firefox',
    label: 'Firefox',
    launcher: firefox,
  },
  {
    id: 'webkit',
    label: 'WebKit (Safari engine)',
    launcher: webkit,
  },
]

async function gotoWithRetry(page, url) {
  let lastErr
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
      return
    } catch (err) {
      lastErr = err
      if (!/ERR_CONNECTION|CONNECTION_REFUSED|Could not connect/i.test(String(err))) throw err
      await sleep(1200 * attempt)
    }
  }
  throw lastErr
}

async function assertWebReachable() {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    console.error(
      `\nStorefront not reachable at ${BASE}. Start stack first:\n  pnpm dev:reset\n\nOr test production:\n  WEB_URL=https://splaro.co pnpm check:web:browsers\n`,
    )
    throw err
  }
}

function shouldRunBrowser(id) {
  if (ONLY.size > 0 && !ONLY.has(id)) return false
  if (SKIP.has(id)) return false
  return true
}

function attachErrorCollectors(page, bucket) {
  const onConsole = (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (isIgnorableConsoleError(text)) return
    bucket.push(text)
  }
  const onPageError = (err) => {
    const text = String(err.message ?? err)
    if (isIgnorableConsoleError(text)) return
    bucket.push(text)
  }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  return () => {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
  }
}

async function auditRoute(page, path, viewport) {
  const errors = []
  const detach = attachErrorCollectors(page, errors)

  await page.setViewportSize(viewport)
  await gotoWithRetry(page, `${BASE}${path}`)
  await sleep(POST_NAV_SLEEP_MS)

  const ux = await page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    return {
      dataOs: doc.getAttribute('data-os'),
      scrollEngine: doc.getAttribute('data-scroll-engine'),
      hasLenisClass: doc.classList.contains('lenis'),
      bodyPointer: body?.style.pointerEvents ?? '',
      pageOverflow:
        doc.scrollWidth > doc.clientWidth + 2 || (body?.scrollWidth ?? 0) > doc.clientWidth + 2,
      scrollY: window.scrollY,
    }
  })

  detach()

  const hydrationErrors = errors.filter(
    (e) => e.includes('Hydration') || e.includes('did not match'),
  )

  return {
    path,
    viewport: `${viewport.width}x${viewport.height}`,
    errors: errors.slice(0, 12),
    hydrationErrors,
    ux,
    ok:
      errors.length === 0 &&
      hydrationErrors.length === 0 &&
      ux.bodyPointer !== 'none' &&
      !ux.pageOverflow,
  }
}

async function auditWindowsScroll(page) {
  await page.setViewportSize({ width: 1366, height: 768 })
  await gotoWithRetry(page, `${BASE}/`)
  await sleep(POST_NAV_SLEEP_MS)

  const boot = await page.evaluate(() => ({
    dataOs: document.documentElement.getAttribute('data-os'),
    scrollEngine: document.documentElement.getAttribute('data-scroll-engine'),
    hasLenis: document.documentElement.classList.contains('lenis'),
  }))

  await page.evaluate(() => window.scrollTo(0, 0))
  const before = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel(0, 600)
  await sleep(350)
  const afterWheel = await page.evaluate(() => window.scrollY)
  const wheelScrollWorks = afterWheel > before + 20

  await page.evaluate(() => window.scrollTo(0, 480))
  await sleep(200)
  const scrollBeforeOverlay = await page.evaluate(() => Math.round(window.scrollY))

  const searchBtn = page.locator('button[aria-label="Search"]').first()
  let overlayOpened = false
  let overlayReleased = false
  if (await searchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchBtn.click()
    await sleep(400)
    overlayOpened = await page.evaluate(() =>
      document.documentElement.hasAttribute('data-scroll-lock'),
    )
    await page.keyboard.press('Escape')
    await sleep(500)
    overlayReleased = await page.evaluate(() => {
      const html = document.documentElement
      return (
        !html.hasAttribute('data-scroll-lock') &&
        html.style.pointerEvents !== 'none' &&
        document.body.style.pointerEvents !== 'none'
      )
    })
    const scrollAfterOverlay = await page.evaluate(() => Math.round(window.scrollY))
    overlayReleased =
      overlayReleased && Math.abs(scrollAfterOverlay - scrollBeforeOverlay) <= 80
  }

  const checks = {
    dataOsWindows: boot.dataOs === 'windows',
    nativeScrollEngine: boot.scrollEngine === 'native' && !boot.hasLenis,
    wheelScrollWorks,
    overlayLockReleased: !overlayOpened || overlayReleased,
  }

  return {
    boot,
    scrollBeforeOverlay,
    checks,
    ok: Object.values(checks).every(Boolean),
  }
}

async function runBrowserMatrix(browserDef) {
  const browser = await browserDef.launcher.launch({ headless: true })
  const results = []

  try {
    const context = await browser.newContext({
      ...(browserDef.context ?? {}),
    })
    const page = await context.newPage()

    for (const route of ROUTES) {
      results.push({
        kind: 'route',
        browser: browserDef.label,
        ...(await auditRoute(page, route.path, route.viewport)),
      })
      await sleep(200)
    }

    if (browserDef.windowsPass) {
      results.push({
        kind: 'windows-scroll',
        browser: browserDef.label,
        ...(await auditWindowsScroll(page)),
      })
    }

    await context.close()
  } finally {
    await browser.close()
  }

  return results
}

async function main() {
  await assertWebReachable()

  const active = BROWSERS.filter((b) => shouldRunBrowser(b.id))
  if (active.length === 0) {
    console.error('No browsers selected (check BROWSER_MATRIX_ONLY / BROWSER_MATRIX_SKIP)')
    process.exit(1)
  }

  const allResults = []
  for (const def of active) {
    try {
      allResults.push(...(await runBrowserMatrix(def)))
    } catch (err) {
      const msg = String(err?.message ?? err)
      if (/Executable doesn't exist|browserType.launch/i.test(msg)) {
        console.error(
          '\nPlaywright browsers missing. Run:\n  pnpm exec playwright install chromium firefox webkit\n',
        )
      }
      allResults.push({
        kind: 'fatal',
        browser: def.label,
        ok: false,
        errors: [msg],
      })
    }
  }

  const ok = allResults.every((r) => r.ok !== false)
  console.log(
    JSON.stringify(
      {
        ok,
        base: BASE,
        browsers: active.map((b) => b.label),
        scanned: allResults.length,
        results: allResults,
      },
      null,
      2,
    ),
  )
  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

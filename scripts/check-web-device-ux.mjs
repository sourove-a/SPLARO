#!/usr/bin/env node
/**
 * Cross-device UX smoke test — horizontal scroll rails, pointer safety, console errors.
 * Run: node scripts/check-web-device-ux.mjs
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
    /Failed to fetch RSC payload.*Falling back to browser navigation/i.test(text)
  )
}

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

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

async function main() {
  const puppeteer = require('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: CHROME,
  })

  try {
    const page = await browser.newPage()
    const results = []

    for (const scenario of SCENARIOS) {
      results.push(await auditRoute(page, scenario.path, scenario.viewport))
    }

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

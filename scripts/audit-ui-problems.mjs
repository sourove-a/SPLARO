#!/usr/bin/env node
/**
 * Broad UI problem scan — routes, console, a11y basics, broken assets.
 * Run: node scripts/audit-ui-problems.mjs
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
const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const POST_NAV_SLEEP_MS = isRemoteBase ? 2000 : 600

function isIgnorableConsoleError(text) {
  return (
    /Content Security Policy directive/i.test(text) ||
    /googletagmanager\.com/i.test(text) ||
    /connect\.facebook\.net/i.test(text) ||
    /Meta pixel.*Bot traffic/i.test(text) ||
    /Failed to load resource: the server responded with a status of 503/i.test(text) ||
    /Failed to fetch RSC payload.*Falling back to browser navigation/i.test(text)
  )
}

const ROUTES = [
  '/',
  '/shop',
  '/collections',
  '/login',
  '/signup',
  '/cart',
  '/checkout',
  '/about',
  '/contact',
  '/track-order',
  '/search?q=panjabi',
  '/c/women',
  '/c/men',
  '/products/heritage-block-print-kurti',
  '/footwear',
  '/accessories',
]

async function auditRoute(page, path) {
  const consoleErrors = []
  const consoleWarnings = []
  const onConsole = (msg) => {
    const text = msg.text()
    if (msg.type() === 'error' && !isIgnorableConsoleError(text)) consoleErrors.push(text.slice(0, 400))
    if (msg.type() === 'warning') consoleWarnings.push(text.slice(0, 200))
  }
  const onPageError = (err) => consoleErrors.push(String(err.message).slice(0, 400))

  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  let status = null
  for (let attempt = 1; attempt <= (isRemoteBase ? 2 : 1); attempt += 1) {
    try {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
      status = res?.status() ?? null
      if (status !== 503) break
      if (attempt < 2) await sleep(1500)
    } catch (err) {
      if (attempt >= (isRemoteBase ? 2 : 1)) {
        page.off('console', onConsole)
        page.off('pageerror', onPageError)
        return { path, status: 'timeout', issues: [`Navigation failed: ${err.message}`] }
      }
      await sleep(1500)
    }
  }

  await sleep(POST_NAV_SLEEP_MS)

  const data = await page.evaluate(() => {
    const h1s = [...document.querySelectorAll('h1')].map((el) => el.textContent?.trim()).filter(Boolean)
    const brokenImgs = [...document.querySelectorAll('img')]
      .filter(
        (img) =>
          img.complete &&
          img.naturalWidth === 0 &&
          !img.src.includes('data:') &&
          !String(img.src || img.getAttribute('src') || '').includes('placeholder-product'),
      )
      .map((img) => img.src || img.getAttribute('src') || 'unknown')
      .slice(0, 5)
    const emptyLinks = [...document.querySelectorAll('a[href="#"], a:not([href])')].length
    const main = document.querySelector('main')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return {
      title: document.title,
      h1Count: h1s.length,
      h1s: h1s.slice(0, 3),
      brokenImgs,
      emptyLinks,
      hasMain: !!main,
      bodyClasses: document.body.className,
    }
  })

  page.off('console', onConsole)
  page.off('pageerror', onPageError)

  const issues = []
  if (status && status >= 400) issues.push(`HTTP ${status}`)
  if (data.h1Count === 0 && !['/cart', '/checkout'].includes(path)) {
    issues.push('Missing visible h1')
  }
  if (data.h1Count > 1 && path !== '/') {
    issues.push(`Multiple h1 (${data.h1Count}): ${data.h1s.join(' | ')}`)
  }
  if (data.brokenImgs.length) issues.push(`Broken images: ${data.brokenImgs.join(', ')}`)
  if (consoleErrors.length) {
    const hydration = consoleErrors.filter((e) => e.includes('Hydration') || e.includes('did not match'))
    if (hydration.length) issues.push(`Hydration error (${hydration.length})`)
    else issues.push(`Console errors (${consoleErrors.length})`)
  }

  return {
    path,
    status,
    ...data,
    consoleErrors: consoleErrors.slice(0, 2),
    consoleWarnings: consoleWarnings.slice(0, 2),
    issues,
  }
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

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })

    const results = []
    for (const path of ROUTES) {
      results.push(await auditRoute(page, path))
    }

    // Homepage reduced-motion specific
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    const reducedHome = await auditRoute(page, '/')
    reducedHome.path = '/ (reduced-motion)'

    const problems = results.filter((r) => r.issues.length > 0)
    if (reducedHome.issues.length) problems.push(reducedHome)

    console.log(
      JSON.stringify(
        {
          ok: problems.length === 0,
          base: BASE,
          scanned: results.length + 1,
          problemCount: problems.length,
          problems,
          clean: results.filter((r) => r.issues.length === 0).map((r) => r.path),
        },
        null,
        2,
      ),
    )
    process.exit(problems.length === 0 ? 0 : 1)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

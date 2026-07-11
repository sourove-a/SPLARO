#!/usr/bin/env node
/**
 * Live COD order E2E — signup → shop → cart → checkout → confirmation → track.
 * Run: WEB_URL=https://splaro.co node scripts/live-cod-order-e2e.mjs
 */
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const require = createRequire(resolve(ROOT, 'apps/api/package.json'))

const WEB = process.env.WEB_URL ?? 'http://localhost:3000'
const PRODUCT_SLUG = process.env.E2E_PRODUCT_SLUG ?? 'heritage-block-print-kurti'
const isRemote = /^https?:\/\//.test(WEB) && !/localhost|127\.0\.0\.1/.test(WEB)
const NAV_WAIT = process.env.AUDIT_WAIT_UNTIL ?? (isRemote ? 'domcontentloaded' : 'networkidle2')
const NAV_TIMEOUT = Number(process.env.AUDIT_NAV_TIMEOUT ?? (isRemote ? 60000 : 45000))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function uniqueTestUser() {
  const stamp = Date.now()
  return {
    name: 'SPLARO Go-Live Test',
    email: `golive+${stamp}@splaro.test`,
    phone: `017${String(stamp).slice(-8)}`,
    password: 'GoLiveTest1!',
  }
}

async function assertCatalog() {
  const res = await fetch(`${WEB}/api/products?limit=3`, { signal: AbortSignal.timeout(20000) })
  const body = await res.json().catch(() => ({}))
  const count = Array.isArray(body.products) ? body.products.length : 0
  if (!res.ok || count === 0) {
    throw new Error(
      `Catalog empty or unavailable (HTTP ${res.status}, source=${body.source ?? 'unknown'}) — run deploy seed first`,
    )
  }
  return body.products
}

async function main() {
  await assertCatalog()

  const user = uniqueTestUser()
  const puppeteer = require('puppeteer')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH || CHROME
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? CHROME }
      : {}),
  })

  const result = { ok: false, user, steps: {}, orderId: null, confirmationUrl: null }

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844 })

    // Signup
    await page.goto(`${WEB}/signup`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
    await page.waitForSelector('input[placeholder="Full name"]', { timeout: 15000 })
    await page.type('input[placeholder="Full name"]', user.name, { delay: 20 })
    await page.type('input[placeholder="Email address"]', user.email, { delay: 20 })
    await page.type('input[placeholder="01XXXXXXXXX"]', user.phone, { delay: 20 })
    await page.type('input[placeholder="Password (min 8 characters)"]', user.password, { delay: 20 })
    await Promise.all([
      page.waitForNavigation({ waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT }).catch(() => null),
      page.click('button[type="submit"]'),
    ])
    await sleep(1200)
    result.steps.signup = page.url()

    // Shop → add first product card
    await page.goto(`${WEB}/shop`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
    await sleep(800)
    const addBtn = await page.$('button[aria-label*="Add"][aria-label*="to bag"]')
    if (!addBtn) {
      await page.goto(`${WEB}/products/${PRODUCT_SLUG}`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
      await sleep(600)
      const pdpAdd = await page.$('button[aria-label*="Add"][aria-label*="to bag"]')
      if (!pdpAdd) throw new Error('No add-to-bag control on shop or PDP')
      await pdpAdd.click()
    } else {
      await addBtn.click()
    }
    await sleep(1000)
    result.steps.addedToBag = true

    // Cart sanity
    await page.goto(`${WEB}/cart`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
    await sleep(600)
    const cartEmpty = await page.evaluate(() => {
      return document.body.textContent?.includes('Your bag is empty') ?? false
    })
    if (cartEmpty) throw new Error('Cart empty after add-to-bag')
    result.steps.cartHasItems = true

    // Checkout
    await page.goto(`${WEB}/checkout`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
    await sleep(800)

    await page.type('input[name="name"], input[autocomplete="name"]', user.name, { delay: 15 }).catch(() => {})
    await page.type('input[name="email"], input[autocomplete="email"]', user.email, { delay: 15 }).catch(() => {})
    await page.type('input[name="phone"], input[autocomplete="tel-national"]', user.phone, { delay: 15 }).catch(() => {})

    await page.select('select[name="city"]', 'Dhaka').catch(async () => {
      await page.click('select[name="city"]')
      await page.keyboard.type('Dhaka')
    })
    await sleep(400)
    await page.select('select[name="thana"]', 'Gulshan').catch(async () => {
      const thana = await page.$('select[name="thana"] option:nth-child(2)')
      if (thana) await thana.click()
    })
    await page.type('input[name="address"], textarea[name="address"]', 'House 12, Road 5, Gulshan', {
      delay: 15,
    })

    // COD payment
    const codCard = await page.evaluateHandle(() => {
      const cards = [...document.querySelectorAll('.checkout-payment-card, [class*="checkout-payment"]')]
      return (
        cards.find((el) => el.textContent?.includes('Cash on Delivery')) ??
        [...document.querySelectorAll('button, label, div')].find((el) =>
          el.textContent?.trim().startsWith('Cash on Delivery'),
        )
      )
    })
    if (codCard) await codCard.asElement()?.click()
    await sleep(400)

    await Promise.all([
      page.waitForNavigation({ waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT }).catch(() => null),
      page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) =>
          /place order/i.test(b.textContent ?? ''),
        )
        btn?.click()
      }),
    ])
    await sleep(2000)

    const url = page.url()
    result.confirmationUrl = url
    const orderMatch = url.match(/order-confirmation\/([^/?#]+)/)
    result.orderId = orderMatch?.[1] ?? null
    result.steps.checkoutUrl = url

    if (!result.orderId) {
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000))
      throw new Error(`Order confirmation not reached. URL=${url} snippet=${bodyText.slice(0, 200)}`)
    }

    // Track order
    await page.goto(`${WEB}/track-order`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
    await sleep(500)
    await page.type('input[placeholder*="order"], input[name="orderId"]', result.orderId, { delay: 20 }).catch(
      async () => {
        const inputs = await page.$$('input')
        if (inputs[0]) await inputs[0].type(result.orderId, { delay: 20 })
      },
    )
    await page.type('input[placeholder*="phone"], input[name="phone"]', user.phone, { delay: 20 }).catch(
      async () => {
        const inputs = await page.$$('input')
        if (inputs[1]) await inputs[1].type(user.phone, { delay: 20 })
      },
    )
    await page.click('button[type="submit"]').catch(() => page.click('button'))
    await sleep(1500)
    result.steps.trackOrderFound = await page.evaluate(() => {
      const text = document.body.innerText
      return /SPL-|Order|Pending|Confirmed|Processing/i.test(text)
    })

    result.ok = Boolean(result.orderId && result.steps.trackOrderFound)
    console.log(JSON.stringify(result, null, 2))
    process.exit(result.ok ? 0 : 1)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err.message ?? err) }, null, 2))
  process.exit(1)
})

#!/usr/bin/env node
/**
 * Live COD order E2E — signup → shop → cart → checkout → confirmation → track.
 * Run: WEB_URL=https://splaro.co node scripts/live-cod-order-e2e.mjs
 */
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { puppeteerLaunchOptions } from './puppeteer-chrome.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const require = createRequire(resolve(ROOT, 'apps/api/package.json'))

const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:3000'
const PRODUCT_SLUG = process.env.E2E_PRODUCT_SLUG ?? 'heritage-block-print-kurti'
const isRemote = /^https?:\/\//.test(WEB) && !/localhost|127\.0\.0\.1/.test(WEB)
const NAV_WAIT = process.env.AUDIT_WAIT_UNTIL ?? (isRemote ? 'domcontentloaded' : 'networkidle2')
const NAV_TIMEOUT = Number(process.env.AUDIT_NAV_TIMEOUT ?? (isRemote ? 60000 : 45000))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function uniqueTestUser() {
  const stamp = Date.now()
  return {
    name: 'SPLARO Go-Live Test',
    email: `golive+${stamp}@splaro.test`,
    phone: `017${String(stamp).slice(-8)}`,
    password: 'GoLiveTest1!',
  }
}

async function setFieldValue(page, selector, value) {
  const el = await page.$(selector)
  if (!el) return false
  await el.click({ clickCount: 3 })
  await page.evaluate(
    (sel, v) => {
      const node = document.querySelector(sel)
      if (!node) return
      node.value = v
      node.dispatchEvent(new Event('input', { bubbles: true }))
      node.dispatchEvent(new Event('change', { bubbles: true }))
    },
    selector,
    value,
  )
  return true
}

async function fillCheckout(page, user) {
  await page.waitForSelector('#checkout-name', { timeout: 15000 })
  await setFieldValue(page, '#checkout-name', user.name)
  await setFieldValue(page, '#checkout-email', user.email)
  await setFieldValue(page, '[data-checkout-field="phone"] input', user.phone)
  await page.select('#checkout-city', 'Dhaka')
  await sleep(300)
  await page.select('#checkout-thana', 'Gulshan')
  await setFieldValue(page, '#checkout-address', 'House 12, Road 5, Gulshan')
  await page.click('.checkout-payment--featured, .checkout-payment').catch(() => {})
  await sleep(400)
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
  const browser = await puppeteer.launch(puppeteerLaunchOptions())

  const result = { ok: false, user, steps: {}, orderId: null, confirmationUrl: null }

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844 })
    const orderApi = { status: null, body: null }
    page.on('response', async (res) => {
      if (!res.url().includes('/api/orders')) return
      if (res.request().method() !== 'POST') return
      orderApi.status = res.status()
      orderApi.body = await res.json().catch(() => null)
    })

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

    await page.goto(`${WEB}/products/${PRODUCT_SLUG}`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
    await sleep(1500)
    const buyNow = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /buy now/i.test(b.textContent ?? ''))
      if (!btn) return false
      btn.click()
      return true
    })
    if (!buyNow) throw new Error('Buy Now button not found on PDP')
    await page.waitForNavigation({ waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT }).catch(() => null)
    await sleep(1500)
    result.steps.buyNow = page.url()

    if (!page.url().includes('/checkout')) {
      await page.goto(`${WEB}/cart`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
      await sleep(1500)
      const cartEmpty = await page.evaluate(() => document.body.textContent?.includes('Your bag is empty') ?? false)
      if (cartEmpty) throw new Error('Cart empty after Buy Now')
      await page.click('.cart-checkout-btn')
      await page.waitForNavigation({ waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT }).catch(() => null)
    }

    await page.waitForSelector('#checkout-name', { timeout: 15000 })
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading your bag'),
      { timeout: 15000 },
    )
    await sleep(800)
    await fillCheckout(page, user)

    await Promise.all([
      page.waitForFunction(() => /order-confirmation/.test(location.pathname), { timeout: NAV_TIMEOUT }).catch(() => null),
      page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => /place order/i.test(b.textContent ?? ''))
        btn?.click()
      }),
    ])
    await sleep(3000)

    let url = page.url()
    if (orderApi.status === 201 && orderApi.body?.order?.id) {
      result.orderId = orderApi.body.order.id
      result.steps.orderApi = orderApi
      if (!url.includes('order-confirmation')) {
        await page.goto(`${WEB}/order-confirmation/${result.orderId}`, {
          waitUntil: NAV_WAIT,
          timeout: NAV_TIMEOUT,
        })
        url = page.url()
      }
    }

    result.confirmationUrl = url
    if (!result.orderId) {
      const orderMatch = url.match(/order-confirmation\/([^/?#]+)/)
      result.orderId = orderMatch?.[1] ?? null
    }
    result.steps.checkoutUrl = url

    if (!result.orderId) {
      const debug = await page.evaluate(() => ({
        text: document.body.innerText.slice(0, 2000),
        error: document.querySelector('.checkout-error-banner')?.textContent?.trim() ?? null,
        invalid: [...document.querySelectorAll('[data-invalid="true"]')].map((el) => el.getAttribute('data-checkout-field')),
      }))
      result.steps.orderApi = orderApi
      throw new Error(
        `Order confirmation not reached. URL=${url} api=${JSON.stringify(orderApi)} error=${debug.error ?? 'none'} invalid=${debug.invalid.join(',')}`,
      )
    }

    await page.goto(`${WEB}/track-order`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })
    await sleep(500)
    await page.type('input[placeholder*="order"], input[name="orderId"]', result.orderId, { delay: 20 }).catch(async () => {
      const inputs = await page.$$('input')
      if (inputs[0]) await inputs[0].type(result.orderId, { delay: 20 })
    })
    await page.type('input[placeholder*="phone"], input[name="phone"]', user.phone, { delay: 20 }).catch(async () => {
      const inputs = await page.$$('input')
      if (inputs[1]) await inputs[1].type(user.phone, { delay: 20 })
    })
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

#!/usr/bin/env node
/**
 * Live verify admin login Earth globe rotates.
 * Run: node scripts/check-admin-earth-live.mjs
 * Requires: admin dev server on :3001, puppeteer (apps/api dependency).
 */
import { createRequire } from 'module'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const require = createRequire(resolve(ROOT, 'apps/api/package.json'))

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3001/login'
const WAIT_MS = Number(process.env.EARTH_WAIT_MS ?? 6000)

async function main() {
  let puppeteer
  try {
    puppeteer = require('puppeteer')
  } catch {
    console.error('puppeteer not found — run: pnpm install (apps/api has puppeteer)')
    process.exit(1)
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 832 })

    const reducedMotion = await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query) => ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }),
      })
    })
    void reducedMotion

    await page.goto(ADMIN_URL, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise((r) => setTimeout(r, WAIT_MS))

    const state = await page.evaluate(() => {
      const canvas = document.querySelector('.admin-auth-shell__earth-canvas canvas')
      const host = document.querySelector('.admin-auth-shell__earth-canvas')
      return {
        earthReady: host?.getAttribute('data-earth-ready') === 'true',
        canvasSize: canvas
          ? { bufferW: canvas.width, bufferH: canvas.height }
          : null,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      }
    })

    const shot1 = await page.screenshot({ encoding: 'base64' })
    await new Promise((r) => setTimeout(r, 2500))
    const shot2 = await page.screenshot({ encoding: 'base64' })
    const screenshotsDiffer = shot1 !== shot2

    const ok = state.earthReady && state.canvasSize && screenshotsDiffer

    console.log(
      JSON.stringify(
        {
          ok,
          url: ADMIN_URL,
          earthReady: state.earthReady,
          canvasSize: state.canvasSize,
          reducedMotion: state.reducedMotion,
          screenshotsDiffer,
        },
        null,
        2,
      ),
    )

    process.exit(ok ? 0 : 1)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

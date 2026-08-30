#!/usr/bin/env node
/**
 * Before/after screenshots for storefront visual work.
 *
 * CI renders nothing — it will go green on a layout that is visibly wrong.
 * This is the net for that: capture the same routes at the same widths before
 * a styling change and after it, then compare, so a change meant for one
 * section cannot quietly move another page without anyone noticing.
 *
 *   node scripts/shot-web.mjs --label before
 *   …make the change…
 *   node scripts/shot-web.mjs --label after
 *   node scripts/shot-web.mjs --compare before after
 *
 * WEB_URL points it at localhost (default) or any deployed origin.
 * Output goes to .screenshots/<label>/ — gitignored, never committed.
 */
import { createRequire } from 'module'
import { mkdirSync, readdirSync, existsSync, writeFileSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { puppeteerLaunchOptions } from './puppeteer-chrome.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const require = createRequire(resolve(ROOT, 'apps/api/package.json'))

const BASE = process.env.WEB_URL ?? 'http://127.0.0.1:3000'
const OUT_ROOT = resolve(ROOT, '.screenshots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Phone first — it is where the owner reviews. */
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1366, height: 900, deviceScaleFactor: 1 },
]

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'shop', path: '/shop' },
  { name: 'product', path: '/products/heritage-block-print-kurti' },
  { name: 'collections', path: '/collections' },
]

function parseArgs(argv) {
  const args = { label: null, compare: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--label') args.label = argv[++i]
    else if (argv[i] === '--compare') args.compare = [argv[++i], argv[++i]]
  }
  return args
}

/**
 * Settle the page before the shutter: fonts decided, lazy images requested,
 * entrance animations finished. A screenshot taken mid-animation compares as a
 * difference on every run and makes the whole harness useless.
 */
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts?.ready
  })

  // Walk the page a screen at a time. Jumping straight to the bottom leaves
  // every lazily-loaded image in between untriggered, and they then resolve at
  // whatever moment the shutter happens to catch — which is what made two
  // identical runs differ by 22%.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 220))
    }
    window.scrollTo(0, document.body.scrollHeight)
    await new Promise((r) => setTimeout(r, 400))
    window.scrollTo(0, 0)
  })

  // The storefront runs Lenis smooth scrolling, so `scrollTo(0, 0)` is a
  // request, not an arrival — it eases back over several frames. Shooting
  // before it lands captures the page mid-travel, which is what made two
  // identical runs disagree by 22%. Wait for the position to actually hold.
  await page.evaluate(async () => {
    let stable = 0
    for (let i = 0; i < 120 && stable < 8; i++) {
      await new Promise((r) => requestAnimationFrame(r))
      if (window.scrollY < 1) stable++
      else {
        stable = 0
        window.scrollTo(0, 0)
      }
    }
  })
  await sleep(700)

  // Now every image has been asked for, wait for all of them to finish.
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images]
        .filter((img) => !img.complete)
        .map((img) => new Promise((done) => {
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
          setTimeout(done, 8000)
        })),
    )
    await document.fonts?.ready
  })
  await sleep(700)
}

async function capture(label) {
  const puppeteer = require('puppeteer')
  const outDir = resolve(OUT_ROOT, label)
  mkdirSync(outDir, { recursive: true })

  const browser = await puppeteer.launch(puppeteerLaunchOptions())
  const page = await browser.newPage()
  // Motion off: a screenshot must be reproducible, not a frame of an animation.
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])

  const taken = []
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      const { name: vpName, ...vp } = viewport
      await page.setViewport(vp)
      try {
        await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle2', timeout: 60000 })
      } catch {
        console.log(`  ⚠ ${route.name} @ ${vpName} — navigation timed out, capturing anyway`)
      }
      await settle(page)
      const file = resolve(outDir, `${route.name}-${vpName}.png`)
      await page.screenshot({ path: file, fullPage: true })
      taken.push(`${route.name}-${vpName}`)
      console.log(`  ✅ ${route.name} @ ${vpName}`)
    }
  }

  await browser.close()
  console.log(`\n${taken.length} shots → .screenshots/${label}/`)
}

/**
 * Compare two runs in the browser itself rather than pulling in an image
 * differ: decode both PNGs onto canvases and count differing pixels.
 */
async function compare(a, b) {
  const dirA = resolve(OUT_ROOT, a)
  const dirB = resolve(OUT_ROOT, b)
  for (const dir of [dirA, dirB]) {
    if (!existsSync(dir)) {
      console.error(`Missing ${dir} — run --label ${dir === dirA ? a : b} first.`)
      process.exit(1)
    }
  }

  const puppeteer = require('puppeteer')
  // A page on about:blank cannot read file:// images. Give the comparer a
  // file:// origin of its own and the flag that lets it read siblings.
  const browser = await puppeteer.launch(
    puppeteerLaunchOptions({ args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files'] }),
  )
  const page = await browser.newPage()
  const scratch = resolve(OUT_ROOT, '.compare.html')
  writeFileSync(scratch, '<!doctype html><title>diff</title>')
  await page.goto(`file://${scratch}`)

  const shots = readdirSync(dirA).filter((f) => f.endsWith('.png'))
  const rows = []
  for (const shot of shots) {
    if (!existsSync(resolve(dirB, shot))) {
      rows.push({ shot, note: `only in ${a}` })
      continue
    }
    const result = await page.evaluate(
      async ([srcA, srcB]) => {
        const load = (src) =>
          new Promise((done, fail) => {
            const img = new Image()
            img.onload = () => done(img)
            img.onerror = fail
            img.src = src
          })
        const [imgA, imgB] = await Promise.all([load(srcA), load(srcB)])
        const w = Math.max(imgA.width, imgB.width)
        const h = Math.max(imgA.height, imgB.height)
        const draw = (img) => {
          const c = document.createElement('canvas')
          c.width = w
          c.height = h
          const ctx = c.getContext('2d', { willReadFrequently: true })
          ctx.drawImage(img, 0, 0)
          return ctx.getImageData(0, 0, w, h).data
        }
        const da = draw(imgA)
        const db = draw(imgB)
        let diff = 0
        // 8/255 tolerance absorbs image codec noise, not real layout movement.
        for (let i = 0; i < da.length; i += 4) {
          if (
            Math.abs(da[i] - db[i]) > 8 ||
            Math.abs(da[i + 1] - db[i + 1]) > 8 ||
            Math.abs(da[i + 2] - db[i + 2]) > 8
          ) {
            diff++
          }
        }
        return {
          pct: (diff / (w * h)) * 100,
          heightA: imgA.height,
          heightB: imgB.height,
        }
      },
      [
        `file://${resolve(dirA, shot)}`,
        `file://${resolve(dirB, shot)}`,
      ],
    )
    rows.push({ shot, ...result })
  }
  await browser.close()
  rmSync(scratch, { force: true })

  console.log(`\n  ${a} → ${b}\n`)
  console.log('  shot                       changed    height')
  console.log('  ' + '─'.repeat(52))
  for (const row of rows) {
    if (row.note) {
      console.log(`  ${row.shot.padEnd(26)} ${row.note}`)
      continue
    }
    const height =
      row.heightA === row.heightB
        ? `${row.heightB}px`
        : `${row.heightA} → ${row.heightB}px`
    console.log(`  ${row.shot.padEnd(26)} ${row.pct.toFixed(2).padStart(6)}%    ${height}`)
  }
  console.log(
    '\n  A shot you did not intend to touch should read ~0%.' +
      '\n  Open both PNGs before accepting anything larger.' +
      '\n' +
      '\n  Known tolerance: home-desktop sits around 0.5% run to run. It is the' +
      '\n  Our Story block — white text on black, far below the fold, which a' +
      '\n  fullPage capture sometimes stitches before it has painted. Checked' +
      '\n  against a real scroll-into-view and the heading is always there, so' +
      '\n  it is the screenshot, not the page.\n',
  )
}

const args = parseArgs(process.argv.slice(2))
if (args.compare) {
  await compare(args.compare[0], args.compare[1])
} else if (args.label) {
  console.log(`\nCapturing "${args.label}" from ${BASE}\n`)
  await capture(args.label)
} else {
  console.log(
    'Usage:\n' +
      '  node scripts/shot-web.mjs --label before\n' +
      '  node scripts/shot-web.mjs --label after\n' +
      '  node scripts/shot-web.mjs --compare before after\n',
  )
  process.exit(1)
}

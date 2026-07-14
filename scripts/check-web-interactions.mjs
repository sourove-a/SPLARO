#!/usr/bin/env node
/**
 * Storefront interaction smoke test — emulates Windows "Animation effects OFF"
 * (prefers-reduced-motion: reduce) and verifies decorative motion still runs.
 *
 * Run: node scripts/check-web-interactions.mjs
 * Env: WEB_URL=http://127.0.0.1:3000
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

async function inspectHomepage(page) {
  return page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const animDuration = (el) => {
      if (!el) return null
      const s = getComputedStyle(el)
      return {
        name: s.animationName,
        duration: s.animationDuration,
        playState: s.animationPlayState,
      }
    }

    const transformAt = (el) => (el ? getComputedStyle(el).transform : null)

    // Hero slider — wait for autoplay dot change
    const dots = [...document.querySelectorAll('.home-hero-slider .hero-dot')]
    const dot0Before = dots[0]?.getAttribute('aria-current')
    await sleep(8200)
    const dot0After = dots[0]?.getAttribute('aria-current')
    const heroProgress = document.querySelector('.home-hero-slider .hero-progress-fill')
    const progressAnim = animDuration(heroProgress)

    // Marquee — track transform should move
    const marquee = document.querySelector('.home-flow-strip__track')
    const marqueeT1 = transformAt(marquee)
    await sleep(1200)
    const marqueeT2 = transformAt(marquee)
    const marqueeAnim = animDuration(marquee)

    // Chat FAB dots
    const chatDot = document.querySelector('.support-live-bubble__dot')
    const chatBtn = document.querySelector('.support-glass-btn--pulse')
    const dotT1 = transformAt(chatDot)
    await sleep(700)
    const dotT2 = transformAt(chatDot)
    const chatDotAnim = animDuration(chatDot)
    const chatBtnAnim = animDuration(chatBtn)

    // Story earth — scroll into view
    const storyHost = document.querySelector('.story-earth-panel')
    storyHost?.scrollIntoView({ block: 'center' })
    await sleep(1500)
    const storyMap = document.querySelector('.story-earth-panel__globe-map')
    const storyMapAnim = animDuration(storyMap)
    const storyPos1 = storyMap ? getComputedStyle(storyMap).backgroundPosition : null
    await sleep(1500)
    const storyPos2 = storyMap ? getComputedStyle(storyMap).backgroundPosition : null

    // Footer earth (EarthBackdrop video — decorative, must keep under reduced-motion)
    window.scrollTo(0, document.body.scrollHeight)
    await sleep(2000)
    const footerVideo = document.querySelector('.earth-backdrop__video')
    const footerVideoVisible = footerVideo
      ? getComputedStyle(footerVideo).display !== 'none' && getComputedStyle(footerVideo).visibility !== 'hidden'
      : false
    const footerVideoPlaying = footerVideo
      ? !footerVideo.paused && !footerVideo.ended && footerVideo.readyState >= 2
      : false
    const footerLive = document.querySelector('.earth-backdrop')?.getAttribute('data-earth-live')
    const footerMap = document.querySelector('.site-footer__earth-fallback-map')
    const footerPos1 = footerMap ? getComputedStyle(footerMap).backgroundPosition : null
    await sleep(1500)
    const footerPos2 = footerMap ? getComputedStyle(footerMap).backgroundPosition : null
    const footerReady =
      document.querySelector('.site-footer__earth-canvas')?.getAttribute('data-earth-ready') === 'true'
    const footerWebGL = !!document.querySelector('.site-footer__earth-canvas canvas')

    return {
      reducedMotion: reduced,
      heroDotChanged: dot0Before !== dot0After,
      heroProgressAnim: progressAnim,
      marqueeMoved: marqueeT1 !== marqueeT2,
      marqueeAnim,
      marqueeWrap: marquee ? getComputedStyle(marquee).flexWrap : null,
      chatDotMoved: dotT1 !== dotT2,
      chatDotAnim,
      chatBtnAnim,
      storyMapMoved: storyPos1 !== storyPos2,
      storyMapAnim,
      footerMapMoved: footerPos1 !== footerPos2,
      footerReady,
      footerWebGL,
      footerVideoVisible,
      footerVideoPlaying,
      footerLive,
      dataPerf: document.documentElement.getAttribute('data-perf'),
    }
  })
}

async function main() {
  const puppeteer = require('puppeteer')
  const browser = await puppeteer.launch(puppeteerLaunchOptions())

  const consoleErrors = []
  try {
    const page = await browser.newPage()
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnorableConsoleError(msg.text())) consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(String(err.message)))

    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(`${BASE}/`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT })

    const state = await inspectHomepage(page)

    const storyWebGL = await page.evaluate(
      () => !!document.querySelector('.story-earth-panel canvas'),
    )

    const checks = {
      reducedMotionActive: state.reducedMotion === true,
      heroAutoplay: state.heroDotChanged,
      heroProgressRunning:
        state.heroProgressAnim?.name !== 'none' &&
        parseFloat(state.heroProgressAnim?.duration ?? '0') > 0.1,
      marqueeScroll: state.marqueeMoved || state.marqueeAnim?.name === 'home-flow-marquee',
      marqueeNoWrap: state.marqueeWrap === 'nowrap',
      chatDots: state.chatDotMoved || state.chatDotAnim?.name === 'supportDotWave',
      chatSway: state.chatBtnAnim?.name === 'supportSway',
      storyEarth:
        state.storyMapMoved ||
        state.storyMapAnim?.name === 'story-earth-map-scroll' ||
        storyWebGL,
      footerEarth:
        state.footerVideoVisible ||
        state.footerVideoPlaying ||
        state.footerLive === 'video' ||
        state.footerMapMoved ||
        state.footerWebGL ||
        state.footerReady,
      noLiteProfile: state.dataPerf !== 'lite',
      noConsoleErrors: consoleErrors.length === 0,
    }

    const ok = Object.values(checks).every(Boolean)
    console.log(
      JSON.stringify(
        {
          ok,
          base: BASE,
          checks,
          details: state,
          consoleErrors: consoleErrors.slice(0, 8),
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

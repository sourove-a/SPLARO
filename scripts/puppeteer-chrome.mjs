#!/usr/bin/env node
/**
 * Resolve Chrome/Chromium for Puppeteer audits — cross-platform.
 * Falls back to Puppeteer's bundled Chromium when no system Chrome is found.
 */
import { existsSync } from 'node:fs'
import { IS_WIN } from './spawn-utils.mjs'

const MAC_LINUX_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]

const WIN_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  String.raw`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
]

export function resolveChromeExecutable() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const candidates = IS_WIN ? WIN_CANDIDATES : MAC_LINUX_CANDIDATES
  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return undefined
}

export function puppeteerLaunchOptions(extra = {}) {
  const executablePath = resolveChromeExecutable()
  return {
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...extra,
  }
}

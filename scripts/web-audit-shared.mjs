/** Shared helpers for Puppeteer / Playwright storefront audits. */

export const BASE = process.env.WEB_URL ?? 'http://127.0.0.1:3000'

export const isRemoteBase =
  /^https?:\/\//.test(BASE) && !/localhost|127\.0\.0\.1/.test(BASE)

export const NAV_WAIT = process.env.AUDIT_WAIT_UNTIL ?? 'domcontentloaded'

export const NAV_TIMEOUT = Number(process.env.AUDIT_NAV_TIMEOUT ?? (isRemoteBase ? 60000 : 45000))

export const POST_NAV_SLEEP_MS = isRemoteBase ? 2000 : 800

export const WIN_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function isIgnorableConsoleError(text) {
  return (
    /Content Security Policy directive/i.test(text) ||
    /googletagmanager\.com/i.test(text) ||
    /connect\.facebook\.net/i.test(text) ||
    /Meta pixel.*Bot traffic/i.test(text) ||
    /Failed to load resource: the server responded with a status of 503/i.test(text) ||
    /Failed to load resource.*403/i.test(text) ||
    /Failed to load resource.*404/.test(text) ||
    /Failed to fetch RSC payload.*Falling back to browser navigation/i.test(text) ||
    /ResizeObserver loop/i.test(text) ||
    /\[GSI_LOGGER\]/i.test(text) ||
    /origin is not allowed for the given client ID/i.test(text) ||
    /accounts\.google\.com/i.test(text) ||
    /googlevideo\.com/i.test(text) ||
    /due to access control checks/i.test(text) ||
    /downloadable font: download failed/i.test(text) ||
    /\/api\/nav due to access control checks/i.test(text) ||
    /videoplayback/i.test(text) ||
    /_rsc=.*due to access control checks/i.test(text) ||
    /Cookie “_fbp” has been rejected/i.test(text) ||
    /Cookie "_fbp" has been rejected/i.test(text)
  )
}

/**
 * Google Identity / OAuth breaks inside embedded browsers (WhatsApp, Instagram,
 * Telegram, Facebook, …). accounts.google.com renders a blank white page —
 * Google intentionally blocks OAuth in WebViews.
 */

export type InAppBrowserKind =
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'telegram'
  | 'line'
  | 'tiktok'
  | 'twitter'
  | 'linkedin'
  | 'webview'
  | null

export interface InAppBrowserInfo {
  inApp: boolean
  kind: InAppBrowserKind
  /** Human label for UI copy, e.g. "WhatsApp". */
  label: string | null
}

export function detectInAppBrowser(
  ua = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): InAppBrowserInfo {
  const u = ua || ''

  if (/WhatsApp|WABusiness|WA\b/i.test(u)) {
    return { inApp: true, kind: 'whatsapp', label: 'WhatsApp' }
  }
  if (/Instagram/i.test(u)) {
    return { inApp: true, kind: 'instagram', label: 'Instagram' }
  }
  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS|Messenger/i.test(u)) {
    return { inApp: true, kind: 'facebook', label: 'Facebook' }
  }
  if (/Telegram/i.test(u)) {
    return { inApp: true, kind: 'telegram', label: 'Telegram' }
  }
  if (/Line\//i.test(u)) {
    return { inApp: true, kind: 'line', label: 'LINE' }
  }
  if (/TikTok|musical_ly|BytedanceWebview/i.test(u)) {
    return { inApp: true, kind: 'tiktok', label: 'TikTok' }
  }
  if (/Twitter|X\/|Tweetbot/i.test(u)) {
    return { inApp: true, kind: 'twitter', label: 'X' }
  }
  if (/LinkedInApp/i.test(u)) {
    return { inApp: true, kind: 'linkedin', label: 'LinkedIn' }
  }
  // Generic Android WebView — often still blocks Google OAuth.
  if (/; wv\)/i.test(u) || /\bVersion\/[\d.]+ Chrome\/[\d.]+ Mobile.*wv/i.test(u)) {
    return { inApp: true, kind: 'webview', label: 'this in-app browser' }
  }

  return { inApp: false, kind: null, label: null }
}

/** Prefer Safari / Chrome over the host app WebView. */
export function openInExternalBrowser(url?: string): void {
  if (typeof window === 'undefined') return

  const target = (url || window.location.href).trim()
  if (!target) return

  const ua = navigator.userAgent || ''
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)

  if (isAndroid) {
    const stripped = target.replace(/^https?:\/\//i, '')
    window.location.href =
      `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;` +
      `S.browser_fallback_url=${encodeURIComponent(target)};end`
    return
  }

  if (isIOS) {
    // Escapes many iOS WebViews into Safari (WhatsApp / Instagram / Telegram).
    window.location.href = target.replace(/^https:\/\//i, 'x-safari-https://')
    return
  }

  window.open(target, '_blank', 'noopener,noreferrer')
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

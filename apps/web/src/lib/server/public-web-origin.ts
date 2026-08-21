/** Public storefront origin for 302s. Never `https://localhost` behind nginx. */

function firstHeader(value: string | null): string {
  return value?.split(',')[0]?.trim() ?? ''
}

function hostnameOf(host: string): string {
  return host.replace(/^\[|\]$/g, '').split(':')[0]?.toLowerCase() ?? ''
}

function isLoopbackHost(host: string): boolean {
  const name = hostnameOf(host)
  return (
    name === 'localhost' ||
    name === '127.0.0.1' ||
    name === '0.0.0.0' ||
    name === '::1' ||
    name === '[::1]'
  )
}

function isPublicSiteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) && !/localhost|127\.0\.0\.1/i.test(value)
}

export function resolvePublicWebOrigin(request: Request): string {
  const xfHost = firstHeader(request.headers.get('x-forwarded-host'))
  const hostHeader = firstHeader(request.headers.get('host'))
  const xfHostName = hostnameOf(xfHost)
  const hostName = hostnameOf(hostHeader)

  if (xfHostName === 'splaro.co' || xfHostName === 'www.splaro.co') {
    return 'https://splaro.co'
  }
  if (hostName === 'splaro.co' || hostName === 'www.splaro.co') {
    return 'https://splaro.co'
  }

  if (xfHost && !isLoopbackHost(xfHost)) {
    const proto =
      firstHeader(request.headers.get('x-forwarded-proto')) ||
      (xfHostName.includes('splaro.co') ? 'https' : 'http')
    return `${proto}://${xfHost}`
  }

  const siteEnv = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || '')
    .trim()
    .replace(/\/$/, '')

  let urlOrigin = ''
  try {
    urlOrigin = new URL(request.url).origin
  } catch {
    urlOrigin = ''
  }

  const urlHost = urlOrigin ? hostnameOf(new URL(urlOrigin).hostname) : ''
  const behindLoopback = isLoopbackHost(xfHost || hostHeader || urlHost)

  if (behindLoopback) {
    if (isPublicSiteUrl(siteEnv)) return siteEnv
    if (process.env.NODE_ENV === 'production' || process.env.SPLARO_VPS === '1') {
      return 'https://splaro.co'
    }
    try {
      const port = urlOrigin ? new URL(urlOrigin).port || '3000' : '3000'
      return `http://127.0.0.1:${port}`
    } catch {
      return 'http://127.0.0.1:3000'
    }
  }

  if (urlOrigin && !isLoopbackHost(urlHost)) return urlOrigin
  if (isPublicSiteUrl(siteEnv)) return siteEnv
  return 'https://splaro.co'
}

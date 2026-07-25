import { getServerApiBaseUrl } from '@splaro/config'
import { getAdminSessionToken } from '@/lib/auth/server-session'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'
const HTML_TIMEOUT_MS = 30_000

export type LabelSuffix = '' | '/sticker'

export async function proxyAdminLabelRequest(
  orderId: string,
  suffix: LabelSuffix = '',
  request?: Request,
): Promise<Response> {
  let token = await getAdminSessionToken()
  if (!token && request) {
    const auth = request.headers.get('authorization')
    if (auth?.startsWith('Bearer ')) token = auth.slice(7).trim()
  }

  if (!token) {
    return new Response(labelErrorHtml(401, 'Admin login required to open labels.'), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const base = getServerApiBaseUrl().replace(/\/+$/, '')
  const url = `${base}/admin/orders/${encodeURIComponent(orderId)}/label${suffix}?storeId=${encodeURIComponent(STORE_ID)}`

  let upstream: Response
  try {
    upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/html',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(HTML_TIMEOUT_MS),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'API unreachable'
    return new Response(
      labelErrorHtml(503, `Label proxy failed — ${message}. Is the API running on :4000?`),
      {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      },
    )
  }

  const body = await upstream.arrayBuffer()
  if (!upstream.ok) {
    let detail = `Label request failed (${upstream.status})`
    try {
      const json = JSON.parse(new TextDecoder().decode(body)) as { message?: string | string[] }
      if (Array.isArray(json.message)) detail = json.message.join(', ')
      else if (json.message) detail = json.message
    } catch {
      const text = new TextDecoder().decode(body).trim()
      if (text) detail = text.slice(0, 280)
    }
    return new Response(labelErrorHtml(upstream.status, detail), {
      status: upstream.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export async function proxyAdminBulkLabelsRequest(
  orderIds: string[],
  request?: Request,
): Promise<Response> {
  let token = await getAdminSessionToken()
  if (!token && request) {
    const auth = request.headers.get('authorization')
    if (auth?.startsWith('Bearer ')) token = auth.slice(7).trim()
  }

  if (!token) {
    return new Response(labelErrorHtml(401, 'Admin login required to open labels.'), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const base = getServerApiBaseUrl().replace(/\/+$/, '')
  const url = `${base}/admin/orders/labels/bulk?storeId=${encodeURIComponent(STORE_ID)}`

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/html',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderIds, print: true }),
      cache: 'no-store',
      signal: AbortSignal.timeout(HTML_TIMEOUT_MS),
    })
    const body = await upstream.arrayBuffer()
    if (!upstream.ok) {
      let detail = `Bulk labels failed (${upstream.status})`
      try {
        const json = JSON.parse(new TextDecoder().decode(body)) as { message?: string | string[] }
        if (Array.isArray(json.message)) detail = json.message.join(', ')
        else if (json.message) detail = json.message
      } catch {
        /* ignore */
      }
      return new Response(labelErrorHtml(upstream.status, detail), {
        status: upstream.status,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'API unreachable'
    return new Response(labelErrorHtml(503, `Bulk label proxy failed — ${message}`), {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
}

function labelErrorHtml(status: number, message: string): string {
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Label error · SPLARO</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #faf8f5; color: #111; }
    .card { max-width: 420px; padding: 28px; border-radius: 16px; background: #fff; border: 1px solid #11111122; }
    h1 { margin: 0 0 8px; font-size: 18px; } p { margin: 0; font-size: 14px; line-height: 1.5; color: #444; }
    code { font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Could not open shipping label</h1>
    <p>${safe}</p>
    <p style="margin-top:12px"><code>HTTP ${status}</code></p>
  </div>
</body>
</html>`
}

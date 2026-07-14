import { getServerApiBaseUrl } from '@splaro/config'
import { getAdminSessionToken } from '@/lib/auth/server-session'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'
const PDF_TIMEOUT_MS = 90_000
const HTML_TIMEOUT_MS = 30_000

export async function proxyAdminInvoiceRequest(
  orderId: string,
  suffix: '' | '/print' | '/pdf',
  request?: Request,
): Promise<Response> {
  let token = await getAdminSessionToken()
  if (!token && request) {
    const auth = request.headers.get('authorization')
    if (auth?.startsWith('Bearer ')) token = auth.slice(7).trim()
  }
  const wantsHtml = suffix !== '/pdf'

  if (!token) {
    if (wantsHtml) {
      return new Response(invoiceErrorHtml(401, 'Admin login required to open invoices.'), {
        status: 401,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }
    return Response.json(
      { message: 'Admin authentication required', error: 'Unauthorized', statusCode: 401 },
      { status: 401 },
    )
  }

  const base = getServerApiBaseUrl().replace(/\/+$/, '')
  const url = `${base}/admin/orders/${encodeURIComponent(orderId)}/invoice${suffix}?storeId=${encodeURIComponent(STORE_ID)}`
  const timeoutMs = suffix === '/pdf' ? PDF_TIMEOUT_MS : HTML_TIMEOUT_MS

  let upstream: Response
  try {
    upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: suffix === '/pdf' ? 'application/pdf' : 'text/html',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'API unreachable'
    if (wantsHtml) {
      return new Response(
        invoiceErrorHtml(503, `Invoice proxy failed — ${message}. Is the API running on :4000?`),
        {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        },
      )
    }
    return Response.json(
      {
        message: `Invoice proxy failed — ${message}. Is the API running on :4000?`,
        statusCode: 503,
      },
      { status: 503 },
    )
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
  const disposition = upstream.headers.get('content-disposition')
  const body = await upstream.arrayBuffer()

  // New-tab view/print routes should never show raw JSON error blobs.
  if (wantsHtml && !upstream.ok) {
    let detail = `Invoice request failed (${upstream.status})`
    try {
      const json = JSON.parse(new TextDecoder().decode(body)) as { message?: string | string[] }
      if (Array.isArray(json.message)) detail = json.message.join(', ')
      else if (json.message) detail = json.message
    } catch {
      const text = new TextDecoder().decode(body).trim()
      if (text) detail = text.slice(0, 280)
    }
    return new Response(invoiceErrorHtml(upstream.status, detail), {
      status: upstream.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': contentType,
      ...(disposition ? { 'Content-Disposition': disposition } : {}),
      'Cache-Control': 'no-store',
    },
  })
}

function invoiceErrorHtml(status: number, message: string): string {
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice error · SPLARO</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #faf8f5; color: #111; }
    .card { max-width: 420px; padding: 28px; border-radius: 16px; background: #fff; border: 1px solid #11111122; }
    h1 { margin: 0 0 8px; font-size: 18px; } p { margin: 0; font-size: 14px; line-height: 1.5; color: #444; }
    code { font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Could not open invoice</h1>
    <p>${safe}</p>
    <p style="margin-top:12px"><code>HTTP ${status}</code></p>
  </div>
</body>
</html>`
}

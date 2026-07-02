import { getApiBaseUrl } from '@splaro/config'
import { getAdminSessionToken } from '@/lib/auth/server-session'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

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
  if (!token) {
    return Response.json(
      { message: 'Admin authentication required', error: 'Unauthorized', statusCode: 401 },
      { status: 401 },
    )
  }

  const base = getApiBaseUrl()
  const url = `${base}/admin/orders/${encodeURIComponent(orderId)}/invoice${suffix}?storeId=${encodeURIComponent(STORE_ID)}`

  const upstream = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
  const disposition = upstream.headers.get('content-disposition')
  const body = await upstream.arrayBuffer()

  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': contentType,
      ...(disposition ? { 'Content-Disposition': disposition } : {}),
      'Cache-Control': 'no-store',
    },
  })
}

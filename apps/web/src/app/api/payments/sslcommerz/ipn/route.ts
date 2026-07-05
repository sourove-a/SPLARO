import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'

function payloadFromForm(formData: FormData): Record<string, string> {
  const payload: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') payload[key] = value
  }
  return payload
}

/** Forward SSLCommerz IPN to Nest API so order/payment update hits PostgreSQL. */
export async function POST(request: Request) {
  let payload: Record<string, string> = {}

  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      payload = (await request.json()) as Record<string, string>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
  } else {
    const formData = await request.formData()
    payload = payloadFromForm(formData)
  }

  const res = await fetch(`${getServerApiBaseUrl()}/payments/ssl/ipn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  const body = (await res.json().catch(() => ({ received: res.ok }))) as Record<string, unknown>
  return NextResponse.json(body, { status: res.status })
}

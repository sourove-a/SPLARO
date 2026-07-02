import { buildAdminApiUrl } from './client'
import { getAdminApiToken, setAdminApiToken } from '@/lib/auth/api-token'

export type InvoiceSuffix = '' | '/print' | '/pdf'

async function resolveAdminToken(): Promise<string | null> {
  const cached = getAdminApiToken()
  if (cached) return cached

  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    if (!res.ok) return null
    const data = (await res.json()) as { apiToken?: string }
    if (data.apiToken) {
      setAdminApiToken(data.apiToken)
      return data.apiToken
    }
  } catch {
    /* network / parse */
  }
  return null
}

export function invoiceApiUrl(orderId: string, suffix: InvoiceSuffix = ''): string {
  const path = `/admin/orders/${encodeURIComponent(orderId)}/invoice${suffix}`
  return buildAdminApiUrl(path)
}

/** Authenticated fetch for invoice HTML/PDF — uses session token (same as apiFetch). */
export async function fetchAdminInvoice(
  orderId: string,
  suffix: InvoiceSuffix = '',
): Promise<Response> {
  const token = await resolveAdminToken()
  if (!token) {
    return new Response(
      JSON.stringify({
        message: 'Admin authentication required',
        error: 'Unauthorized',
        statusCode: 401,
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return fetch(invoiceApiUrl(orderId, suffix), {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
  })
}

export async function parseInvoiceError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  try {
    const json = JSON.parse(text) as { message?: string }
    if (json.message) return json.message
  } catch {
    /* plain text */
  }
  return text || `Invoice request failed (${res.status})`
}

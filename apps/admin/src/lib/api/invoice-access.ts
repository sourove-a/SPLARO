/**
 * Invoice HTML/PDF access via same-origin cookie session routes.
 * Prefer `/api/orders/:id/invoice*` (httpOnly cookie) over Bearer-only proxy.
 */

export type InvoiceSuffix = '' | '/print' | '/pdf'

export function invoiceApiUrl(orderId: string, suffix: InvoiceSuffix = ''): string {
  return `/api/orders/${encodeURIComponent(orderId)}/invoice${suffix}`
}

/** Authenticated fetch for invoice HTML/PDF — session cookie (credentials include). */
export async function fetchAdminInvoice(
  orderId: string,
  suffix: InvoiceSuffix = '',
): Promise<Response> {
  return fetch(invoiceApiUrl(orderId, suffix), {
    credentials: 'include',
    cache: 'no-store',
  })
}

export async function parseInvoiceError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  try {
    const json = JSON.parse(text) as { message?: string | string[] }
    if (Array.isArray(json.message)) return json.message.join(', ')
    if (json.message) return json.message
  } catch {
    /* plain text */
  }
  if (res.status === 401) return 'Admin login required to open invoices.'
  if (res.status === 503) {
    return text || 'PDF engine unavailable. Use Print → Save as PDF.'
  }
  return text || `Invoice request failed (${res.status})`
}

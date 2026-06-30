import { proxyAdminInvoiceRequest } from '@/lib/api/proxy-invoice'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  return proxyAdminInvoiceRequest(id, '/pdf')
}

import { proxyAdminBulkLabelsRequest } from '@/lib/api/proxy-label'

export async function POST(request: Request) {
  let orderIds: string[] = []
  try {
    const body = (await request.json()) as { orderIds?: string[] }
    orderIds = Array.isArray(body.orderIds) ? body.orderIds : []
  } catch {
    orderIds = []
  }
  return proxyAdminBulkLabelsRequest(orderIds, request)
}

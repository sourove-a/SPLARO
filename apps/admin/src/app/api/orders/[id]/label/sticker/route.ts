import { proxyAdminLabelRequest } from '@/lib/api/proxy-label'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  return proxyAdminLabelRequest(id, '/sticker', request)
}

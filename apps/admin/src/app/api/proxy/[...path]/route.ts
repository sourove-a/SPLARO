import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getApiBaseUrl } from '@splaro/config'
import { ADMIN_SESSION_COOKIE } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PROXY_TIMEOUT_MS = 30_000

interface RouteContext {
  params: Promise<{ path: string[] }>
}

async function proxyToApi(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params
  if (!path?.length) {
    return NextResponse.json({ message: 'Missing API path' }, { status: 400 })
  }
  if (path.some((segment) => segment === '..' || segment.includes('\\'))) {
    return NextResponse.json({ message: 'Invalid API path' }, { status: 400 })
  }

  const base = getApiBaseUrl().replace(/\/+$/, '')
  const upstreamUrl = `${base}/${path.join('/')}${request.nextUrl.search}`

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const headers: Record<string, string> = {
    Accept: request.headers.get('accept') ?? 'application/json',
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    headers.Authorization = authHeader
  } else if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`
  }

  const contentType = request.headers.get('content-type')
  if (contentType) headers['Content-Type'] = contentType

  const storeHeader = request.headers.get('x-store-id')
  if (storeHeader) headers['X-Store-Id'] = storeHeader

  const method = request.method.toUpperCase()
  const hasBody = !['GET', 'HEAD'].includes(method)

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      ...(hasBody ? { body: await request.arrayBuffer() } : {}),
    })

    const responseHeaders = new Headers()
    const upstreamType = upstream.headers.get('content-type')
    if (upstreamType) responseHeaders.set('Content-Type', upstreamType)

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'API unreachable'
    return NextResponse.json(
      {
        message: `Admin API proxy failed — ${message}. Start: pnpm dev:api (or pnpm dev:stack)`,
        statusCode: 503,
      },
      { status: 503 },
    )
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyToApi(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyToApi(request, context)
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyToApi(request, context)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToApi(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToApi(request, context)
}

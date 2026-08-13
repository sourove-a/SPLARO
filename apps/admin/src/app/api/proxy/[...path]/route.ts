import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { getServerApiBaseUrl } from '@splaro/config'
import { ADMIN_SESSION_COOKIE } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PROXY_TIMEOUT_MS = 30_000
/** Agent turns stream for minutes; the normal timeout would abort them mid-flight. */
const PROXY_STREAM_TIMEOUT_MS = 600_000
const SAFE_TRANSPORT_ATTEMPTS = 2
const SAFE_RETRY_DELAY_MS = 150

interface RouteContext {
  params: Promise<{ path: string[] }>
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function proxyResponseHeaders(upstream: Response): Headers {
  const headers = new Headers()
  for (const name of ['content-type', 'retry-after', 'cache-control', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}

async function proxyToApi(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params
  if (!path?.length) {
    return NextResponse.json({ message: 'Missing API path' }, { status: 400 })
  }
  if (path.some((segment) => segment === '..' || segment.includes('\\'))) {
    return NextResponse.json({ message: 'Invalid API path' }, { status: 400 })
  }

  const base = getServerApiBaseUrl().replace(/\/+$/, '')
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
  const wantsStream = (headers.Accept ?? '').includes('text/event-stream')
  const requestBody = hasBody ? await request.arrayBuffer() : undefined
  const transportAttempts = ['GET', 'HEAD'].includes(method) ? SAFE_TRANSPORT_ATTEMPTS : 1
  let lastError: unknown

  for (let attempt = 0; attempt < transportAttempts; attempt += 1) {
    try {
      const upstream = await fetch(upstreamUrl, {
        method,
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(wantsStream ? PROXY_STREAM_TIMEOUT_MS : PROXY_TIMEOUT_MS),
        ...(requestBody ? { body: requestBody } : {}),
      })

      const responseHeaders = proxyResponseHeaders(upstream)
      const upstreamType = upstream.headers.get('content-type')

      if (upstreamType?.includes('text/event-stream')) {
        // Without these, nginx (and any intermediate cache) buffers the whole SSE
        // response instead of forwarding each chunk.
        responseHeaders.set('Cache-Control', 'no-cache, no-transform')
        responseHeaders.set('Connection', 'keep-alive')
        responseHeaders.set('X-Accel-Buffering', 'no')

        return new NextResponse(upstream.body, {
          status: upstream.status,
          headers: responseHeaders,
        })
      }

      // Normal admin API payloads are JSON. Buffer them before returning so a
      // mid-body upstream disconnect is caught here instead of surfacing later
      // as an unhandled Next.js "failed to pipe response" error.
      const statusForbidsBody = [204, 205, 304].includes(upstream.status)
      const responseBody = method === 'HEAD' || statusForbidsBody ? null : await upstream.arrayBuffer()
      return new NextResponse(responseBody, {
        status: upstream.status,
        headers: responseHeaders,
      })
    } catch (err) {
      lastError = err
      if (attempt + 1 < transportAttempts) {
        await sleep(SAFE_RETRY_DELAY_MS)
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'API unreachable'
  return NextResponse.json(
    {
      message: `Admin API proxy failed — ${message}. Start: pnpm dev:api (or pnpm dev:stack)`,
      statusCode: 503,
    },
    { status: 503 },
  )
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

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Local MCP HTTP process (PM2 splaro-mcp). Never expose this port publicly. */
const MCP_UPSTREAM = (process.env['MCP_UPSTREAM_URL'] ?? 'http://127.0.0.1:4005').replace(/\/+$/, '')

interface RouteContext {
  params: Promise<{ path?: string[] }>
}

function buildUpstream(path: string[] | undefined, search: string): string {
  const suffix = path?.length ? `/${path.join('/')}` : ''
  return `${MCP_UPSTREAM}${suffix}${search}`
}

function forwardHeaders(request: NextRequest): Headers {
  const headers = new Headers()
  const pass = [
    'authorization',
    'x-mcp-key',
    'content-type',
    'accept',
    'mcp-session-id',
    'last-event-id',
  ] as const
  for (const key of pass) {
    const value = request.headers.get(key)
    if (value) headers.set(key, value)
  }
  return headers
}

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params
  if (path?.some((segment) => segment === '..' || segment.includes('\\'))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const upstreamUrl = buildUpstream(path, request.nextUrl.search)
  const headers = forwardHeaders(request)

  let body: ArrayBuffer | undefined
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer()
  }

  let upstream: Response
  try {
    const init: RequestInit =
      body && body.byteLength > 0
        ? {
            method: request.method,
            headers,
            body,
            cache: 'no-store',
            signal: AbortSignal.timeout(600_000),
          }
        : {
            method: request.method,
            headers,
            cache: 'no-store',
            signal: AbortSignal.timeout(600_000),
          }
    upstream = await fetch(upstreamUrl, init)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'MCP upstream unreachable'
    return NextResponse.json(
      {
        error: `MCP server offline (${message}). Ensure splaro-mcp is running on :4005.`,
      },
      { status: 503 },
    )
  }

  const outHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (lower === 'transfer-encoding' || lower === 'connection') return
    outHeaders.set(key, value)
  })
  outHeaders.set('Cache-Control', 'no-store')
  // Claude/ChatGPT browsers need CORS on the proxied SSE/stream responses too.
  outHeaders.set('Access-Control-Allow-Origin', '*')
  outHeaders.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-mcp-key, mcp-session-id, Last-Event-ID',
  )
  outHeaders.set('Access-Control-Expose-Headers', 'mcp-session-id')
  outHeaders.set('X-Accel-Buffering', 'no')
  const contentType = outHeaders.get('content-type') ?? ''
  if (contentType.includes('text/event-stream')) {
    outHeaders.set('Cache-Control', 'no-cache, no-transform')
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  })
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, x-mcp-key, mcp-session-id, Last-Event-ID',
      'Access-Control-Expose-Headers': 'mcp-session-id',
    },
  })
}

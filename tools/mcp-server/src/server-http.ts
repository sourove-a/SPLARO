import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { authenticateMcpRequest, hashKey } from './mcp-auth.ts'
import { runWithMcpAuth, type McpAuthContext } from './auth-context.ts'
import { createSplaroMcpServer } from './create-server.ts'
import { log } from './env.ts'

type SseSession = {
  transport: SSEServerTransport
  server: McpServer
  tokenHash: string
}

type StreamSession = {
  transport: StreamableHTTPServerTransport
  server: McpServer
  tokenHash: string
}

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-mcp-key, mcp-session-id, Last-Event-ID',
  )
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id')
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function requireAuth(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<McpAuthContext | null> {
  const auth = await authenticateMcpRequest({
    headers: {
      authorization: req.headers.authorization,
      'x-mcp-key': req.headers['x-mcp-key'],
    },
  })
  if (!auth) {
    sendJson(res, 401, {
      error: 'Unauthorized — provide Authorization: Bearer <mcp link token>',
    })
    return null
  }
  return auth
}

function tokenHashOf(auth: McpAuthContext): string {
  return auth.tokenHash ?? hashKey(auth.token)
}

/**
 * Private MCP HTTP listener:
 * - GET/POST /mcp  — Streamable HTTP
 * - GET /sse + POST /message — legacy SSE (admin.splaro.co/mcp/sse)
 * - GET /health — no auth
 *
 * One McpServer instance per session (SDK forbids reconnecting a shared Protocol).
 */
export async function startHttpServer(port = 4005): Promise<void> {
  const sseSessions = new Map<string, SseSession>()
  const streamSessions = new Map<string, StreamSession>()

  const httpServer = createServer((req, res) => {
    void (async () => {
      try {
        setCors(res)

        if (req.method === 'OPTIONS') {
          res.writeHead(204)
          res.end()
          return
        }

        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

        if (url.pathname === '/health' && req.method === 'GET') {
          sendJson(res, 200, {
            ok: true,
            service: 'splaro-mcp',
            sessions: { sse: sseSessions.size, stream: streamSessions.size },
          })
          return
        }

        // ── Legacy SSE ──────────────────────────────────────────────────────
        if (url.pathname === '/sse' && req.method === 'GET') {
          const auth = await requireAuth(req, res)
          if (!auth) return

          await runWithMcpAuth(auth, async () => {
            log('SSE client connecting…')
            const messagePath = process.env['MCP_SSE_MESSAGE_PATH']?.trim() || '/mcp/message'
            const server = createSplaroMcpServer()
            const transport = new SSEServerTransport(messagePath, res)
            const session: SseSession = {
              transport,
              server,
              tokenHash: tokenHashOf(auth),
            }
            sseSessions.set(transport.sessionId, session)
            transport.onclose = () => {
              log(`SSE client disconnected (${transport.sessionId})`)
              sseSessions.delete(transport.sessionId)
              void server.close().catch(() => undefined)
            }
            await server.connect(transport as Parameters<typeof server.connect>[0])
          })
          return
        }

        if (url.pathname === '/message' && req.method === 'POST') {
          const auth = await requireAuth(req, res)
          if (!auth) return

          const sessionId = url.searchParams.get('sessionId')
          const session = sessionId ? sseSessions.get(sessionId) : undefined
          if (!session) {
            sendJson(res, 400, { error: 'Session not found or expired' })
            return
          }
          if (session.tokenHash !== tokenHashOf(auth)) {
            sendJson(res, 403, { error: 'Session token mismatch' })
            return
          }

          await runWithMcpAuth(auth, async () => {
            await session.transport.handlePostMessage(req, res)
          })
          return
        }

        // ── Streamable HTTP (/mcp) ──────────────────────────────────────────
        if (url.pathname === '/mcp') {
          const auth = await requireAuth(req, res)
          if (!auth) return

          await runWithMcpAuth(auth, async () => {
            const sessionHeader = req.headers['mcp-session-id']
            const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader

            if (req.method === 'GET' || req.method === 'DELETE') {
              if (!sessionId || !streamSessions.has(sessionId)) {
                sendJson(res, 400, { error: 'Invalid or missing mcp-session-id' })
                return
              }
              const existing = streamSessions.get(sessionId)!
              if (existing.tokenHash !== tokenHashOf(auth)) {
                sendJson(res, 403, { error: 'Session token mismatch' })
                return
              }
              await existing.transport.handleRequest(req, res)
              return
            }

            if (req.method === 'POST') {
              const raw = await readBody(req)
              let parsed: unknown = undefined
              if (raw) {
                try {
                  parsed = JSON.parse(raw) as unknown
                } catch {
                  sendJson(res, 400, { error: 'Invalid JSON body' })
                  return
                }
              }

              if (sessionId && streamSessions.has(sessionId)) {
                const existing = streamSessions.get(sessionId)!
                if (existing.tokenHash !== tokenHashOf(auth)) {
                  sendJson(res, 403, { error: 'Session token mismatch' })
                  return
                }
                await existing.transport.handleRequest(req, res, parsed)
                return
              }

              const server = createSplaroMcpServer()
              const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (id) => {
                  streamSessions.set(id, {
                    transport,
                    server,
                    tokenHash: tokenHashOf(auth),
                  })
                },
              })
              transport.onclose = () => {
                const id = transport.sessionId
                if (id) {
                  streamSessions.delete(id)
                  void server.close().catch(() => undefined)
                }
              }
              await server.connect(transport as Parameters<typeof server.connect>[0])
              await transport.handleRequest(req, res, parsed)
              return
            }

            sendJson(res, 405, { error: 'Method not allowed' })
          })
          return
        }

        sendJson(res, 404, {
          error: 'Not Found',
          endpoints: ['GET /sse', 'POST /message', 'POST|GET|DELETE /mcp', 'GET /health'],
        })
      } catch (err) {
        log(`HTTP handler error: ${err instanceof Error ? err.message : String(err)}`)
        sendJson(res, 500, { error: 'Internal MCP server error' })
      }
    })()
  })

  httpServer.listen(port, '127.0.0.1', () => {
    log(`HTTP MCP ready on http://127.0.0.1:${port}/sse (auth required, per-session servers)`)
  })
}

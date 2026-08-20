'use client'

import type { CSSProperties } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import { ApiError } from '@/lib/api/client'
import {
  createMcpToken,
  listMcpTokens,
  revokeMcpToken,
  type McpTokenCreated,
  type McpTokenRow,
} from '@/lib/api/mcp'
import { FONT, MONO } from '@/components/dc/tokens'
import { useAdminSession } from '@/lib/api/hooks'

/**
 * Streamable HTTP (`/mcp`) is what ChatGPT and Claude connectors ask for. The
 * older HTTP+SSE transport still answers on `/mcp/sse`, but it is deprecated in
 * the MCP spec, so it is offered as a fallback rather than the headline URL.
 */
const DEFAULT_CONNECT_URL = 'https://admin.splaro.co/mcp'

/** Older records (and the API default) may still carry the `/sse` suffix. */
function toStreamableUrl(value: string): string {
  return value.replace(/\/+$/, '').replace(/\/sse$/, '')
}

function preferLocalConnectUrl(serverUrl: string | undefined): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${window.location.origin}/mcp`
    }
  }
  const fromServer = serverUrl?.trim()
  return fromServer ? toStreamableUrl(fromServer) : DEFAULT_CONNECT_URL
}

export function McpLinkTokenPanel({ embedded = false }: { embedded?: boolean }) {
  const adminSession = useAdminSession()
  const isOwner = adminSession.data?.role === 'SUPER_ADMIN'
  const [tokens, setTokens] = useState<McpTokenRow[]>([])
  const [connectUrl, setConnectUrl] = useState(DEFAULT_CONNECT_URL)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<McpTokenCreated | null>(null)
  const [upstreamOk, setUpstreamOk] = useState<boolean | null>(null)
  const legacyConnectUrl = `${connectUrl}/sse`

  useEffect(() => {
    setConnectUrl(preferLocalConnectUrl(undefined))
  }, [])

  const probeUpstream = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp/health', { method: 'GET', cache: 'no-store' })
      setUpstreamOk(res.ok)
    } catch {
      setUpstreamOk(false)
    }
  }, [])

  const reload = useCallback(async () => {
    if (!isOwner) {
      setLoading(false)
      setTokens([])
      return
    }
    setLoading(true)
    try {
      const data = await listMcpTokens()
      setTokens(data.tokens)
      setConnectUrl(preferLocalConnectUrl(data.connectUrl))
    } catch (err) {
      toastFail(err instanceof ApiError ? err.message : 'Could not load MCP tokens')
    } finally {
      setLoading(false)
    }
  }, [isOwner])

  useEffect(() => {
    void reload()
    void probeUpstream()
  }, [reload, probeUpstream])

  const shellStyle: CSSProperties | undefined = embedded
    ? undefined
    : { padding: 16, borderRadius: 12, border: '1px solid var(--line-2)' }
  const Shell = embedded ? 'div' : 'section'
  const shellProps = embedded ? {} : { id: 'mcp-link-token' as const }

  if (adminSession.isLoading) {
    return (
      <Shell {...shellProps} style={shellStyle}>
        <p style={{ margin: 0, font: `400 12.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>Loading MCP controls…</p>
      </Shell>
    )
  }

  if (!isOwner) {
    return (
      <Shell {...shellProps} style={shellStyle}>
        {embedded ? null : (
          <p style={{ margin: 0, font: `700 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>Private MCP link</p>
        )}
        <p style={{ margin: embedded ? 0 : '6px 0 0', font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-2)' }}>
          Owner (SUPER_ADMIN) only — ask the store owner to generate a ChatGPT/Claude link token.
        </p>
      </Shell>
    )
  }

  const onGenerate = async () => {
    setBusy(true)
    try {
      const created = await createMcpToken({ name: 'ChatGPT / Claude MCP' })
      setFresh(created)
      setConnectUrl(preferLocalConnectUrl(created.connectUrl))
      toastOk('MCP link token created — copy it now (shown once)')
      await reload()
    } catch (err) {
      toastFail(err instanceof ApiError ? err.message : 'Could not create MCP token')
    } finally {
      setBusy(false)
    }
  }

  const onCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toastOk(`${label} copied`)
    } catch {
      toastWarn('Clipboard blocked — select and copy manually')
    }
  }

  const onRevoke = async (id: string, name: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Revoke MCP token “${name}”? ChatGPT/Claude will disconnect until you generate a new one.`)) {
      return
    }
    setBusy(true)
    try {
      await revokeMcpToken(id)
      if (fresh?.id === id) setFresh(null)
      toastOk('MCP token revoked')
      await reload()
    } catch (err) {
      toastFail(err instanceof ApiError ? err.message : 'Could not revoke token')
    } finally {
      setBusy(false)
    }
  }

  const card: CSSProperties = {
    padding: 20,
    borderRadius: 14,
    border: '1px solid var(--line-2)',
    background: 'var(--surface)',
    backgroundImage: 'var(--card-sheen)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  }
  const btn: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 32,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid var(--line-2)',
    background: 'var(--surface-2)',
    color: 'var(--ink)',
    font: `600 12px/1 ${FONT}`,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }
  const primaryBtn: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    padding: '0 16px',
    borderRadius: 9,
    border: '1px solid var(--violet-solid)',
    background: 'var(--violet-solid)',
    color: 'var(--on-violet)',
    font: `600 12.5px/1 ${FONT}`,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    transition: 'all 0.15s ease',
  }

  const isOnline = upstreamOk === true

  return (
    <Shell {...shellProps} style={embedded ? undefined : card}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {embedded ? null : (
              <p style={{ margin: 0, font: `700 14px/1.3 ${FONT}`, color: 'var(--ink)' }}>Private MCP link</p>
            )}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 9px',
                borderRadius: 99,
                font: `600 11px/1.3 ${FONT}`,
                background: isOnline ? 'var(--ok-soft)' : 'var(--warn-soft)',
                border: `1px solid ${isOnline ? 'var(--ok-bd)' : 'var(--warn-bd)'}`,
                color: isOnline ? 'var(--ok)' : 'var(--warn)',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? 'var(--ok)' : 'var(--warn)' }} />
              {isOnline ? 'MCP Online (:4005)' : 'MCP Offline (:4005)'}
            </span>
          </div>
          <p style={{ margin: '6px 0 0', font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-2)' }}>
            Connect ChatGPT or Claude to live orders and products with a private Bearer token — no public open endpoint.
          </p>
        </div>
        <button
          type="button"
          style={{
            ...primaryBtn,
            opacity: busy ? 0.7 : 1,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
          disabled={busy}
          onClick={() => void onGenerate()}
        >
          {busy ? 'Generating…' : 'Generate link token'}
        </button>
      </div>

      <ol
        style={{
          margin: '0 0 16px',
          padding: '12px 16px 12px 32px',
          borderRadius: 10,
          border: '1px solid var(--line-2)',
          background: 'var(--surface-2, rgba(0,0,0,0.02))',
          font: `400 12px/1.6 ${FONT}`,
          color: 'var(--ink-2)',
        }}
      >
        <li>Generate a link token (shown once).</li>
        <li>
          In the ChatGPT / Claude connector set Authentication to{' '}
          <strong style={{ color: 'var(--ink)' }}>access token / API key</strong> — not OAuth. This server is token-authenticated
          and publishes no OAuth discovery document.
        </li>
        <li>
          Set URL to the connect URL below and header{' '}
          <code style={{ fontFamily: MONO, padding: '2px 5px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--ink)' }}>Authorization: Bearer …</code>
        </li>
        <li>Ask for orders, products, COD risk — writes need explicit confirm.</li>
      </ol>

      <div
        style={{
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid var(--line-2)',
          background: 'var(--surface-2, rgba(0,0,0,0.02))',
          marginBottom: 14,
        }}
      >
        <p style={{ margin: 0, font: `700 10.5px/1 ${FONT}`, letterSpacing: '0.06em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
          CONNECT URL · STREAMABLE HTTP
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <code style={{ flex: 1, minWidth: 0, font: `500 12px/1.4 ${MONO}`, color: 'var(--ink)', wordBreak: 'break-all' }}>
            {connectUrl}
          </code>
          <button type="button" style={btn} onClick={() => void onCopy(connectUrl, 'Connect URL')}>
            Copy URL
          </button>
        </div>
        <p
          style={{
            margin: '8px 0 0',
            font: `400 11px/1.5 ${FONT}`,
            color: 'var(--ink-3)',
          }}
        >
          Only if a client cannot speak Streamable HTTP, the deprecated HTTP+SSE transport still
          answers at{' '}
          <code style={{ fontFamily: MONO, wordBreak: 'break-all' }}>{legacyConnectUrl}</code>.
        </p>
      </div>

      {fresh ? (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: '1px solid var(--ok-bd)',
            background: 'var(--ok-soft)',
            marginBottom: 12,
          }}
        >
          <p style={{ margin: 0, font: `700 12px/1.3 ${FONT}`, color: 'var(--ink)' }}>
            New token — copy now (shown once)
          </p>
          <code
            style={{
              display: 'block',
              marginTop: 8,
              font: `500 11.5px/1.45 ${MONO}`,
              color: 'var(--ink)',
              wordBreak: 'break-all',
            }}
          >
            {fresh.token}
          </code>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <button type="button" style={btn} onClick={() => void onCopy(fresh.token, 'MCP token')}>
              Copy token
            </button>
            <button type="button" style={btn} onClick={() => void onCopy(fresh.header, 'Auth header')}>
              Copy Authorization header
            </button>
            <button
              type="button"
              style={btn}
              onClick={() =>
                void onCopy(
                  `${connectUrl}\n${fresh.header}`,
                  'Connect snippet',
                )
              }
            >
              Copy URL + header
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p style={{ margin: 0, font: `400 12.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>Loading tokens…</p>
      ) : tokens.length === 0 ? (
        <p style={{ margin: 0, font: `400 12.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
          No MCP tokens yet. Generate one to connect Claude or ChatGPT.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tokens.map((row) => (
            <li
              key={row.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--line-2)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>{row.name}</p>
                <p style={{ margin: '4px 0 0', font: `500 11px/1.4 ${MONO}`, color: 'var(--ink-3)' }}>
                  {row.prefix}… · {row.status}
                  {row.lastUsed ? ` · last used ${new Date(row.lastUsed).toLocaleString()}` : ' · never used'}
                </p>
              </div>
              {row.status === 'active' ? (
                <button
                  type="button"
                  style={btn}
                  disabled={busy}
                  onClick={() => void onRevoke(row.id, row.name)}
                >
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Shell>
  )
}

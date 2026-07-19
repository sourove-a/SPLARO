'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ExternalLink, Loader2, RotateCcw, Send, WifiOff, X } from 'lucide-react'
import { AgentChatLauncher } from '@/components/agent/AgentChatLauncher'
import { toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import { AGENT_QUICK_COMMANDS } from '@/lib/agent/quick-commands'
import {
  clearAgentSession,
  fetchAgentConfig,
  fetchAgentHistory,
  fetchAgentStatus,
  streamAgentChat,
  switchAgentModel,
  type AgentModelId,
  type AgentStatusResponse,
  type AgentStreamEvent,
} from '@/lib/api/agent'
import { cn } from '@/lib/utils/cn'

const MODEL_LABELS: Record<AgentModelId, string> = {
  claude: 'Claude',
  openai: 'OpenAI GPT',
  gemini: 'Gemini',
  grok: 'Grok',
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'confirm'
  content: string
  toolName?: string
  pending?: boolean
  pendingId?: string
  costLabel?: string
  tone?: 'ok' | 'warn' | 'error'
}

function summarizeToolChip(
  toolName: string | undefined,
  result: unknown,
): { text: string; tone: 'ok' | 'warn' | 'error' } {
  if (result == null) return { text: 'No result', tone: 'warn' }
  if (typeof result === 'string') return { text: result.slice(0, 140), tone: 'ok' }

  const r = result as Record<string, unknown>
  if (r.error) return { text: String(r.error).slice(0, 140), tone: 'error' }
  if (r.ok === false) return { text: String(r.error ?? 'Failed').slice(0, 140), tone: 'error' }

  if (
    toolName === 'book_order_courier' &&
    (r.simulated === true ||
      (typeof r.consignmentId === 'string' && r.consignmentId.startsWith('DEV-')))
  ) {
    return {
      text: `Simulated — ${String(r.consignmentId ?? 'no consignment')} (not live)`,
      tone: 'warn',
    }
  }

  if (toolName === 'book_order_courier' && r.ok && r.consignmentId) {
    return { text: `Booked · ${String(r.consignmentId)}`, tone: 'ok' }
  }

  if (Array.isArray(result)) return { text: `${result.length} item(s)`, tone: 'ok' }
  if (typeof r.orderCount === 'number') return { text: `${r.orderCount} order(s)`, tone: 'ok' }
  if (typeof r.updated === 'number') return { text: `updated ${r.updated}`, tone: 'ok' }
  if (r.cached) return { text: 'cached read', tone: 'ok' }

  const s = JSON.stringify(result)
  return { text: s.length > 100 ? `${s.slice(0, 97)}…` : s, tone: 'ok' }
}

interface AgentChatPanelProps {
  open: boolean
  onClose?: () => void
  seedMessage?: string | null
  context?: string
  onSeedConsumed?: () => void
  /** Full-width workspace inside AI Command Brain */
  embedded?: boolean
  /** Parent already knows model readiness */
  chatReady?: boolean
  showQuickCommands?: boolean
  /** AI Command Brain setup page — avoid overlapping save bar */
  setupPage?: boolean
}

function sessionKey() {
  if (typeof window === 'undefined') return 'admin-session'
  const key = 'splaro-agent-session'
  let id = localStorage.getItem(key)
  if (!id) {
    id = `admin_${Date.now()}`
    localStorage.setItem(key, id)
  }
  return id
}

export function AgentChatPanel({
  open,
  onClose,
  seedMessage,
  context,
  onSeedConsumed,
  embedded,
  chatReady: chatReadyProp,
  showQuickCommands,
  setupPage,
}: AgentChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [model, setModel] = useState<AgentModelId>('claude')
  const [modelOpen, setModelOpen] = useState(false)
  const [status, setStatus] = useState<AgentStatusResponse | null>(null)
  const [apiOnline, setApiOnline] = useState(true)
  const [quickOpen, setQuickOpen] = useState(false)
  const sessionId = useRef(sessionKey())
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const refreshStatus = useCallback(async () => {
    try {
      const [cfg, st] = await Promise.all([fetchAgentConfig(), fetchAgentStatus()])
      setModel((cfg.activeModel as AgentModelId) || 'claude')
      setStatus(st)
      setApiOnline(true)
    } catch {
      setApiOnline(false)
      setStatus(null)
    }
  }, [])

  const loadHistory = useCallback(() => {
    fetchAgentHistory(sessionId.current)
      .then((history) => {
        if (history.length) {
          setMessages(
            history
              .filter((m) => m.role === 'user' || m.role === 'assistant')
              .map((m, i) => ({ id: `hist_${i}`, role: m.role as 'user' | 'assistant', content: m.content })),
          )
        }
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!open) return
    void refreshStatus()
    loadHistory()
  }, [open, refreshStatus, loadHistory])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTool])

  const appendAssistant = useCallback((id: string, chunk: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === id)
      if (idx === -1) {
        return [...prev, { id, role: 'assistant' as const, content: chunk }]
      }
      const existing = prev[idx]
      if (!existing) return prev
      const next = [...prev]
      next[idx] = { ...existing, content: existing.content + chunk }
      return next
    })
  }, [])

  const ready =
    chatReadyProp !== undefined
      ? chatReadyProp && apiOnline
      : apiOnline && (status?.activeModelReady ?? false)

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || streaming) return

      if (!apiOnline) {
        toastFail('API offline — start pnpm dev:stack')
        return
      }
      if (!ready) {
        toastFail('AI Command Brain এ API key যোগ করুন')
        return
      }

      const budgetPct = status?.budget?.pct ?? 0
      if (budgetPct >= 0.8 && budgetPct < 1) {
        toastWarn(
          `AI budget ~${Math.round(budgetPct * 100)}% used today — soft warn before hard refuse`,
          'agent-budget-warn',
        )
      }

      setMessages((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', content: trimmed }])
      setInput('')
      setStreaming(true)

      const assistantId = `a_${Date.now()}`
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', pending: true }])

      abortRef.current?.abort()
      abortRef.current = new AbortController()

      const handleEvent = (event: AgentStreamEvent) => {
        if (event.type === 'token' && event.content) appendAssistant(assistantId, event.content)
        if (event.type === 'tool_start' && event.toolName) {
          const toolName = event.toolName
          setActiveTool(toolName)
          setMessages((prev) => [
            ...prev,
            { id: `t_${toolName}_${Date.now()}`, role: 'tool' as const, content: '', toolName, pending: true },
          ])
        }
        if (event.type === 'tool_end' && event.toolName) {
          setActiveTool(null)
          const summary = summarizeToolChip(event.toolName, event.toolResult)
          setMessages((prev) =>
            prev.map((m) =>
              m.toolName === event.toolName && m.pending
                ? { ...m, pending: false, content: summary.text, tone: summary.tone }
                : m,
            ),
          )
          if (summary.tone === 'warn') {
            toastWarn(summary.text.slice(0, 160), `agent-tool-${event.toolName}`)
          } else if (summary.tone === 'error') {
            toastFail(summary.text.slice(0, 160), `agent-tool-${event.toolName}`)
          }
        }
        if (event.type === 'confirm_required') {
          const confirmMsg: ChatMessage = {
            id: `c_${event.pendingId ?? Date.now()}`,
            role: 'confirm',
            content: event.content ?? 'Confirm this action?',
          }
          if (event.pendingId) confirmMsg.pendingId = event.pendingId
          setMessages((prev) => [...prev, confirmMsg])
        }
        if (event.type === 'cost') {
          const tokens = (event.tokenInEst ?? 0) + (event.tokenOutEst ?? 0)
          const usd = event.costEstUsd ?? 0
          const costLabel =
            tokens > 0
              ? `~${tokens.toLocaleString()} tokens · ~$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(3)}`
              : undefined
          if (costLabel) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, costLabel } : m)),
            )
          }
        }
        if (event.type === 'budget_exceeded') {
          appendAssistant(assistantId, `\n\n⚠ ${event.content ?? 'Daily AI budget exceeded'}`)
          toastFail(event.content ?? 'Daily AI budget exceeded')
        }
        if (event.type === 'error') {
          appendAssistant(assistantId, `\n\n⚠ ${event.content ?? 'Error'}`)
          toastFail(event.content ?? 'AI request failed')
        }
        if (event.type === 'done') {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)))
        }
      }

      try {
        await streamAgentChat({
          sessionId: sessionId.current,
          message: trimmed,
          ...(context ? { context } : {}),
          ...(abortRef.current.signal ? { signal: abortRef.current.signal } : {}),
          onEvent: handleEvent,
        })
      } catch {
        appendAssistant(assistantId, '\n\n⚠ Connection failed')
        toastFail('Could not reach AI API')
      } finally {
        setStreaming(false)
        setActiveTool(null)
        setMessages((prev) => prev.map((m) => ({ ...m, pending: false })))
      }
    },
    [appendAssistant, apiOnline, context, ready, status?.budget?.pct, streaming],
  )

  useEffect(() => {
    if (open && seedMessage) {
      void sendMessage(seedMessage)
      onSeedConsumed?.()
    }
  }, [open, seedMessage, sendMessage, onSeedConsumed])

  const handleModelSwitch = async (next: AgentModelId) => {
    setModelOpen(false)
    if (!status?.models[next]?.configured) {
      toastFail(`${MODEL_LABELS[next]} API key আগে save করুন`)
      return
    }
    try {
      await switchAgentModel(next)
      setModel(next)
      await refreshStatus()
      toastOk(`Active model → ${MODEL_LABELS[next]}`)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Model switch failed')
    }
  }

  const handleClearSession = async () => {
    try {
      await clearAgentSession(sessionId.current)
      setMessages([])
      toastOk('Chat history cleared')
    } catch {
      toastFail('Could not clear session')
    }
  }

  if (!open) return null

  const configuredModels = (Object.keys(MODEL_LABELS) as AgentModelId[]).filter(
    (id) => status?.models[id]?.configured,
  )

  const quickCommands = showQuickCommands ?? !embedded

  return (
    <div
      className={cn(
        'admin-agent-chat flex flex-col overflow-hidden rounded-[22px] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_24px_60px_rgba(0,0,0,0.12)]',
        embedded
          ? 'admin-agent-chat--embedded relative w-full'
          : setupPage
            ? 'admin-agent-chat--setup-page fixed z-[75] w-[min(380px,calc(100vw-2rem))]'
            : 'fixed bottom-5 right-5 z-[80] w-[min(400px,calc(100vw-1.5rem))]',
      )}
    >
      <header className="admin-agent-chat__head flex items-center gap-3 px-4 py-3">
        <AgentChatLauncher online={ready} size="inline" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-[var(--admin-text)]">
            {embedded ? 'SPLARO Command' : 'SPLARO AI'}
          </p>
          <p className="truncate text-[10px] font-semibold text-[var(--admin-text-muted)]">
            {!apiOnline
              ? 'API offline'
              : ready
                ? `Live · ${MODEL_LABELS[model]} · real tools`
                : 'AI Command Brain এ API key দিন'}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setModelOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-[var(--admin-border)] px-2 py-1 text-[10px] font-bold text-[var(--admin-text-secondary)]"
          >
            {MODEL_LABELS[model]}
            <ChevronDown className="h-3 w-3" />
          </button>
          {modelOpen ? (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[130px] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
              {(Object.keys(MODEL_LABELS) as AgentModelId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={!status?.models[id]?.configured}
                  onClick={() => void handleModelSwitch(id)}
                  className={cn(
                    'block w-full px-3 py-1.5 text-left text-[11px] font-semibold hover:bg-[var(--admin-surface-hover)] disabled:opacity-40',
                    model === id && 'text-[#5E7CFF]',
                  )}
                >
                  {MODEL_LABELS[id]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {!embedded && onClose ? (
          <>
            <button
              type="button"
              title="Clear chat"
              onClick={() => void handleClearSession()}
              className="rounded-lg p-1.5 text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-hover)]"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-hover)]">
              <X className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </header>

      {!apiOnline ? (
        <div className="flex items-center gap-2 border-b border-amber-200/50 bg-amber-50/90 px-4 py-2 text-[11px] font-semibold text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/40 dark:text-amber-300">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          Start API — no fake replies
        </div>
      ) : !ready ? (
        <div className="border-b border-[var(--admin-border)] bg-[rgba(16, 17, 20, 0.08)] px-4 py-3 text-[11px] leading-relaxed text-[var(--admin-text-secondary)]">
          <p className="font-bold text-[var(--admin-text)]">API key লাগবে chat চালাতে</p>
          <p className="mt-1">
            Sidebar → <strong>AI Command Brain</strong> → API key save করুন।
          </p>
          <Link
            href="/dashboard/ai-agent"
            className="mt-2 inline-flex items-center gap-1 font-black text-[#3f3f46] hover:underline"
          >
            AI Command Brain
            <ExternalLink className="h-3 w-3" />
          </Link>
          {configuredModels.length > 0 ? (
            <p className="mt-2 text-[10px]">
              Keys saved: {configuredModels.map((id) => MODEL_LABELS[id]).join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {quickCommands ? (
        <div className="border-b border-[var(--admin-glass-border-subtle)] px-3 py-2">
          <button
            type="button"
            onClick={() => setQuickOpen((v) => !v)}
            className="text-[10px] font-black uppercase tracking-wide text-[var(--admin-text-muted)]"
          >
            Quick commands {quickOpen ? '▾' : '▸'}
          </button>
          {quickOpen ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AGENT_QUICK_COMMANDS.slice(0, 10).map((cmd) => (
                <button
                  key={cmd.id}
                  type="button"
                  disabled={streaming || !ready}
                  onClick={() => void sendMessage(cmd.message)}
                  className="ai-command-quick__chip"
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          'flex min-h-[260px] flex-1 flex-col gap-3 overflow-y-auto px-4 py-3',
          embedded ? 'max-h-[min(520px,55vh)]' : setupPage ? 'max-h-[min(360px,42vh)]' : 'max-h-[min(440px,52vh)]',
        )}
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <AgentChatLauncher online={ready} size="inline" />
            <p className="max-w-[280px] text-xs font-semibold leading-relaxed text-[var(--admin-text-secondary)]">
              Order, finance, courier, SEO — live database। Quick commands খুলে chip চাপুন।
            </p>
          </div>
        ) : null}

        {messages.map((msg) => {
          if (msg.role === 'tool') {
            const warn = msg.tone === 'warn' || msg.tone === 'error'
            return (
              <div key={msg.id} className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    'rounded-full px-3 py-1 text-[10px] font-bold',
                    warn
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
                      : 'bg-[rgba(16, 17, 20, 0.12)] text-[#3f3f46]',
                  )}
                >
                  {msg.pending ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : warn ? '⚠ ' : '🔧 '}
                  {msg.toolName?.replace(/_/g, ' ')}
                </span>
                {!msg.pending && msg.content ? (
                  <span
                    className={cn(
                      'max-w-[92%] text-center text-[10px] font-semibold leading-snug',
                      warn ? 'text-amber-800 dark:text-amber-300' : 'text-[var(--admin-text-muted)]',
                    )}
                  >
                    {msg.content}
                  </span>
                ) : null}
              </div>
            )
          }
          if (msg.role === 'confirm') {
            return (
              <div
                key={msg.id}
                className="mx-auto max-w-[92%] rounded-2xl border border-amber-300/60 bg-amber-50/80 px-3 py-3 text-[12px] leading-relaxed text-amber-950 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-100"
              >
                <p className="whitespace-pre-wrap font-semibold">{msg.content}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={streaming}
                    onClick={() => void sendMessage('confirm')}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-black text-white disabled:opacity-40"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={streaming}
                    onClick={() => void sendMessage('cancel')}
                    className="rounded-lg border border-amber-400/60 px-3 py-1 text-[11px] font-bold disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )
          }
          const isUser = msg.role === 'user'
          return (
            <div
              key={msg.id}
              className={cn(
                'max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
                isUser ? 'ml-auto bg-[#111] text-white dark:bg-[#5E7CFF] dark:text-[#111]' : 'bg-[var(--admin-surface-elevated)] text-[var(--admin-text)]',
              )}
            >
              {msg.content || (msg.pending ? <Loader2 className="h-4 w-4 animate-spin opacity-50" /> : null)}
              {!isUser && msg.costLabel ? (
                <p className="mt-1.5 text-[10px] font-semibold text-[var(--admin-text-muted)]">{msg.costLabel}</p>
              ) : null}
            </div>
          )
        })}
        {activeTool ? (
          <div className="flex justify-center">
            <span className="rounded-full border border-dashed border-[#5E7CFF]/40 px-3 py-1 text-[10px] font-bold text-[#3f3f46]">
              {activeTool.replace(/_/g, ' ')}…
            </span>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex gap-2 border-t border-[var(--admin-border)] p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void sendMessage(input)
        }}
      >
        <input
          className="admin-input flex-1 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={ready ? 'Bangla, Banglish বা English…' : 'AI Command Brain এ key দিন…'}
          disabled={streaming || !ready}
        />
        <button
          type="submit"
          disabled={streaming || !input.trim() || !ready}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5E7CFF] text-[#111] disabled:opacity-40"
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  )
}

export function AgentChatFab({ onClick, online }: { onClick: () => void; online?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="SPLARO AI Chat"
      aria-label="Open SPLARO AI chat"
      className="admin-agent-fab group fixed bottom-5 right-5 z-[70] flex flex-col items-center gap-1.5"
    >
      <AgentChatLauncher online={online !== false} />
      <span className="rounded-full bg-[var(--admin-text)] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[var(--admin-bg)] shadow-md">
        Chat
      </span>
    </button>
  )
}

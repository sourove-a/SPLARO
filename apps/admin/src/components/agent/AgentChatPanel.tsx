'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ChevronDown, ExternalLink, Loader2, Send, WifiOff, X } from 'lucide-react'
import { AgentChatLauncher } from '@/components/agent/AgentChatLauncher'
import {
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
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolName?: string
  pending?: boolean
}

interface AgentChatPanelProps {
  open: boolean
  onClose: () => void
  seedMessage?: string | null
  context?: string
  onSeedConsumed?: () => void
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

export function AgentChatPanel({ open, onClose, seedMessage, context, onSeedConsumed }: AgentChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [model, setModel] = useState<AgentModelId>('claude')
  const [modelOpen, setModelOpen] = useState(false)
  const [status, setStatus] = useState<AgentStatusResponse | null>(null)
  const [apiOnline, setApiOnline] = useState(true)
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

  useEffect(() => {
    if (!open) return
    void refreshStatus()
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
  }, [open, refreshStatus])

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

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || streaming) return

      if (!apiOnline) {
        toast.error('API offline — start pnpm dev:stack')
        return
      }
      if (status && !status.activeModelReady) {
        toast.error('Add API key in AI Command Brain (sidebar → AI Center)')
        return
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
          setMessages((prev) =>
            prev.map((m) =>
              m.toolName === event.toolName && m.pending
                ? { ...m, pending: false, content: 'Done' }
                : m,
            ),
          )
        }
        if (event.type === 'error') {
          appendAssistant(assistantId, `\n\n⚠ ${event.content ?? 'Error'}`)
          toast.error(event.content ?? 'AI request failed')
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
        toast.error('Could not reach AI API')
      } finally {
        setStreaming(false)
        setActiveTool(null)
        setMessages((prev) => prev.map((m) => ({ ...m, pending: false })))
      }
    },
    [appendAssistant, apiOnline, context, status, streaming],
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
      toast.error(`Add ${MODEL_LABELS[next]} API key first`)
      return
    }
    try {
      await switchAgentModel(next)
      setModel(next)
      await refreshStatus()
      toast.success(`Switched to ${MODEL_LABELS[next]}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Model switch failed')
    }
  }

  if (!open) return null

  const ready = apiOnline && (status?.activeModelReady ?? false)
  const configuredModels = (Object.keys(MODEL_LABELS) as AgentModelId[]).filter(
    (id) => status?.models[id]?.configured,
  )

  return (
    <div className="admin-agent-chat fixed bottom-5 right-5 z-[80] flex w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[22px] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_24px_60px_rgba(0,0,0,0.22)]">
      <header className="admin-agent-chat__head flex items-center gap-3 px-4 py-3">
        <AgentChatLauncher online={ready} size="inline" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-[var(--admin-text)]">SPLARO AI</p>
          <p className="truncate text-[10px] font-semibold text-[var(--admin-text-muted)]">
            {!apiOnline
              ? 'API offline'
              : ready
                ? `Live · ${MODEL_LABELS[model]}`
                : 'Add API key in AI Command Brain'}
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
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-hover)]">
          <X className="h-4 w-4" />
        </button>
      </header>

      {!apiOnline ? (
        <div className="flex items-center gap-2 border-b border-amber-200/50 bg-amber-50/90 px-4 py-2 text-[11px] font-semibold text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/40 dark:text-amber-300">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          Start API — no fake replies
        </div>
      ) : !ready ? (
        <div className="border-b border-[var(--admin-border)] bg-[rgba(200,169,126,0.08)] px-4 py-3 text-[11px] leading-relaxed text-[var(--admin-text-secondary)]">
          <p className="font-bold text-[var(--admin-text)]">API key লাগবে chat চালাতে</p>
          <p className="mt-1">
            Sidebar → <strong>AI Center</strong> → <strong>AI Command Brain</strong> — OpenAI key দিন, Save করুন।
          </p>
          <Link
            href="/dashboard/ai-agent"
            className="mt-2 inline-flex items-center gap-1 font-black text-[#9a7b52] hover:underline"
          >
            Open AI Command Brain
            <ExternalLink className="h-3 w-3" />
          </Link>
          {configuredModels.length > 0 ? (
            <p className="mt-2 text-[10px]">
              Keys saved: {configuredModels.map((id) => MODEL_LABELS[id]).join(', ')} — model dropdown থেকে সেটা select করুন।
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex max-h-[min(440px,52vh)] min-h-[260px] flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <AgentChatLauncher online={ready} size="inline" />
            <p className="max-w-[220px] text-xs font-semibold leading-relaxed text-[var(--admin-text-secondary)]">
              Real store data — orders, stock, SEO, product copy.
            </p>
          </div>
        ) : null}

        {messages.map((msg) => {
          if (msg.role === 'tool') {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="rounded-full bg-[rgba(200,169,126,0.12)] px-3 py-1 text-[10px] font-bold text-[#9a7b52]">
                  {msg.pending ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : '🔧'}
                  {msg.toolName?.replace(/_/g, ' ')}
                </span>
              </div>
            )
          }
          const isUser = msg.role === 'user'
          return (
            <div
              key={msg.id}
              className={cn(
                'max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
                isUser ? 'ml-auto bg-[#111] text-white dark:bg-[#5E7CFF] dark:text-[#111]' : 'bg-[var(--admin-surface-elevated)] text-[var(--admin-text)]',
              )}
            >
              {msg.content || (msg.pending ? <Loader2 className="h-4 w-4 animate-spin opacity-50" /> : null)}
            </div>
          )
        })}
        {activeTool ? (
          <div className="flex justify-center">
            <span className="rounded-full border border-dashed border-[#5E7CFF]/40 px-3 py-1 text-[10px] font-bold text-[#9a7b52]">
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
          placeholder={ready ? 'Ask SPLARO AI…' : 'AI Command Brain এ key দিন…'}
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

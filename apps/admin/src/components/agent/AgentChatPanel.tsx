'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Send,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react'
import { AgentChatLauncher } from '@/components/agent/AgentChatLauncher'
import { toastFail, toastOk } from '@/lib/admin/feedback'
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

/**
 * Engine names for the picker. These describe which key the store has to
 * supply, not who the assistant is — the assistant is SPLARO Command.
 * Kept version-free on purpose: the label used to promise "Claude 3.5 Sonnet"
 * while the API had already moved on, so the picker lied about what ran.
 */
const MODEL_LABELS: Record<AgentModelId, string> = {
  auto: 'Auto (smart fallback)',
  openrouter: 'OpenRouter',
  claude: 'Claude',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  grok: 'xAI Grok',
  manus: 'Manus',
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

/** Markdown parser that renders tables, bold, lists, and code blocks cleanly */
function FormattedMessageContent({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!text) return null

  // Check if content contains markdown table
  const lines = text.split('\n')
  const isTableLine = (line: string) => line.trim().startsWith('|') && line.trim().endsWith('|')

  const elements: React.ReactNode[] = []
  let tableRows: string[] = []
  let inTable = false

  const renderTable = (rows: string[], idx: number) => {
    if (rows.length < 2) return null
    const headerCells = rows[0]?.split('|').map((s) => s.trim()).filter(Boolean) ?? []
    const dataRows = rows
      .slice(1)
      .filter((r) => !r.includes('---'))
      .map((r) => r.split('|').map((s) => s.trim()).filter(Boolean))

    return (
      <div key={`table-${idx}`} className="my-2.5 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface-2)] shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--surface-3)]">
              {headerCells.map((h, i) => (
                <th key={i} className="px-3 py-2 font-bold text-[var(--ink)] tracking-wider text-[11px] uppercase">
                  {h.replace(/\*\*/g, '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {dataRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-[var(--surface-3)]/50 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-2 text-[var(--ink-2)] text-[12px] whitespace-nowrap">
                    {cell.startsWith('**') && cell.endsWith('**') ? (
                      <strong className="text-[var(--ink)]">{cell.replace(/\*\*/g, '')}</strong>
                    ) : cell.includes('[') && cell.includes(']') ? (
                      <span className="inline-flex rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--violet)] border border-[var(--line)]">
                        {cell}
                      </span>
                    ) : (
                      cell.replace(/\*\*/g, '')
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (isTableLine(line)) {
      inTable = true
      tableRows.push(line)
    } else {
      if (inTable) {
        elements.push(renderTable(tableRows, i))
        tableRows = []
        inTable = false
      }

      if (!line.trim()) {
        elements.push(<div key={`br-${i}`} className="h-2" />)
      } else if (line.startsWith('### ')) {
        elements.push(
          <h4 key={`h3-${i}`} className="my-1.5 font-bold text-[13.5px] text-[var(--ink)]">
            {line.replace('### ', '')}
          </h4>,
        )
      } else if (line.startsWith('## ') || line.startsWith('# ')) {
        elements.push(
          <h3 key={`h2-${i}`} className="my-2 font-black text-[14.5px] text-[var(--ink)]">
            {line.replace(/^#+\s/, '')}
          </h3>,
        )
      } else if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        const bulletText = line.trim().replace(/^[*]\s|^[-]\s/, '')
        elements.push(
          <div key={`li-${i}`} className="my-1 flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--violet)]" />
            <span>{parseInlineMarkdown(bulletText)}</span>
          </div>,
        )
      } else {
        elements.push(
          <p key={`p-${i}`} className="my-1 text-[12.5px] leading-relaxed text-[var(--ink)]">
            {parseInlineMarkdown(line)}
          </p>,
        )
      }
    }
  }

  if (inTable && tableRows.length > 0) {
    elements.push(renderTable(tableRows, lines.length))
  }

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={handleCopy}
        title="Copy response"
        className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-[var(--surface-2)] text-[var(--ink-3)] hover:text-[var(--ink)] border border-[var(--line)]"
      >
        {copied ? <Check className="h-3 w-3 text-[var(--ok)]" /> : <Copy className="h-3 w-3" />}
      </button>
      <div className="space-y-0.5">{elements}</div>
    </div>
  )
}

function parseInlineMarkdown(text: string): React.ReactNode {
  // Replace bold **text** and code `code`
  const parts: React.ReactNode[] = []
  const boldRegex = /\*\*(.*?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(parseCodeInline(text.substring(lastIndex, match.index)))
    }
    parts.push(
      <strong key={`b-${match.index}`} className="font-bold text-[var(--ink)]">
        {match[1]}
      </strong>,
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(parseCodeInline(text.substring(lastIndex)))
  }

  return parts.length > 0 ? parts : text
}

function parseCodeInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const codeRegex = /`([^`]+)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    parts.push(
      <code
        key={`c-${match.index}`}
        className="rounded px-1.5 py-0.5 font-mono text-[11.5px] font-semibold bg-[var(--surface-2)] text-[var(--violet)] border border-[var(--line)]"
      >
        {match[1]}
      </code>,
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts.length > 0 ? parts : text
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
  const [expanded, setExpanded] = useState(false)
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
  }, [messages, streaming, activeTool])

  const ready = chatReadyProp ?? (status?.activeModelReady ?? false)

  const handleStreamEvent = useCallback((event: AgentStreamEvent, botMsgId: string) => {
    if (event.type === 'token') {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, content: m.content + (event.content ?? ''), pending: false }
            : m,
        ),
      )
    } else if (event.type === 'tool_start') {
      setActiveTool(event.toolName ?? null)
    } else if (event.type === 'tool_end') {
      setActiveTool(null)
      const summary = summarizeToolChip(event.toolName, event.toolResult)
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== botMsgId),
        {
          id: `tool_${Date.now()}_${Math.random()}`,
          role: 'tool',
          ...(event.toolName ? { toolName: event.toolName } : {}),
          content: summary.text,
          tone: summary.tone,
        },
        ...prev.filter((m) => m.id === botMsgId),
      ])
    } else if (event.type === 'confirm_required') {
      setMessages((prev) => [
        ...prev,
        {
          id: `conf_${Date.now()}`,
          role: 'confirm',
          content: event.content ?? 'Please confirm action',
          ...(event.pendingId ? { pendingId: event.pendingId } : {}),
        },
      ])
    } else if (event.type === 'cost') {
      if (event.costEstUsd != null && event.costEstUsd > 0) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? { ...m, costLabel: `$${event.costEstUsd?.toFixed(4)}` }
              : m,
          ),
        )
      }
    } else if (event.type === 'budget_exceeded') {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: event.content ?? 'Daily AI budget limit reached.',
          tone: 'warn',
        },
      ])
    } else if (event.type === 'error') {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, content: event.content ?? 'Error', tone: 'error', pending: false }
            : m,
        ),
      )
    }
  }, [])

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text || streaming || !ready) return

      setInput('')
      const userMsgId = `usr_${Date.now()}`
      const botMsgId = `bot_${Date.now()}`
      setMessages((prev) => [...prev, { id: userMsgId, role: 'user', content: text }])
      setStreaming(true)
      setActiveTool(null)

      abortRef.current = new AbortController()

      setMessages((prev) => [
        ...prev,
        { id: botMsgId, role: 'assistant', content: '', pending: true },
      ])

      try {
        await streamAgentChat({
          sessionId: sessionId.current,
          message: text,
          ...(context ? { context } : {}),
          ...(abortRef.current ? { signal: abortRef.current.signal } : {}),
          onEvent: (event) => handleStreamEvent(event, botMsgId),
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error talking to agent'
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? { ...m, content: `Error: ${msg}`, tone: 'error', pending: false }
              : m,
          ),
        )
      } finally {
        setStreaming(false)
        setActiveTool(null)
        abortRef.current = null
        void refreshStatus()
      }
    },
    [context, handleStreamEvent, ready, refreshStatus, streaming],
  )

  useEffect(() => {
    if (seedMessage && open && ready && !streaming) {
      void sendMessage(seedMessage)
      onSeedConsumed?.()
    }
  }, [seedMessage, open, ready, streaming, sendMessage, onSeedConsumed])

  const handleModelSwitch = async (next: AgentModelId) => {
    setModelOpen(false)
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
        'admin-agent-chat flex flex-col overflow-hidden border border-[var(--line)] bg-[var(--surface)] shadow-[0_32px_100px_rgba(0,0,0,0.7)] transition-all duration-300',
        embedded
          ? 'admin-agent-chat--embedded relative w-full rounded-[24px]'
          : setupPage
            ? cn(
                'admin-agent-chat--setup-page fixed bottom-5 right-5 z-[85] rounded-[24px]',
                expanded ? 'w-[min(680px,calc(100vw-2.5rem))]' : 'w-[min(460px,calc(100vw-2rem))]',
              )
            : cn(
                'fixed bottom-5 right-5 z-[85] rounded-[24px]',
                expanded ? 'w-[min(720px,calc(100vw-2.5rem))]' : 'w-[min(480px,calc(100vw-2rem))]',
              ),
      )}
      style={{
        background: 'var(--surface)',
        backgroundImage: 'var(--card-sheen)',
      }}
    >
      {/* HEADER */}
      <header className="admin-agent-chat__head flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <AgentChatLauncher online={ready} size="inline" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-[14px] font-bold text-[var(--ink)]">
                {embedded ? 'SPLARO Command Brain' : 'SPLARO AI Assistant'}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--violet-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--violet)]">
                <Sparkles className="h-2.5 w-2.5" />
                LIVE
              </span>
            </div>
            <p className="truncate text-[11px] font-medium text-[var(--ink-3)]">
              {!apiOnline
                ? 'API offline'
                : ready
                  ? `Active · ${MODEL_LABELS[model]} · Live DB Tools`
                  : 'API key required in AI Command Brain'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* MODEL PICKER */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setModelOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--violet)] transition-colors"
            >
              <span className="truncate max-w-[90px]">{MODEL_LABELS[model].split(' ')[0]}</span>
              <ChevronDown className="h-3 w-3 text-[var(--ink-3)]" />
            </button>
            {modelOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[170px] rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1.5 shadow-xl">
                {(Object.keys(MODEL_LABELS) as AgentModelId[]).map((id) => {
                  const isCfg = status?.models[id]?.configured
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!isCfg}
                      onClick={() => void handleModelSwitch(id)}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] font-medium hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40',
                        model === id ? 'text-[var(--violet)] font-bold' : 'text-[var(--ink)]',
                      )}
                    >
                      <span>{MODEL_LABELS[id]}</span>
                      {model === id ? <Check className="h-3.5 w-3.5 text-[var(--violet)]" /> : null}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>

          {/* EXPAND / MINIMIZE BUTTON */}
          {!embedded ? (
            <button
              type="button"
              title={expanded ? 'Collapse to compact view' : 'Expand full drawer'}
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg p-1.5 text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors"
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          ) : null}

          {/* CLEAR HISTORY */}
          <button
            type="button"
            title="Clear chat history"
            onClick={() => void handleClearSession()}
            className="rounded-lg p-1.5 text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* CLOSE BUTTON */}
          {!embedded && onClose ? (
            <button
              type="button"
              title="Close chat"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </header>

      {/* OFFLINE / MISSING KEY BANNERS */}
      {!apiOnline ? (
        <div className="flex items-center gap-2 border-b border-[var(--warn-bd)] bg-[var(--warn-soft)] px-4 py-2.5 text-[12px] font-semibold text-[var(--warn)]">
          <WifiOff className="h-4 w-4 shrink-0" />
          API is offline. Start backend with <code>pnpm dev:api</code> to enable AI replies.
        </div>
      ) : !ready ? (
        <div className="border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-[12px] leading-relaxed text-[var(--ink-2)]">
          {/* SPLARO Command runs on a model provider the store chooses. Naming
              vendors here made the panel read as though the assistant itself
              were somebody else's product. */}
          <p className="font-bold text-[var(--ink)]">SPLARO Command is not connected yet</p>
          <p className="mt-1">
            Add a model key in <strong>AI Command Brain</strong> to switch it on. The store picks the
            provider — SPLARO Command is the same assistant either way.
          </p>
          <Link
            href="/dashboard/ai-agent"
            className="mt-2 inline-flex items-center gap-1.5 font-bold text-[var(--violet)] hover:underline"
          >
            Open AI Command Brain
            <ExternalLink className="h-3 w-3" />
          </Link>
          {configuredModels.length > 0 ? (
            <p className="mt-2 text-[11px] text-[var(--ink-3)]">
              Configured providers: {configuredModels.map((id) => MODEL_LABELS[id]).join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* QUICK COMMANDS */}
      {quickCommands ? (
        <div className="border-b border-[var(--line)] bg-[var(--surface-2)]/60 px-4 py-2">
          <button
            type="button"
            onClick={() => setQuickOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          >
            <span>Quick Commands</span>
            <span className="text-[9px]">{quickOpen ? '▲' : '▼'}</span>
          </button>
          {quickOpen ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AGENT_QUICK_COMMANDS.slice(0, 10).map((cmd) => (
                <button
                  key={cmd.id}
                  type="button"
                  disabled={streaming || !ready}
                  onClick={() => void sendMessage(cmd.message)}
                  className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink)] hover:border-[var(--violet)] hover:text-[var(--violet)] transition-colors disabled:opacity-40 shadow-xs"
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* MESSAGES VIEWPORT */}
      <div
        className={cn(
          'flex min-h-[300px] flex-1 flex-col gap-3 overflow-y-auto px-4 py-4',
          expanded
            ? 'max-h-[min(620px,65vh)]'
            : embedded
              ? 'max-h-[min(520px,55vh)]'
              : setupPage
                ? 'max-h-[min(380px,45vh)]'
                : 'max-h-[min(480px,55vh)]',
        )}
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-3 py-6 text-center my-auto">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--violet-soft)] border border-[var(--violet-bd)] shadow-sm">
              <Sparkles className="h-6 w-6 text-[var(--violet)]" />
            </div>
            <div className="max-w-[320px]">
              <p className="text-[14px] font-black text-[var(--ink)]">How can SPLARO AI assist you?</p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-[var(--ink-3)]">
                Ask about real-time sales, order fulfillment, low stock, customer COD risk, or SEO gaps.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {['আজকের সেলস সামারি?', 'Low stock alert', 'SEO gaps check'].map((hint) => (
                <button
                  key={hint}
                  type="button"
                  disabled={streaming || !ready}
                  onClick={() => void sendMessage(hint)}
                  className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1 text-[11.5px] font-semibold text-[var(--ink)] hover:border-[var(--violet)] hover:text-[var(--violet)] transition-all disabled:opacity-40"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((msg) => {
          if (msg.role === 'tool') {
            const warn = msg.tone === 'warn' || msg.tone === 'error'
            return (
              <div key={msg.id} className="flex flex-col items-center gap-1 my-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[11px] font-bold border',
                    warn
                      ? 'border-[var(--warn-bd)] bg-[var(--warn-soft)] text-[var(--warn)]'
                      : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-2)]',
                  )}
                >
                  {msg.pending ? <Loader2 className="h-3 w-3 animate-spin text-[var(--violet)]" /> : warn ? '⚠ ' : '⚡ '}
                  {msg.toolName?.replace(/_/g, ' ')}
                </span>
                {!msg.pending && msg.content ? (
                  <span
                    className={cn(
                      'max-w-[90%] text-center text-[11px] font-medium leading-snug',
                      warn ? 'text-[var(--warn)]' : 'text-[var(--ink-3)]',
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
                className="mx-auto my-2 w-full max-w-[95%] rounded-2xl border border-[var(--warn-bd)] bg-[var(--warn-soft)] p-3.5 text-[12.5px] leading-relaxed text-[var(--ink)] shadow-md"
              >
                <div className="flex items-center gap-2 font-bold text-[var(--warn)] mb-1">
                  <span>⚠ Confirmation Required</span>
                </div>
                <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={streaming}
                    onClick={() => void sendMessage('confirm')}
                    className="rounded-lg bg-[var(--ok)] px-3.5 py-1.5 text-[11.5px] font-bold text-[var(--on-primary,var(--admin-color-white))] hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    Confirm Action
                  </button>
                  <button
                    type="button"
                    disabled={streaming}
                    onClick={() => void sendMessage('cancel')}
                    className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[11.5px] font-bold text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
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
                'max-w-[90%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-xs',
                isUser
                  ? 'ml-auto bg-[var(--violet)] text-white font-medium rounded-br-xs'
                  : 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)] rounded-bl-xs',
              )}
            >
              {isUser ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : (
                <>
                  <FormattedMessageContent text={msg.content} />
                  {msg.pending ? <Loader2 className="h-4 w-4 animate-spin opacity-60 mt-1 text-[var(--violet)]" /> : null}
                  {msg.costLabel ? (
                    <p className="mt-2 text-[10.5px] font-medium text-[var(--ink-3)] border-t border-[var(--line)] pt-1">
                      {msg.costLabel}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          )
        })}

        {activeTool ? (
          <div className="flex justify-center my-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--violet-bd)] bg-[var(--violet-soft)] px-3 py-1 text-[11px] font-bold text-[var(--violet)]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Running {activeTool.replace(/_/g, ' ')}…
            </span>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {/* INPUT FORM */}
      <form
        className="flex items-center gap-2 border-t border-[var(--line)] bg-[var(--surface)] p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void sendMessage(input)
        }}
      >
        <input
          className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[13px] text-[var(--ink)] placeholder-[var(--ink-3)] focus:border-[var(--violet)] focus:outline-none transition-colors"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={ready ? 'Ask in Bangla, Banglish or English…' : 'Add API key in AI Command Brain…'}
          disabled={streaming || !ready}
        />
        <button
          type="submit"
          disabled={streaming || !input.trim() || !ready}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--violet)] text-white hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
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
      title="Open SPLARO AI Assistant"
      aria-label="Open SPLARO AI chat"
      className="admin-agent-fab group fixed bottom-5 right-5 z-[70] flex items-center gap-2.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 shadow-2xl hover:border-[var(--violet)] hover:shadow-[0_8px_30px_rgba(113,46,255,0.3)] transition-all"
    >
      <AgentChatLauncher online={online !== false} size="inline" />
      <span className="font-bold text-[12.5px] text-[var(--ink)] tracking-wide">
        Ask SPLARO
      </span>
    </button>
  )
}

'use client'

import { Fragment, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { toastOk, toastFail, toastApiSaved, toastInfo } from '@/lib/admin/feedback'
import { AgentChatLauncher } from '@/components/agent/AgentChatLauncher'
import { DcKpiStrip } from '@/components/dc/DcKpiStrip'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { DcIcon } from '@/components/dc/DcIcon'
import { AGENT_TOOL_CATALOG, AGENT_TOOL_TIERS } from '@/lib/agent/tool-catalog'
import { AGENT_QUICK_COMMANDS } from '@/lib/agent/quick-commands'
import {
  clearAgentProviderKey,
  fetchAgentActivity,
  fetchAgentConfig,
  fetchAgentStatus,
  updateAgentConfig,
  switchAgentModel,
  testAgentTelegram,
  type AgentActivityRun,
  type AgentModelId,
  type AgentStatusResponse,
} from '@/lib/api/agent'
import { useAiIntegration, useTelegramIntegration, useUpdateAiIntegration } from '@/lib/api/integration-hooks'
import { useAdminUiStore } from '@/store/uiStore'
import { McpLinkTokenPanel } from '@/components/agent/McpLinkTokenPanel'
import { DcModal } from '@/components/dc/DcModal'

type ConcreteModelId = Exclude<AgentModelId, 'auto'>

const MODELS: { id: ConcreteModelId; label: string; keyLabel: string; placeholder: string; envHint: string }[] = [
  { id: 'openrouter', label: 'OpenRouter (Universal — All Models)', keyLabel: 'OpenRouter API Key', placeholder: 'sk-or-v1-...', envHint: 'OPENROUTER_API_KEY' },
  { id: 'openai', label: 'OpenAI (GPT-4o / GPT-4o-mini)', keyLabel: 'OpenAI API Key', placeholder: 'sk-...', envHint: 'OPENAI_API_KEY' },
  { id: 'gemini', label: 'Gemini (Google 2.0 / 1.5)', keyLabel: 'Gemini API Key', placeholder: 'AIza...', envHint: 'GEMINI_API_KEY' },
  { id: 'claude', label: 'Claude (Anthropic)', keyLabel: 'Anthropic API Key', placeholder: 'sk-ant-...', envHint: 'ANTHROPIC_API_KEY' },
  { id: 'grok', label: 'Grok (xAI)', keyLabel: 'Grok API Key', placeholder: 'xai-...', envHint: 'GROK_API_KEY' },
  { id: 'manus', label: 'Manus', keyLabel: 'Manus API Key', placeholder: 'sk-… (manus.im)', envHint: 'MANUS_API_KEY' },
]

const MODEL_OPTIONS: { id: AgentModelId; label: string; desc: string }[] = [
  { id: 'auto', label: '🤖 Auto (Smart Fallback)', desc: 'স্বয়ংক্রিয়ভাবে যেকোনো অ্যাক্টিভ কি ব্যবহার করবে' },
  { id: 'openrouter', label: '🌐 OpenRouter (Universal)', desc: 'OpenRouter.ai API (All Models)' },
  { id: 'openai', label: 'OpenAI (GPT-4o)', desc: 'Direct OpenAI key' },
  { id: 'gemini', label: 'Gemini (Google)', desc: 'Direct Google Gemini key' },
  { id: 'claude', label: 'Claude (Anthropic)', desc: 'Direct Anthropic key / Proxy' },
  { id: 'grok', label: 'Grok (xAI)', desc: 'Direct xAI Grok key' },
  { id: 'manus', label: 'Manus (Autonomous)', desc: 'Autonomous tasks API' },
]

/**
 * Common OpenRouter model ids.
 *
 * The field accepts any id OpenRouter serves — nothing here is an allowlist,
 * and a custom id still works. These are shortcuts, because the ids are exact
 * strings ("deepseek/deepseek-r1", not "DeepSeek R1") and a typo silently ends
 * up as a 404 from the provider at chat time rather than a save error.
 */
const OPENROUTER_PRESETS: { id: string; label: string; note: string }[] = [
  { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1', note: 'reasoning' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3', note: 'cheap general' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', note: 'default' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', note: 'writing' },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', note: 'fast' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', note: 'open' },
]

const KEY_FIELD: Record<ConcreteModelId, string> = {
  openrouter: 'openrouterKey',
  openai: 'openaiKey',
  gemini: 'geminiKey',
  claude: 'claudeKey',
  grok: 'grokKey',
  manus: 'manusKey',
}

function isMasked(v: string | null) {
  return v != null && v.includes('••••')
}

function resolveSaveTargetLabel(): { label: string; isLocal: boolean } {
  if (typeof window === 'undefined') return { label: 'server', isLocal: false }
  const host = window.location.hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1'
  return {
    isLocal,
    label: isLocal ? 'local dev API (:4000)' : host,
  }
}

function modelIsConfigured(
  id: AgentModelId,
  status: AgentStatusResponse | null,
  savedKeys: Record<ConcreteModelId, string | null>,
  claudeAuthMode: 'api_key' | 'antigravity_proxy',
  claudeBaseUrl: string,
): boolean {
  if (id === 'auto') {
    return Boolean(
      Object.values(savedKeys).some((k) => isMasked(k) || Boolean(k)) ||
      (claudeAuthMode === 'antigravity_proxy' && claudeBaseUrl.trim()) ||
      Object.values(status?.models ?? {}).some((m) => m?.configured)
    )
  }
  if (status?.models[id]?.configured) return true
  if (id === 'claude' && claudeAuthMode === 'antigravity_proxy' && claudeBaseUrl.trim()) return true
  return isMasked(savedKeys[id]) || Boolean(savedKeys[id])
}




/* ── DC surface primitives ──────────────────────────────────────────
   This screen used to render in the legacy admin language (--admin-* tokens,
   Tailwind colour classes) under a DC page head. Everything below speaks the
   DC token set so it matches the rest of the dashboard in both themes. */

const dcCard = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const dcCaps = {
  display: 'block',
  font: `600 10.5px/1.4 ${FONT}`,
  letterSpacing: '.11em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

const dcInput = {
  width: '100%',
  marginTop: 6,
  padding: '9px 11px',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  font: `500 12.5px/1.4 ${MONO}`,
} as const

const dcTh = {
  textAlign: 'left' as const,
  padding: '8px 12px',
  font: `600 10px/1 ${FONT}`,
  letterSpacing: '.1em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

const dcTd = {
  padding: '9px 12px',
  borderBottom: '1px solid var(--line)',
  color: 'var(--ink)',
  verticalAlign: 'top' as const,
}

/** Primary = the one violet control per surface; everything else is neutral. */
function dcBtn(primary: boolean) {
  return {
    height: 34,
    padding: '0 15px',
    borderRadius: 9,
    cursor: 'pointer',
    font: `600 12.5px/1 ${FONT}`,
    border: `1px solid var(${primary ? '--violet' : '--line'})`,
    background: primary ? 'var(--violet)' : 'var(--surface-2)',
    color: primary ? 'var(--on-violet)' : 'var(--ink-2)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const
}

/** Row-level control: same language as dcBtn, sized for an inline table row. */
function dcBtnSm(primary: boolean) {
  return {
    height: 28,
    padding: '0 10px',
    borderRadius: 8,
    cursor: 'pointer',
    font: `600 11.5px/1 ${FONT}`,
    border: `1px solid var(${primary ? '--violet' : '--line'})`,
    background: primary ? 'var(--violet)' : 'var(--surface-2)',
    color: primary ? 'var(--on-violet)' : 'var(--ink-2)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap' as const,
  } as const
}

/** An empty provider reads as an invitation, not an error — soft warn tint. */
const keyAddTone = {
  border: '1px solid var(--warn-bd)',
  background: 'var(--warn-soft)',
  color: 'var(--warn)',
} as const

function dcChip(tone: DcTone) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 99,
    font: `700 10px/1.6 ${FONT}`,
    letterSpacing: '.06em',
    ...toneStyle(tone),
  } as const
}

function BrainSection({
  id,
  icon,
  title,
  hint,
  collapsible,
  defaultOpen = true,
  preview,
  accent,
  children,
}: {
  id?: string
  icon: string
  title: string
  hint?: string
  collapsible?: boolean
  defaultOpen?: boolean
  preview?: ReactNode
  /** Tints the card — used by MCP Link, which is a connector others plug into. */
  accent?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (!id || !collapsible) return
    const openOnHash = () => {
      if (window.location.hash === `#${id}`) setOpen(true)
    }
    openOnHash()
    window.addEventListener('hashchange', openOnHash)
    return () => window.removeEventListener('hashchange', openOnHash)
  }, [id, collapsible])

  return (
    <section
      id={id}
      style={{
        ...dcCard,
        padding: '14px 15px',
        ...(accent
          ? {
              border: '1px solid var(--violet-bd)',
              background: 'var(--violet-soft)',
              backgroundImage: 'none',
            }
          : {}),
      }}
    >
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'inherit',
          }}
        >
          <DcIcon name={icon} size={15} color={accent ? 'var(--violet)' : 'var(--ink-2)'} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', font: `700 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>{title}</span>
            {hint ? (
              <span style={{ display: 'block', marginTop: 3, font: `400 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
                {hint}
              </span>
            ) : null}
          </span>
          <DcIcon name={open ? 'icon-chevron-up' : 'icon-chevron-down'} size={14} color="var(--ink-3)" />
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <DcIcon name={icon} size={15} color={accent ? 'var(--violet)' : 'var(--ink-2)'} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, font: `700 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>{title}</p>
            {hint ? (
              <p style={{ margin: '3px 0 0', font: `400 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>{hint}</p>
            ) : null}
          </div>
        </div>
      )}
      {open ? <div style={{ marginTop: 12 }}>{children}</div> : preview ? <div style={{ marginTop: 10 }}>{preview}</div> : null}
    </section>
  )
}


export function AiCommandCenterPanel({ embedded = false }: { embedded?: boolean }) {
  void embedded
  const openAgentChat = useAdminUiStore((s) => s.openAgentChat)
  const { data: tgData } = useTelegramIntegration()
  const { data: aiIntegration } = useAiIntegration()
  const updateAiIntegration = useUpdateAiIntegration()

  const [status, setStatus] = useState<AgentStatusResponse | null>(null)
  const [activeModel, setActiveModel] = useState<AgentModelId>('auto')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [openrouterModel, setOpenrouterModel] = useState('openai/gpt-4o-mini')
  const [keyInputs, setKeyInputs] = useState<Record<ConcreteModelId, string>>({
    openrouter: '', openai: '', gemini: '', claude: '', grok: '', manus: '',
  })
  const [savedKeys, setSavedKeys] = useState<Record<ConcreteModelId, string | null>>({
    openrouter: null, openai: null, gemini: null, claude: null, grok: null, manus: null,
  })
  const [showKey, setShowKey] = useState<Record<ConcreteModelId, boolean>>({
    openrouter: false, openai: false, gemini: false, claude: false, grok: false, manus: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [apiOffline, setApiOffline] = useState<string | null>(null)
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini')
  const [claudeAuthMode, setClaudeAuthMode] = useState<'api_key' | 'antigravity_proxy'>('api_key')
  const [claudeBaseUrl, setClaudeBaseUrl] = useState('http://localhost:8080')
  // SSR-stable — resolve host after mount so local vs production pill matches.
  const [saveTarget, setSaveTarget] = useState(() => ({ label: 'server', isLocal: false }))
  const [claudeAuthTokenInput, setClaudeAuthTokenInput] = useState('')
  const [savedClaudeAuthToken, setSavedClaudeAuthToken] = useState<string | null>(null)
  const [activity, setActivity] = useState<AgentActivityRun[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityFilter, setActivityFilter] = useState<'all' | 'completed' | 'failed'>('all')
  const [activityShown, setActivityShown] = useState(10)
  const [mcpOk, setMcpOk] = useState<boolean | null>(null)
  const [addingKey, setAddingKey] = useState<Record<ConcreteModelId, boolean>>({
    openrouter: false, openai: false, gemini: false, claude: false, grok: false, manus: false,
  })
  const [savingKey, setSavingKey] = useState<ConcreteModelId | null>(null)
  const [removingKey, setRemovingKey] = useState<ConcreteModelId | null>(null)
  /** Provider awaiting delete confirmation — removing a key breaks live chat. */
  const [removeKeyTarget, setRemoveKeyTarget] = useState<ConcreteModelId | null>(null)

  const reload = async () => {
    try {
      const [cfg, st] = await Promise.all([fetchAgentConfig(), fetchAgentStatus()])
      setActiveModel((cfg.activeModel as AgentModelId) || 'auto')
      setSystemPrompt(cfg.systemPrompt ?? '')
      setOpenrouterModel(cfg.openrouterModel || 'openai/gpt-4o-mini')
      setSavedKeys({
        openrouter: cfg.openrouterKey ?? null,
        openai: cfg.openaiKey,
        gemini: cfg.geminiKey,
        claude: cfg.claudeKey,
        grok: cfg.grokKey,
        manus: cfg.manusKey,
      })
      setClaudeAuthMode(cfg.claudeAuthMode === 'antigravity_proxy' ? 'antigravity_proxy' : 'api_key')
      setClaudeBaseUrl(cfg.claudeBaseUrl || 'http://localhost:8080')
      setSavedClaudeAuthToken(cfg.claudeAuthToken ?? null)
      setStatus(st)
      setApiOffline(null)
    } catch (err) {
      setApiOffline(err instanceof Error ? err.message : 'API offline')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void reload() }, [])

  useEffect(() => {
    setSaveTarget(resolveSaveTargetLabel())
  }, [])

  useEffect(() => {
    void fetch('/api/mcp/health', { method: 'GET', cache: 'no-store' })
      .then((res) => setMcpOk(res.ok))
      .catch(() => setMcpOk(false))
  }, [])

  const loadActivity = async () => {
    setActivityLoading(true)
    try {
      const rows = await fetchAgentActivity(undefined, 100)
      setActivity(rows)
    } catch {
      setActivity([])
    } finally {
      setActivityLoading(false)
    }
  }

  useEffect(() => {
    if (!loading && !apiOffline) void loadActivity()
  }, [loading, apiOffline])

  useEffect(() => {
    if (aiIntegration?.defaultModel) setOpenaiModel(aiIntegration.defaultModel)
  }, [aiIntegration?.defaultModel])

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        activeModel,
        systemPrompt,
        claudeAuthMode,
        claudeBaseUrl: claudeAuthMode === 'antigravity_proxy' ? claudeBaseUrl.trim() : '',
        openrouterModel: openrouterModel.trim(),
      }
      if (claudeAuthTokenInput.trim()) body.claudeAuthToken = claudeAuthTokenInput.trim()
      for (const m of MODELS) {
        const val = keyInputs[m.id].trim()
        if (val) body[KEY_FIELD[m.id]] = val
      }

      const hasClaudeProxy = claudeAuthMode === 'antigravity_proxy' && Boolean(claudeBaseUrl.trim())
      const hasAnyKey =
        hasClaudeProxy ||
        MODELS.some((m) => keyInputs[m.id].trim() || isMasked(savedKeys[m.id])) ||
        activeModel === 'auto'
      if (!hasAnyKey && !Object.values(savedKeys).some(Boolean)) {
        toastFail('Add at least one API key or Antigravity proxy URL.', 'ai-no-key')
        return
      }

      await updateAgentConfig(body as never)
      if (activeModel === 'openai' && openaiModel) {
        await updateAiIntegration.mutateAsync({ defaultModel: openaiModel })
      }
      setKeyInputs({ openrouter: '', openai: '', gemini: '', claude: '', grok: '', manus: '' })
      setClaudeAuthTokenInput('')
      const [cfg, st] = await Promise.all([fetchAgentConfig(), fetchAgentStatus()])
      setActiveModel((cfg.activeModel as AgentModelId) || 'auto')
      setSystemPrompt(cfg.systemPrompt ?? '')
      setOpenrouterModel(cfg.openrouterModel || 'openai/gpt-4o-mini')
      setSavedKeys({
        openrouter: cfg.openrouterKey ?? null,
        openai: cfg.openaiKey,
        gemini: cfg.geminiKey,
        claude: cfg.claudeKey,
        grok: cfg.grokKey,
        manus: cfg.manusKey,
      })
      setClaudeAuthMode(cfg.claudeAuthMode === 'antigravity_proxy' ? 'antigravity_proxy' : 'api_key')
      setClaudeBaseUrl(cfg.claudeBaseUrl || 'http://localhost:8080')
      setSavedClaudeAuthToken(cfg.claudeAuthToken ?? null)
      setStatus(st)
      setApiOffline(null)
      toastApiSaved('Agent configuration')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Save failed', 'ai-save-err')
    } finally {
      setSaving(false)
    }
  }

  const handleSwitchModel = async (model: AgentModelId) => {
    setActiveModel(model)
    try {
      await switchAgentModel(model)
      const [cfg, st] = await Promise.all([fetchAgentConfig(), fetchAgentStatus()])
      setActiveModel((cfg.activeModel as AgentModelId) || model)
      setStatus(st)
      const label = MODEL_OPTIONS.find((m) => m.id === model)?.label ?? model
      toastOk(`Active model → ${label}`, 'ai-switch-ok')
    } catch {
      const label = MODEL_OPTIONS.find((m) => m.id === model)?.label ?? model
      toastInfo(`Selected ${label}. Click Save to apply.`)
    }
    if (model !== 'auto') {
      document.getElementById(`ai-key-${model}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  /**
   * Removal is confirmed first and reports the env fallback honestly: wiping
   * the stored key does not stop a provider whose key is also in the server
   * environment, and a silent "removed" there would be a lie.
   */
  const handleRemoveKey = async (id: ConcreteModelId) => {
    setRemovingKey(id)
    try {
      const result = await clearAgentProviderKey(id)
      const cfg = result.config
      setSavedKeys({
        openrouter: cfg.openrouterKey ?? null,
        openai: cfg.openaiKey,
        gemini: cfg.geminiKey,
        claude: cfg.claudeKey,
        grok: cfg.grokKey,
        manus: cfg.manusKey,
      })
      setKeyInputs((prev) => ({ ...prev, [id]: '' }))
      setAddingKey((prev) => ({ ...prev, [id]: false }))
      setStatus(await fetchAgentStatus())
      const label = MODELS.find((m) => m.id === id)?.keyLabel ?? 'API key'
      if (result.envFallback) {
        toastInfo(
          `${label} removed — but ${result.envVar} is still set on the server, so this provider keeps working`,
        )
      } else {
        toastOk(`${label} removed — this provider stops until a new key is saved`)
      }
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Key removal failed', 'ai-key-remove-err')
    } finally {
      setRemovingKey(null)
      setRemoveKeyTarget(null)
    }
  }

  const handleSaveKey = async (id: ConcreteModelId) => {
    const val = keyInputs[id].trim()
    if (!val) {
      toastFail('Paste a new key first.', 'ai-key-empty')
      return
    }
    setSavingKey(id)
    try {
      await updateAgentConfig({ [KEY_FIELD[id]]: val } as never)
      const [cfg, st] = await Promise.all([fetchAgentConfig(), fetchAgentStatus()])
      setSavedKeys({
        openrouter: cfg.openrouterKey ?? null,
        openai: cfg.openaiKey,
        gemini: cfg.geminiKey,
        claude: cfg.claudeKey,
        grok: cfg.grokKey,
        manus: cfg.manusKey,
      })
      setStatus(st)
      setKeyInputs((prev) => ({ ...prev, [id]: '' }))
      setAddingKey((prev) => ({ ...prev, [id]: false }))
      toastApiSaved(MODELS.find((m) => m.id === id)?.keyLabel ?? 'API key')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Key save failed', 'ai-key-save-err')
    } finally {
      setSavingKey(null)
    }
  }

  const handleTelegramTest = async () => {
    setTestingTelegram(true)
    try {
      const result = await testAgentTelegram({ message: 'SPLARO AI Command Bridge online. Telegram can now talk to AI agent.' })
      if (!result.ok || !result.delivered) {
        toastFail('Telegram bridge test failed — message not delivered', 'ai-tg-test-fail')
        return
      }
      toastOk(`Telegram bridge tested: ${result.chatId}`, 'ai-tg-test-ok')
      await reload()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Telegram bridge test failed', 'ai-tg-test-fail')
    } finally {
      setTestingTelegram(false)
    }
  }

  // Skeletons shaped like this screen's own blocks, not a bare spinner.
  if (loading) {
    return (
      <div className="ai-command ai-command-page ai-command-page--dc mx-auto max-w-6xl space-y-5 pb-28">
        <DcLoadingState
          blocks={[
            { t: 'kpis' } as DcBlock,
            { t: 'hero', w: 'main' } as DcBlock,
            { t: 'form', w: 'main' } as DcBlock,
            { t: 'table', w: 'main', title: '', cols: [], rows: [] } as DcBlock,
          ]}
        />
      </div>
    )
  }

  // The agent backend being unreachable is a hard error, not a "0%" KPI.
  if (apiOffline) {
    return (
      <div className="ai-command ai-command-page ai-command-page--dc mx-auto max-w-6xl space-y-5 pb-28">
        <DcErrorState
          error={`GET /agent/config, GET /agent/status → ${apiOffline}`}
          hint="Model keys, budget and run history all come from the agent API. Start it with `pnpm dev:api` locally, or check the API host is up."
          onRetry={() => {
            setLoading(true)
            void reload()
          }}
        />
      </div>
    )
  }

  const chatReady = !apiOffline && (status?.activeModelReady ?? false)
  const telegramReady = Boolean(status?.telegram.configured && status.telegram.isActive)
  const budget = status?.budget
  const budgetPct = Math.round((budget?.pct ?? 0) * 100)
  const budgetWarn = (budget?.pct ?? 0) >= 0.8
  const activeModelLabel = MODELS.find((m) => m.id === activeModel)?.label ?? activeModel

  // Never show a bare number where a decision belongs: name the one thing
  // standing between the operator and a working agent, and how to clear it.
  const decision: {
    tone: 'bad' | 'warn'
    title: string
    body: string
    action?: { label: string; onClick: () => void }
  } | null = (() => {
    if (budget && budget.pct >= 1) {
      return {
        tone: 'bad',
        title: `Daily AI budget spent — $${budget.spentUsd.toFixed(3)} of $${budget.limitUsd.toFixed(2)}`,
        body: 'Every chat and Telegram request is refused until the budget resets at midnight. Raise AGENT_DAILY_COST_LIMIT_USD on the API to keep going today, or switch the active model to a cheaper one.',
      }
    }
    if (!chatReady) {
      const label = MODELS.find((m) => m.id === activeModel)?.keyLabel ?? 'API key'
      const envHint = MODELS.find((m) => m.id === activeModel)?.envHint ?? ''
      const alternative = MODELS.find((m) => m.id !== activeModel && status?.models[m.id]?.configured)
      return {
        tone: 'bad',
        title: `${activeModelLabel} has no usable key — the agent cannot answer`,
        body: alternative
          ? `Ask SPLARO, the Telegram bridge and every automation using SEND_AI will fail. ${alternative.label} is already configured — switch to it, or add the ${label} below (env: ${envHint}).`
          : `Ask SPLARO, the Telegram bridge and every automation using SEND_AI will fail until you add the ${label} below (env: ${envHint}).`,
        ...(alternative
          ? { action: { label: `Switch to ${alternative.label}`, onClick: () => void handleSwitchModel(alternative.id) } }
          : {}),
      }
    }
    if (budgetWarn) {
      return {
        tone: 'warn',
        title: `AI budget ${budgetPct}% used — $${budget!.spentUsd.toFixed(3)} of $${budget!.limitUsd.toFixed(2)}`,
        body: 'Requests are still going through, but they will be refused outright at 100%. Consider switching the active model to a cheaper tier for the rest of today.',
      }
    }
    return null
  })()

  const activityCounts = {
    all: activity.length,
    completed: activity.filter((run) => run.status === 'completed').length,
    failed: activity.filter((run) => run.status === 'failed' || run.status === 'budget_refused').length,
  }
  const filteredActivity = activity.filter((run) => {
    if (activityFilter === 'completed') return run.status === 'completed'
    if (activityFilter === 'failed') return run.status === 'failed' || run.status === 'budget_refused'
    return true
  })
  const visibleActivity = filteredActivity.slice(0, activityShown)

  const tierTone: Record<string, DcTone> = { DANGEROUS: 'bad', WRITE: 'warn', READ: 'mute' }
  const runTone: Record<string, DcTone> = {
    completed: 'ok',
    failed: 'bad',
    budget_refused: 'warn',
    running: 'info',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 96 }}>
      <p style={{ margin: 0, font: `500 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }} role="note">
        Confirm-gated writes — nothing touches orders, stock, or payouts without one explicit apply click.
      </p>

      {decision ? (
        <section
          style={{
            display: 'flex',
            gap: 13,
            padding: '15px 16px',
            border: `1px solid var(--${decision.tone}-bd)`,
            borderRadius: 12,
            background: `var(--${decision.tone}-soft)`,
          }}
        >
          <span
            aria-hidden
            style={{ flex: 'none', width: 3, borderRadius: 99, background: `var(--${decision.tone})` }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, font: `700 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>{decision.title}</p>
            <p style={{ margin: '6px 0 0', font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-2)' }}>
              {decision.body}
            </p>
            {decision.action ? (
              <button type="button" style={{ ...dcBtn(true), marginTop: 12 }} onClick={decision.action.onClick}>
                {decision.action.label}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <BrainSection id="ai-status" icon="icon-activity" title="AI Status" hint="Model, API, Telegram, MCP and today’s budget.">
        <DcKpiStrip
          columns={4}
          items={[
            {
              label: 'Model',
              value: activeModelLabel,
              sub: chatReady ? 'ready' : 'needs setup',
              tone: chatReady ? 'success' : 'warning',
            },
            {
              label: 'API',
              value: apiOffline ? 'Offline' : 'Live',
              sub: apiOffline ?? 'agent backend reachable',
              tone: apiOffline ? 'danger' : 'success',
            },
            {
              label: 'Telegram',
              value: telegramReady ? 'Online' : 'Setup',
              sub: telegramReady ? 'bridge active' : tgData?.tokenConfigured ? 'chat ID লাগবে' : 'not linked',
              tone: telegramReady ? 'success' : 'warning',
            },
            {
              label: 'MCP',
              value: mcpOk == null ? '…' : mcpOk ? 'Online' : 'Offline',
              sub: mcpOk ? 'connector reachable' : 'probe /api/mcp/health',
              tone: mcpOk ? 'success' : mcpOk === false ? 'warning' : 'default',
            },
          ]}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 11, marginTop: 12 }}>
          <AgentChatLauncher online={chatReady} size="inline" />
          <p style={{ margin: 0, flex: 1, minWidth: 220, font: `400 12.5px/1.6 ${FONT}`, color: 'var(--ink-2)' }}>
            এখানে model + API key সেট করুন। Chat করবেন <strong style={{ color: 'var(--ink)' }}>CHAT</strong> বাটন
            দিয়ে — সেখানেই live brain (orders, finance, courier, SEO)।
          </p>
          <button type="button" style={dcBtn(true)} disabled={!chatReady} onClick={() => openAgentChat()}>
            Chat খুলুন
          </button>
        </div>

        {budget ? (
          <div
            style={{
              marginTop: 10,
              padding: '9px 11px',
              borderRadius: 10,
              border: `1px solid var(--${budgetWarn ? 'warn' : 'line'}${budgetWarn ? '-bd' : ''})`,
              background: budgetWarn ? 'var(--warn-soft)' : 'var(--surface-2)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
              <span style={dcCaps}>Today&apos;s AI budget</span>
              <span style={{ font: `700 11.5px/1 ${MONO}`, color: budgetWarn ? 'var(--warn)' : 'var(--ink)' }}>
                ${budget.spentUsd.toFixed(3)} / ${budget.limitUsd.toFixed(2)} · {budgetPct}%
              </span>
            </div>
            <div
              style={{
                marginTop: 7,
                height: 5,
                borderRadius: 99,
                background: 'var(--surface-3)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, budgetPct)}%`,
                  borderRadius: 99,
                  background: budgetWarn ? 'var(--warn)' : 'var(--ok)',
                }}
              />
            </div>
            {budgetWarn ? (
              <p style={{ margin: '8px 0 0', font: `600 10.5px/1.5 ${FONT}`, color: 'var(--warn)' }}>
                Soft warn — 80%+ used. Hard refuse at 100% (AGENT_DAILY_COST_LIMIT_USD).
              </p>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 11,
            marginTop: 10,
          }}
        >
          <p style={{ margin: 0, font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-2)' }}>
            {telegramReady
              ? 'Telegram থেকে same chatbot brain কাজ করে।'
              : 'Telegram Bot settings এ token + chat ID দিন।'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              style={dcBtn(false)}
              disabled={!telegramReady || testingTelegram}
              onClick={() => void handleTelegramTest()}
            >
              {testingTelegram ? 'Testing…' : 'Test'}
            </button>
            <Link href="/dashboard/telegram-bot" style={{ ...dcBtn(false), textDecoration: 'none' }}>
              Telegram Bot
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {AGENT_QUICK_COMMANDS.filter((c) => c.category === 'ops' || c.category === 'health')
            .slice(0, 8)
            .map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                disabled={!chatReady}
                onClick={() => openAgentChat(cmd.message)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 99,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: chatReady ? 'var(--ink-2)' : 'var(--ink-3)',
                  font: `600 11px/1 ${FONT}`,
                  cursor: chatReady ? 'pointer' : 'not-allowed',
                }}
              >
                {cmd.label}
              </button>
            ))}
        </div>

        {saveTarget.isLocal ? (
          <p
            style={{
              margin: '10px 0 0',
              padding: '9px 11px',
              borderRadius: 10,
              border: '1px solid var(--warn-bd)',
              background: 'var(--warn-soft)',
              font: `500 11.5px/1.6 ${FONT}`,
              color: 'var(--ink-2)',
            }}
          >
            Local admin → local database। <strong>Telegram bot production</strong> (api.splaro.co) use করে — একই API
            key{' '}
            <a
              href="https://admin.splaro.co/dashboard/ai-agent"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--ink)', textDecoration: 'underline' }}
            >
              admin.splaro.co
            </a>{' '}
            তে save করলে permanent হবে live bot-এর জন্য।
          </p>
        ) : null}
      </BrainSection>

      <BrainSection id="ai-models" icon="icon-cpu" title="Active Models" hint="Click a card to switch. Provider keys are in API Keys below.">
        <div
          style={{
            display: 'grid',
            gap: 7,
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          }}
        >
          {MODEL_OPTIONS.map((m) => {
            const configured = modelIsConfigured(m.id, status, savedKeys, claudeAuthMode, claudeBaseUrl)
            const isActive = activeModel === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => void handleSwitchModel(m.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '9px 11px',
                  borderRadius: 10,
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: `1px solid var(${isActive ? '--violet-bd' : '--line'})`,
                  background: isActive ? 'var(--violet-soft)' : 'var(--surface-2)',
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      font: `700 12px/1.3 ${FONT}`,
                      color: isActive ? 'var(--violet)' : 'var(--ink)',
                    }}
                  >
                    {m.label}
                  </span>
                  <span style={dcChip(configured ? 'ok' : 'warn')}>
                    {configured ? (m.id === 'auto' ? 'ready' : 'ready') : 'not saved'}
                  </span>
                </span>
                <DcIcon
                  name={configured ? 'icon-circle-check' : 'icon-circle-x'}
                  size={15}
                  color={configured ? 'var(--ok)' : 'var(--ink-3)'}
                />
              </button>
            )
          })}
        </div>

        {activeModel === 'openrouter' ? (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <label style={{ display: 'block' }}>
              <span style={dcCaps}>OpenRouter Model ID</span>
              <input
                value={openrouterModel}
                onChange={(e) => setOpenrouterModel(e.target.value)}
                placeholder="deepseek/deepseek-r1"
                style={dcInput}
              />
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {OPENROUTER_PRESETS.map((preset) => {
                const on = openrouterModel.trim() === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={`${preset.id} — ${preset.note}`}
                    onClick={() => setOpenrouterModel(preset.id)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 99,
                      cursor: 'pointer',
                      font: `600 11px/1 ${FONT}`,
                      border: `1px solid var(${on ? '--violet-bd' : '--line'})`,
                      background: on ? 'var(--violet-soft)' : 'var(--surface-2)',
                      color: on ? 'var(--violet)' : 'var(--ink-2)',
                    }}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
            <p style={{ margin: '6px 0 0', font: `400 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
              OpenRouter এ থাকা যেকোনো মডেলের আইডি এখানে দিতে পারবেন।
            </p>
          </div>
        ) : null}

        {activeModel === 'claude' ? (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <p style={{ ...dcCaps, margin: 0 }}>Claude connection</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
              {(
                [
                  ['api_key', 'API Key (direct)'],
                  ['antigravity_proxy', 'Antigravity / Proxy'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setClaudeAuthMode(mode)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    font: `700 11.5px/1 ${FONT}`,
                    border: `1px solid var(${claudeAuthMode === mode ? '--violet-bd' : '--line'})`,
                    background: claudeAuthMode === mode ? 'var(--violet-soft)' : 'var(--surface-2)',
                    color: claudeAuthMode === mode ? 'var(--violet)' : 'var(--ink-2)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {claudeAuthMode === 'antigravity_proxy' ? (
              <div style={{ display: 'grid', gap: 11, marginTop: 12 }}>
                <label style={{ display: 'block' }}>
                  <span style={dcCaps}>Proxy base URL</span>
                  <input
                    value={claudeBaseUrl}
                    onChange={(e) => setClaudeBaseUrl(e.target.value)}
                    placeholder="http://localhost:8080"
                    style={dcInput}
                  />
                </label>
                <label style={{ display: 'block' }}>
                  <span style={dcCaps}>
                    Auth token{' '}
                    {isMasked(savedClaudeAuthToken) ? (
                      <span style={{ color: 'var(--ok)' }}>· Saved</span>
                    ) : null}
                  </span>
                  <input
                    value={claudeAuthTokenInput}
                    onChange={(e) => setClaudeAuthTokenInput(e.target.value)}
                    placeholder={isMasked(savedClaudeAuthToken) ? '•••• — blank = keep' : 'test'}
                    style={dcInput}
                  />
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeModel === 'openai' && status?.models.openai?.configured ? (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <label style={{ display: 'block' }}>
              <span style={dcCaps}>OpenAI model</span>
              <select value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} style={dcInput}>
                {(aiIntegration?.supportedModels ?? ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo']).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </BrainSection>

      <BrainSection
        id="ai-keys"
        icon="icon-key"
        title="API Keys"
        hint="One row per provider. Saved keys stay hidden — replace or remove them here."
      >
        <div style={{ display: 'grid', gap: 2 }}>
          {MODELS.map((m) => {
            const saved = savedKeys[m.id]
            const hasSaved = isMasked(saved) || Boolean(saved)
            const editing = addingKey[m.id] || Boolean(keyInputs[m.id])
            return (
              <div
                key={m.id}
                id={`ai-key-${m.id}`}
                style={{
                  display: 'grid',
                  gap: 8,
                  padding: '9px 0',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                {/*
                 * One line at rest: label, state, action. The previous layout
                 * always rendered the input plus a full-width "Add key" bar for
                 * every provider, which is what made six rows fill the screen.
                 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...dcCaps, margin: 0, flex: 1, minWidth: 140 }}>{m.keyLabel}</span>

                  {hasSaved ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        color: 'var(--ok)',
                        font: `700 11px/1 ${FONT}`,
                      }}
                    >
                      <DcIcon name="icon-circle-check" size={13} color="var(--ok)" />
                      Saved
                    </span>
                  ) : (
                    <span style={dcChip('warn')}>not saved</span>
                  )}

                  {!editing ? (
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setAddingKey((prev) => ({ ...prev, [m.id]: true }))}
                        style={{ ...dcBtnSm(false), ...(hasSaved ? {} : keyAddTone) }}
                      >
                        {hasSaved ? 'Replace' : '+ Add key'}
                      </button>
                      {hasSaved ? (
                        <button
                          type="button"
                          onClick={() => setRemoveKeyTarget(m.id)}
                          disabled={removingKey === m.id}
                          style={{ ...dcBtnSm(false), color: 'var(--bad)', borderColor: 'var(--bad-bd, var(--line))' }}
                        >
                          {removingKey === m.id ? 'Removing…' : 'Remove'}
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </div>

                {editing ? (
                  <>
                    <span style={{ position: 'relative', display: 'block' }}>
                      <input
                        type={showKey[m.id] ? 'text' : 'password'}
                        value={keyInputs[m.id]}
                        onChange={(e) => setKeyInputs((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        placeholder={hasSaved ? 'Paste the new key — blank keeps the stored one' : m.placeholder}
                        autoComplete="new-password"
                        autoCorrect="off"
                        spellCheck={false}
                        data-1p-ignore="true"
                        data-lpignore="true"
                        data-form-type="other"
                        name={`ai-provider-key-${m.id}`}
                        style={{ ...dcInput, marginTop: 0, paddingRight: 38 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                        aria-label={showKey[m.id] ? 'Hide key' : 'Show key'}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          border: 0,
                          background: 'transparent',
                          color: 'var(--ink-3)',
                          cursor: 'pointer',
                          lineHeight: 0,
                        }}
                      >
                        <DcIcon name={showKey[m.id] ? 'icon-eye-off' : 'icon-eye'} size={14} />
                      </button>
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                      <span style={{ font: `500 10px/1.4 ${MONO}`, color: 'var(--ink-3)', flex: 1 }}>
                        Env: {m.envHint}
                      </span>
                      <button
                        type="button"
                        style={dcBtnSm(false)}
                        onClick={() => {
                          setAddingKey((prev) => ({ ...prev, [m.id]: false }))
                          setKeyInputs((prev) => ({ ...prev, [m.id]: '' }))
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        style={dcBtnSm(true)}
                        disabled={savingKey === m.id || !keyInputs[m.id].trim()}
                        onClick={() => void handleSaveKey(m.id)}
                      >
                        {savingKey === m.id ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </>
                ) : null}

                {m.id === 'manus' ? (
                  <span style={{ font: `400 10.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
                    Manus runs its own agent — it replies async and cannot read SPLARO orders or stock.
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </BrainSection>

      <BrainSection
        id="ai-instructions"
        icon="icon-file-text"
        title="System Instructions"
        hint="Saved with Save AI settings."
        collapsible
        defaultOpen={false}
        preview={
          <p
            style={{
              margin: 0,
              font: `400 12.5px/1.5 ${FONT}`,
              color: 'var(--ink-3)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {systemPrompt.trim() || 'No custom instructions yet — expand to edit.'}
          </p>
        }
      >
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are SPLARO Command..."
          rows={7}
          style={{ ...dcInput, marginTop: 0, minHeight: 140, resize: 'vertical', fontFamily: MONO }}
        />
      </BrainSection>

      <BrainSection
        id="ai-guardrails"
        icon="icon-shield"
        title="Guardrails & Tools"
        hint="Catalog only — DANGEROUS and WRITE price/publish/stock need Confirm. No fake on/off switches."
        collapsible
        defaultOpen={false}
      >
        {/*
          * Grouped by tier with one banded header per group. The flat table
          * repeated the same tier chip on every row, so the eye had to re-read
          * the risk level for each of ~30 tools instead of once per group.
          *
          * There are deliberately no on/off switches: nothing in the API can
          * disable a single tool. What actually protects the store is the
          * confirm gate, so that is what this table reports.
          */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {AGENT_TOOL_TIERS.map((tier) => (
            <span key={tier} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={dcChip(tierTone[tier] ?? 'mute')}>{tier}</span>
              <span style={{ font: `500 10.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                {tier === 'READ' ? 'runs directly' : 'needs an apply click'}
              </span>
            </span>
          ))}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', font: `400 12px/1.4 ${FONT}` }}>
            <thead>
              <tr>
                {['Tool', 'When it runs', 'Gate'].map((h) => (
                  <th key={h} style={dcTh}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AGENT_TOOL_TIERS.map((tier) => {
                const tools = AGENT_TOOL_CATALOG.filter((t) => t.tier === tier)
                if (tools.length === 0) return null
                return (
                  <Fragment key={tier}>
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          padding: '8px 12px',
                          background: 'var(--surface-2)',
                          borderBottom: '1px solid var(--line)',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span style={dcChip(tierTone[tier] ?? 'mute')}>{tier}</span>
                          <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                            {tools.length} tool{tools.length === 1 ? '' : 's'}
                          </span>
                        </span>
                      </td>
                    </tr>
                    {tools.map((tool) => (
                      <tr key={tool.name}>
                        <td style={{ ...dcTd, verticalAlign: 'middle' }}>
                          <span style={{ display: 'block', font: `700 12px/1.3 ${FONT}` }}>{tool.label}</span>
                          <span style={{ display: 'block', font: `500 10.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                            {tool.labelBn}
                          </span>
                        </td>
                        <td style={{ ...dcTd, verticalAlign: 'middle', color: 'var(--ink-2)' }}>{tool.when}</td>
                        <td style={{ ...dcTd, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <span style={dcChip(tier === 'READ' ? 'mute' : 'warn')}>
                            {tier === 'READ' ? 'direct' : 'confirm'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </BrainSection>

      <BrainSection
        id="mcp-link-token"
        icon="icon-key-round"
        title="MCP Link"
        hint="Private connector — paste this URL + token into ChatGPT or Claude to give it read access to this store."
        accent
      >
        <McpLinkTokenPanel embedded />
      </BrainSection>

      <BrainSection
        id="ai-activity"
        icon="icon-activity"
        title="Agent Activity"
        hint="Recent AI runs — filter and load more."
        collapsible
        defaultOpen={false}
        preview={
          <p style={{ margin: 0, font: `400 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
            {activity.length} run{activity.length === 1 ? '' : 's'}
            {activityCounts.failed > 0 ? ` · ${activityCounts.failed} failed` : ''} — expand to filter and page.
          </p>
        }
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
          {(['all', 'completed', 'failed'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setActivityFilter(f)
                setActivityShown(10)
              }}
              style={{
                padding: '6px 11px',
                borderRadius: 99,
                cursor: 'pointer',
                font: `700 11px/1 ${FONT}`,
                border: `1px solid var(${activityFilter === f ? '--violet-bd' : '--line'})`,
                background: activityFilter === f ? 'var(--violet-soft)' : 'var(--surface-2)',
                color: activityFilter === f ? 'var(--violet)' : 'var(--ink-2)',
                textTransform: 'capitalize',
              }}
            >
              {f} · {activityCounts[f]}
            </button>
          ))}
        </div>

        {activityLoading ? (
          <p style={{ margin: 0, font: `500 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>Loading activity…</p>
        ) : filteredActivity.length === 0 ? (
          <p style={{ margin: 0, font: `500 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
            No agent runs yet — open CHAT and ask something to see runs here.
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', font: `400 12px/1.4 ${FONT}` }}>
                <thead>
                  <tr>
                    {['Time', 'Status', 'Model', 'Tools', 'Cost', 'Message'].map((h) => (
                      <th key={h} style={dcTh}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleActivity.map((run) => (
                    <tr key={run.id}>
                      <td style={{ ...dcTd, whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 10.5 }}>
                        {new Date(run.startedAt).toLocaleString('en-BD', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td style={dcTd}>
                        <span style={dcChip(runTone[run.status] ?? 'mute')}>{run.status}</span>
                      </td>
                      <td style={{ ...dcTd, fontFamily: MONO, fontSize: 10.5 }}>{run.model}</td>
                      <td style={dcTd}>
                        {run.toolCalls.length === 0 ? (
                          <span style={{ color: 'var(--ink-3)' }}>—</span>
                        ) : (
                          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {run.toolCalls.map((tc) => (
                              <span key={tc.id} title={tc.resultSummary} style={dcChip(tierTone[tc.tier] ?? 'mute')}>
                                {tc.toolName.replace(/_/g, ' ')}
                                {tc.confirmed ? ' ✓' : ''}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td style={{ ...dcTd, fontFamily: MONO, fontSize: 10.5 }}>
                        ${run.costEstUsd < 0.01 ? run.costEstUsd.toFixed(4) : run.costEstUsd.toFixed(3)}
                      </td>
                      <td
                        style={{ ...dcTd, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}
                        title={run.userMessage}
                      >
                        {run.userMessage}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 10,
                marginTop: 12,
              }}
            >
              <span style={{ font: `500 11px/1.4 ${FONT}`, color: 'var(--ink-3)', flex: 1, minWidth: 120 }}>
                Showing {visibleActivity.length} of {filteredActivity.length}
              </span>
              {activityShown < filteredActivity.length ? (
                <button
                  type="button"
                  style={dcBtnSm(false)}
                  onClick={() => setActivityShown((n) => n + 10)}
                >
                  Load more
                </button>
              ) : null}
            </div>
          </>
        )}
      </BrainSection>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 5,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          borderRadius: 12,
          border: '1px solid var(--line-2)',
          background: 'var(--surface)',
          backgroundImage: 'var(--card-sheen)',
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', font: `700 12px/1.3 ${FONT}`, color: 'var(--ink)' }}>
            {activeModelLabel} · {saveTarget.label}
          </span>
          <span style={{ display: 'block', font: `500 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
            {chatReady ? 'Ready for chat + Telegram' : 'Save API key for active model first'}
          </span>
        </span>
        <button type="button" style={dcBtn(true)} disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save AI settings'}
        </button>
      </div>

      <DcModal
        open={removeKeyTarget !== null}
        title={`Remove ${MODELS.find((m) => m.id === removeKeyTarget)?.keyLabel ?? 'API key'}?`}
        subtitle="The stored key is deleted from this store. Chat and Telegram stop using this provider until a new key is saved."
        confirmLabel="Remove key"
        danger
        busy={removingKey !== null}
        busyLabel="Removing…"
        onClose={() => setRemoveKeyTarget(null)}
        onConfirm={() => {
          if (removeKeyTarget) void handleRemoveKey(removeKeyTarget)
        }}
      >
        <p style={{ margin: 0, font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-3)' }}>
          If the same key is also set in the server environment
          {removeKeyTarget ? ` (${MODELS.find((m) => m.id === removeKeyTarget)?.envHint})` : ''}, the provider keeps
          working from that value — you will be told when that happens.
        </p>
      </DcModal>
    </div>
  )
}

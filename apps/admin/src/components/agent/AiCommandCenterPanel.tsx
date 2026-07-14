'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toastOk, toastFail, toastApiSaved, toastWarn } from '@/lib/admin/feedback'
import {
  Bot,
  Activity,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MessageSquare,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  WifiOff,
  Workflow,
  XCircle,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AgentChatLauncher } from '@/components/agent/AgentChatLauncher'
import { AGENT_TOOL_CATALOG, AGENT_TOOL_TIERS } from '@/lib/agent/tool-catalog'
import { AGENT_QUICK_COMMANDS } from '@/lib/agent/quick-commands'
import {
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
import { cn } from '@/lib/utils/cn'

const MODELS: { id: AgentModelId; label: string; keyLabel: string; placeholder: string; envHint: string }[] = [
  { id: 'claude', label: 'Claude (Anthropic)', keyLabel: 'Anthropic API Key', placeholder: 'sk-ant-...', envHint: 'ANTHROPIC_API_KEY' },
  { id: 'openai', label: 'OpenAI (GPT)', keyLabel: 'OpenAI API Key', placeholder: 'sk-...', envHint: 'OPENAI_API_KEY' },
  { id: 'gemini', label: 'Gemini (Google)', keyLabel: 'Gemini API Key', placeholder: 'AIza...', envHint: 'GEMINI_API_KEY' },
  { id: 'grok', label: 'Grok (xAI)', keyLabel: 'Grok API Key', placeholder: 'xai-...', envHint: 'GROK_API_KEY' },
]

const KEY_FIELD: Record<AgentModelId, 'claudeKey' | 'openaiKey' | 'geminiKey' | 'grokKey'> = {
  claude: 'claudeKey',
  openai: 'openaiKey',
  gemini: 'geminiKey',
  grok: 'grokKey',
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
  savedKeys: Record<AgentModelId, string | null>,
  claudeAuthMode: 'api_key' | 'antigravity_proxy',
  claudeBaseUrl: string,
): boolean {
  if (status?.models[id]?.configured) return true
  if (id === 'claude' && claudeAuthMode === 'antigravity_proxy' && claudeBaseUrl.trim()) return true
  return isMasked(savedKeys[id]) || Boolean(savedKeys[id])
}

function activeModelHasKey(
  model: AgentModelId,
  keyInputs: Record<AgentModelId, string>,
  savedKeys: Record<AgentModelId, string | null>,
  claudeAuthMode: 'api_key' | 'antigravity_proxy',
  claudeBaseUrl: string,
): boolean {
  if (model === 'claude' && claudeAuthMode === 'antigravity_proxy' && claudeBaseUrl.trim()) return true
  return Boolean(keyInputs[model].trim() || isMasked(savedKeys[model]) || savedKeys[model])
}

export function AiCommandCenterPanel() {
  const openAgentChat = useAdminUiStore((s) => s.openAgentChat)
  const { data: tgData } = useTelegramIntegration()
  const { data: aiIntegration } = useAiIntegration()
  const updateAiIntegration = useUpdateAiIntegration()

  const [status, setStatus] = useState<AgentStatusResponse | null>(null)
  const [activeModel, setActiveModel] = useState<AgentModelId>('claude')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [keyInputs, setKeyInputs] = useState<Record<AgentModelId, string>>({
    claude: '', openai: '', gemini: '', grok: '',
  })
  const [savedKeys, setSavedKeys] = useState<Record<AgentModelId, string | null>>({
    claude: null, openai: null, gemini: null, grok: null,
  })
  const [showKey, setShowKey] = useState<Record<AgentModelId, boolean>>({
    claude: false, openai: false, gemini: false, grok: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [apiOffline, setApiOffline] = useState<string | null>(null)
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini')
  const [claudeAuthMode, setClaudeAuthMode] = useState<'api_key' | 'antigravity_proxy'>('api_key')
  const [claudeBaseUrl, setClaudeBaseUrl] = useState('http://localhost:8080')
  const [claudeAuthTokenInput, setClaudeAuthTokenInput] = useState('')
  const [savedClaudeAuthToken, setSavedClaudeAuthToken] = useState<string | null>(null)
  const [activity, setActivity] = useState<AgentActivityRun[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  const reload = async () => {
    try {
      const [cfg, st] = await Promise.all([fetchAgentConfig(), fetchAgentStatus()])
      setActiveModel((cfg.activeModel as AgentModelId) || 'claude')
      setSystemPrompt(cfg.systemPrompt ?? '')
      setSavedKeys({
        claude: cfg.claudeKey,
        openai: cfg.openaiKey,
        gemini: cfg.geminiKey,
        grok: cfg.grokKey,
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

  const loadActivity = async () => {
    setActivityLoading(true)
    try {
      const rows = await fetchAgentActivity(undefined, 50)
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
      }
      if (claudeAuthTokenInput.trim()) body.claudeAuthToken = claudeAuthTokenInput.trim()
      for (const m of MODELS) {
        const val = keyInputs[m.id].trim()
        if (val) body[KEY_FIELD[m.id]] = val
      }

      const hasClaudeProxy = claudeAuthMode === 'antigravity_proxy' && Boolean(claudeBaseUrl.trim())
      const hasAnyKey =
        hasClaudeProxy ||
        MODELS.some((m) => keyInputs[m.id].trim() || isMasked(savedKeys[m.id]))
      if (!hasAnyKey) {
        toastFail('Add at least one API key or Antigravity proxy URL.', 'ai-no-key')
        return
      }

      if (!activeModelHasKey(activeModel, keyInputs, savedKeys, claudeAuthMode, claudeBaseUrl)) {
        toastFail(
          `Active model (${MODELS.find((m) => m.id === activeModel)?.label}) এর API key দিন — save হবে না।`,
          'ai-active-no-key',
        )
        return
      }

      await updateAgentConfig(body as never)
      if (activeModel === 'openai' && openaiModel) {
        await updateAiIntegration.mutateAsync({ defaultModel: openaiModel })
      }
      setKeyInputs({ claude: '', openai: '', gemini: '', grok: '' })
      setClaudeAuthTokenInput('')
      const [cfg, st] = await Promise.all([fetchAgentConfig(), fetchAgentStatus()])
      setActiveModel((cfg.activeModel as AgentModelId) || 'claude')
      setSystemPrompt(cfg.systemPrompt ?? '')
      setSavedKeys({
        claude: cfg.claudeKey,
        openai: cfg.openaiKey,
        gemini: cfg.geminiKey,
        grok: cfg.grokKey,
      })
      setClaudeAuthMode(cfg.claudeAuthMode === 'antigravity_proxy' ? 'antigravity_proxy' : 'api_key')
      setClaudeBaseUrl(cfg.claudeBaseUrl || 'http://localhost:8080')
      setSavedClaudeAuthToken(cfg.claudeAuthToken ?? null)
      setStatus(st)
      setApiOffline(null)

      if (cfg.activeModel !== activeModel) {
        toastFail('Active model did not persist on server.', 'ai-verify-model')
        return
      }
      if (String(cfg.systemPrompt ?? '') !== String(systemPrompt ?? '')) {
        toastFail('System prompt did not persist on server.', 'ai-verify-prompt')
        return
      }
      if (claudeAuthMode === 'antigravity_proxy') {
        if (String(cfg.claudeBaseUrl ?? '') !== claudeBaseUrl.trim()) {
          toastFail('Claude proxy URL did not persist on server.', 'ai-verify-proxy')
          return
        }
      }
      if (!st.activeModelReady) {
        toastFail('Server saved but active model is not ready — API key missing or invalid.', 'ai-verify-ready')
        return
      }
      const target = resolveSaveTargetLabel()
      toastApiSaved(`AI settings (${target.label})`)
      if (target.isLocal) {
        toastWarn(
          'Local DB saved — Telegram bot এখনও production use করে। Live bot-এর জন্য admin.splaro.co তে same key save করুন।',
          'ai-local-telegram-warn',
        )
      }
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Save failed', 'ai-save-fail')
    } finally {
      setSaving(false)
    }
  }

  const handleSwitchModel = async (model: AgentModelId) => {
    if (!status?.models[model]?.configured) {
      toastFail(`Save ${MODELS.find((m) => m.id === model)?.keyLabel} first`, 'ai-switch-fail')
      return
    }
    try {
      await switchAgentModel(model)
      const [cfg, st] = await Promise.all([fetchAgentConfig(), fetchAgentStatus()])
      if (cfg.activeModel !== model || !st.activeModelReady) {
        toastFail('Model switch did not persist on server.', 'ai-switch-verify')
        await reload()
        return
      }
      setActiveModel(model)
      setStatus(st)
      toastOk(`Active model → ${MODELS.find((m) => m.id === model)?.label}`, 'ai-switch-ok')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Switch failed', 'ai-switch-err')
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

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#5E7CFF]" />
      </div>
    )
  }

  const chatReady = !apiOffline && (status?.activeModelReady ?? false)
  const telegramReady = Boolean(status?.telegram.configured && status.telegram.isActive)
  const saveTarget = resolveSaveTargetLabel()
  const budget = status?.budget
  const budgetPct = Math.round((budget?.pct ?? 0) * 100)
  const budgetWarn = (budget?.pct ?? 0) >= 0.8

  return (
    <div className="ai-command ai-command-page mx-auto max-w-6xl space-y-5 pb-28">
      <section className="ai-command-hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <AgentChatLauncher online={chatReady} size="inline" />
            <div>
              <p className="ai-command-eyebrow">AI Center</p>
              <h1 className="ai-command-title">AI Command Brain</h1>
              <p className="ai-command-sub mt-1 max-w-xl">
                এখানে model + API key সেট করুন। Chat করবেন নিচের ডান পাশের <strong>CHAT</strong> বাটন দিয়ে — সেখানেই live brain (orders, finance, courier, SEO)।
              </p>
            </div>
          </div>
          <AdminButton variant="gold" className="shrink-0" disabled={!chatReady} onClick={() => openAgentChat()}>
            <MessageSquare className="h-4 w-4" />
            Chat খুলুন
          </AdminButton>
        </div>

        {budget ? (
          <div
            className={cn(
              'mt-4 rounded-xl border px-3 py-2.5',
              budgetWarn
                ? 'border-amber-300/60 bg-amber-50/90 dark:border-amber-800/40 dark:bg-amber-950/30'
                : 'border-[rgba(17,17,17,0.08)] bg-white/50 dark:bg-white/5',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-[var(--admin-text-muted)]">
                Today&apos;s AI budget
              </p>
              <p
                className={cn(
                  'font-mono text-[11px] font-bold',
                  budgetWarn ? 'text-amber-900 dark:text-amber-200' : 'text-[var(--admin-text)]',
                )}
              >
                ${budget.spentUsd.toFixed(3)} / ${budget.limitUsd.toFixed(2)} · {budgetPct}%
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className={cn('h-full rounded-full transition-all', budgetWarn ? 'bg-amber-500' : 'bg-[#5E7CFF]')}
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
            {budgetWarn ? (
              <p className="mt-1.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                Soft warn — 80%+ used. Hard refuse at 100% (AGENT_DAILY_COST_LIMIT_USD).
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {apiOffline ? (
            <span className="ai-command-pill ai-command-pill--warn">
              <WifiOff className="h-3 w-3" /> {apiOffline}
            </span>
          ) : (
            <span className="ai-command-pill ai-command-pill--ok">
              <CheckCircle2 className="h-3 w-3" /> API live
            </span>
          )}
          {chatReady ? (
            <span className="ai-command-pill ai-command-pill--ok">
              {MODELS.find((m) => m.id === activeModel)?.label} ready
            </span>
          ) : (
            <span className="ai-command-pill ai-command-pill--warn">নিচে API key দিন</span>
          )}
          <span className={cn('ai-command-pill', telegramReady ? 'ai-command-pill--ok' : 'ai-command-pill--warn')}>
            Telegram {telegramReady ? 'online' : tgData?.tokenConfigured ? 'chat ID লাগবে' : 'connect করুন'}
          </span>
          <span className={cn('ai-command-pill', saveTarget.isLocal ? 'ai-command-pill--warn' : 'ai-command-pill--ok')}>
            Save target: {saveTarget.label}
          </span>
        </div>
        {saveTarget.isLocal ? (
          <p className="mt-3 rounded-xl border border-amber-300/50 bg-amber-50/80 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            Local admin → local database। <strong>Telegram bot production</strong> (api.splaro.co) use করে — একই API key{' '}
            <a href="https://admin.splaro.co/dashboard/ai-agent" className="underline" target="_blank" rel="noreferrer">
              admin.splaro.co
            </a>{' '}
            তে save করলে permanent হবে live bot-এর জন্য।
          </p>
        ) : null}
      </section>

      <section className="ai-command-card">
        <div className="ai-command-card__head">
          <Sparkles className="h-4 w-4 text-[#5E7CFF]" />
          <h2>Ops quick commands</h2>
        </div>
        <p className="ai-command-hint mt-2">Chat-এ seed করে — Banglish chips for daily ops.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {AGENT_QUICK_COMMANDS.filter((c) => c.category === 'ops' || c.category === 'health')
            .slice(0, 8)
            .map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                disabled={!chatReady}
                onClick={() => openAgentChat(cmd.message)}
                className="ai-command-quick__chip"
              >
                {cmd.label}
              </button>
            ))}
        </div>
      </section>

      <section className="ai-command-card">
        <div className="ai-command-card__head">
          <ShieldCheck className="h-4 w-4 text-[#5E7CFF]" />
          <h2>Tool catalog</h2>
        </div>
        <p className="ai-command-hint mt-2">
          Live tools by tier — DANGEROUS needs Confirm. WRITE price/publish/stock also confirms.
        </p>
        <div className="mt-3 space-y-4">
          {AGENT_TOOL_TIERS.map((tier) => {
            const tools = AGENT_TOOL_CATALOG.filter((t) => t.tier === tier)
            return (
              <div key={tier}>
                <p
                  className={cn(
                    'mb-2 text-[10px] font-black uppercase tracking-[0.14em]',
                    tier === 'DANGEROUS' && 'text-red-700',
                    tier === 'WRITE' && 'text-amber-800',
                    tier === 'READ' && 'text-[var(--admin-text-muted)]',
                  )}
                >
                  {tier}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="rounded-xl border border-[rgba(17,17,17,0.06)] bg-white/40 px-3 py-2 dark:bg-white/5"
                    >
                      <p className="text-[12px] font-bold text-[var(--admin-text)]">
                        {tool.label}{' '}
                        <span className="font-medium text-[var(--admin-text-muted)]">· {tool.labelBn}</span>
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] text-[var(--admin-text-muted)]">{tool.name}</p>
                      <p className="mt-1 text-[10px] font-semibold text-[var(--admin-text-secondary)]">{tool.when}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <section className="ai-command-card ai-command-card--control">
            <div className="ai-command-card__head">
              <Bot className="h-4 w-4 text-[#5E7CFF]" />
              <h2>Active model</h2>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {MODELS.map((m) => {
                const configured = modelIsConfigured(m.id, status, savedKeys, claudeAuthMode, claudeBaseUrl)
                const isActive = activeModel === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => void handleSwitchModel(m.id)}
                    className={cn('ai-command-model', isActive && 'ai-command-model--active')}
                  >
                    <div>
                      <p className="ai-command-model__name">{m.label}</p>
                      <p className="ai-command-model__vendor">{configured ? 'Key saved' : `Needs ${m.envHint}`}</p>
                    </div>
                    {configured ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-[#ccc]" />
                    )}
                  </button>
                )
              })}
            </div>
            {activeModel === 'claude' && (
              <div className="mt-4 space-y-3 border-t border-[rgba(17,17,17,0.08)] pt-4">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6B6B6B]">Claude connection</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['api_key', 'API Key (direct)'],
                    ['antigravity_proxy', 'Antigravity / Proxy'],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setClaudeAuthMode(mode)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs font-bold',
                        claudeAuthMode === mode
                          ? 'border-[#5E7CFF] bg-[#5E7CFF]/10 text-[#111]'
                          : 'border-[rgba(17,17,17,0.12)] text-[#6B6B6B]',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {claudeAuthMode === 'antigravity_proxy' ? (
                  <>
                    <label className="admin-field block">
                      <span className="admin-kpi__label">Proxy base URL</span>
                      <input
                        value={claudeBaseUrl}
                        onChange={(e) => setClaudeBaseUrl(e.target.value)}
                        placeholder="http://localhost:8080"
                        className="admin-input w-full font-mono text-sm"
                      />
                    </label>
                    <label className="admin-field block">
                      <span className="admin-kpi__label">
                        Auth token {isMasked(savedClaudeAuthToken) ? <span className="text-emerald-700">Saved</span> : null}
                      </span>
                      <input
                        value={claudeAuthTokenInput}
                        onChange={(e) => setClaudeAuthTokenInput(e.target.value)}
                        placeholder={isMasked(savedClaudeAuthToken) ? '•••• — blank = keep' : 'test'}
                        className="admin-input w-full font-mono text-sm"
                      />
                    </label>
                  </>
                ) : null}
              </div>
            )}
            {activeModel === 'openai' && status?.models.openai?.configured ? (
              <div className="mt-4 border-t border-[rgba(17,17,17,0.08)] pt-4">
                <label className="admin-field block">
                  <span className="admin-kpi__label">OpenAI model</span>
                  <select
                    value={openaiModel}
                    onChange={(e) => setOpenaiModel(e.target.value)}
                    className="admin-input w-full font-mono text-sm"
                  >
                    {(aiIntegration?.supportedModels ?? ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </section>

          <section className="ai-command-card">
            <div className="ai-command-card__head">
              <ShieldCheck className="h-4 w-4 text-[#5E7CFF]" />
              <h2>Chatbot brain (live tools)</h2>
            </div>
            <p className="ai-command-hint mt-2">
              Floating CHAT এ agent এগুলো করতে পারে — fake data নয়, API tool দিয়ে:
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ['Orders & courier', 'list, status, Steadfast book'],
                ['Partner finance', 'balance, withdrawal pending'],
                ['Catalog & SEO', 'stock, meta fix batch'],
                ['Diagnostics', 'health, integration, API routes'],
              ].map(([label, desc]) => (
                <div key={label} className="ai-command-duty">
                  <Activity className="h-3.5 w-3.5" />
                  <div>
                    <p>{label}</p>
                    <span>{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="ai-command-card">
            <div className="ai-command-card__head">
              <KeyRound className="h-4 w-4 text-[#5E7CFF]" />
              <h2>API keys</h2>
            </div>
            <div className="mt-3 space-y-3">
              {MODELS.map((m) => {
                const saved = savedKeys[m.id]
                const hasSaved = isMasked(saved) || Boolean(saved)
                return (
                  <label key={m.id} className="admin-field block">
                    <span className="admin-kpi__label">
                      {m.keyLabel}
                      {hasSaved ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                          Saved
                        </span>
                      ) : null}
                    </span>
                    <div className="relative">
                      <input
                        type={showKey[m.id] ? 'text' : 'password'}
                        value={keyInputs[m.id]}
                        onChange={(e) => setKeyInputs((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        placeholder={hasSaved ? 'Saved — leave blank to keep' : m.placeholder}
                        className="admin-input w-full pr-10 font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9B9B]"
                      >
                        {showKey[m.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-[#9B9B9B]">Env: <code>{m.envHint}</code></p>
                  </label>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      <section className="ai-command-card">
        <div className="ai-command-card__head">
          <Sparkles className="h-4 w-4 text-[#5E7CFF]" />
          <h2>System instructions</h2>
        </div>
        <textarea
          className="admin-input mt-3 min-h-[140px] font-mono text-sm"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are SPLARO Command..."
        />
      </section>

      <section className="ai-command-card">
        <div className="ai-command-card__head">
          <Workflow className="h-4 w-4 text-[#5E7CFF]" />
          <h2>Telegram bridge</h2>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-[var(--admin-text-secondary)]">
            {telegramReady ? 'Telegram থেকে same chatbot brain কাজ করে।' : 'Telegram Bot settings এ token + chat ID দিন।'}
          </p>
          <div className="flex flex-wrap gap-2">
            <AdminButton loading={testingTelegram} disabled={!telegramReady} onClick={() => void handleTelegramTest()}>
              <Send className="h-4 w-4" />
              Test
            </AdminButton>
            <Link href="/dashboard/settings?section=notifications#telegram" className="admin-btn px-4 py-2 text-xs font-black">
              Telegram Bot <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="ai-command-card">
        <div className="ai-command-card__head">
          <Activity className="h-4 w-4 text-[#5E7CFF]" />
          <h2>Agent activity</h2>
        </div>
        <p className="ai-command-hint mt-2">
          Recent AI runs, tool calls, tiers, and estimated cost — last 50 sessions.
        </p>
        {activityLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading activity…
          </div>
        ) : activity.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--admin-text-muted)]">No agent runs yet — use floating CHAT to start.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="admin-module-table w-full text-left text-xs">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Model</th>
                  <th>Tools</th>
                  <th>Cost</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((run) => (
                  <tr key={run.id} className="admin-table-row">
                    <td className="whitespace-nowrap font-mono text-[10px]">
                      {new Date(run.startedAt).toLocaleString('en-BD', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                    </td>
                    <td>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[9px] font-black uppercase',
                          run.status === 'completed' && 'bg-emerald-100 text-emerald-800',
                          run.status === 'failed' && 'bg-red-100 text-red-800',
                          run.status === 'budget_refused' && 'bg-amber-100 text-amber-800',
                          run.status === 'running' && 'bg-blue-100 text-blue-800',
                        )}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="font-mono text-[10px]">{run.model}</td>
                    <td>
                      {run.toolCalls.length === 0 ? (
                        <span className="text-[var(--admin-text-muted)]">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {run.toolCalls.map((tc) => (
                            <span
                              key={tc.id}
                              title={tc.resultSummary}
                              className={cn(
                                'rounded px-1.5 py-0.5 font-mono text-[9px] font-bold',
                                tc.tier === 'DANGEROUS' && 'bg-red-100 text-red-800',
                                tc.tier === 'WRITE' && 'bg-amber-100 text-amber-900',
                                tc.tier === 'READ' && 'bg-slate-100 text-slate-700',
                              )}
                            >
                              {tc.toolName.replace(/_/g, ' ')}
                              {tc.confirmed ? ' ✓' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="font-mono text-[10px]">
                      ${run.costEstUsd < 0.01 ? run.costEstUsd.toFixed(4) : run.costEstUsd.toFixed(3)}
                    </td>
                    <td className="max-w-[200px] truncate text-[10px] text-[var(--admin-text-secondary)]" title={run.userMessage}>
                      {run.userMessage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="ai-command-save-bar">
        <div className="ai-command-save-bar__meta">
          <p className="text-[11px] font-black text-[var(--admin-text)]">
            {MODELS.find((m) => m.id === activeModel)?.label ?? 'Model'} · {saveTarget.label}
          </p>
          <p className="text-[10px] font-medium text-[var(--admin-text-muted)]">
            {chatReady ? 'Ready for chat + Telegram' : 'Save API key for active model first'}
          </p>
        </div>
        <AdminButton variant="gold" loading={saving} onClick={() => void handleSave()}>
          <Save className="h-4 w-4" />
          Save AI settings
        </AdminButton>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toastOk, toastFail } from '@/lib/admin/feedback'
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
import {
  fetchAgentConfig,
  fetchAgentStatus,
  updateAgentConfig,
  switchAgentModel,
  testAgentTelegram,
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

      await updateAgentConfig(body as never)
      if (activeModel === 'openai' && openaiModel) {
        await updateAiIntegration.mutateAsync({ defaultModel: openaiModel })
      }
      setKeyInputs({ claude: '', openai: '', gemini: '', grok: '' })
      setClaudeAuthTokenInput('')
      await reload()
      toastOk('AI settings saved.', 'ai-save-ok')
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
      setActiveModel(model)
      await reload()
      toastOk(`Active model → ${MODELS.find((m) => m.id === model)?.label}`, 'ai-switch-ok')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Switch failed', 'ai-switch-err')
    }
  }

  const handleTelegramTest = async () => {
    setTestingTelegram(true)
    try {
      const result = await testAgentTelegram({ message: 'SPLARO AI Command Bridge online. Telegram can now talk to AI agent.' })
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
  const configuredModels = MODELS.filter((m) => status?.models[m.id]?.configured).length

  return (
    <div className="ai-command mx-auto max-w-6xl space-y-5 pb-8">
      <section className="ai-command-hero">
        <div className="flex items-start gap-4">
          <AgentChatLauncher online={chatReady} size="inline" />
          <div className="min-w-0 flex-1">
            <p className="ai-command-eyebrow">AI Center</p>
            <h1 className="ai-command-title">AI Command Brain</h1>
            <p className="ai-command-sub">Admin command agent for store health, orders, catalog, SEO, sales, automation, and Telegram control.</p>
          </div>
          <AdminButton variant="gold" className="shrink-0" disabled={!chatReady} onClick={() => openAgentChat()}>
            <MessageSquare className="h-4 w-4" />
            Open chat
          </AdminButton>
        </div>
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
            <span className="ai-command-pill ai-command-pill--warn">Add API key below</span>
          )}
          <span className={cn('ai-command-pill', telegramReady ? 'ai-command-pill--ok' : 'ai-command-pill--warn')}>
            Telegram {telegramReady ? 'bridge online' : tgData?.tokenConfigured ? 'saved — enable/chat ID needed' : 'connect in Telegram Bot'}
          </span>
        </div>
        <div className="ai-command-radar mt-5">
          {[
            ['Models ready', `${configuredModels}/${MODELS.length}`, configuredModels > 0],
            ['Admin tools', 'Orders · catalog · finance', true],
            ['Telegram control', telegramReady ? 'Live' : 'Waiting', telegramReady],
            ['Database memory', apiOffline ? 'Offline' : 'Ready', !apiOffline],
          ].map(([label, value, ok]) => (
            <div key={label as string} className="ai-command-radar__node">
              <span className={cn('ai-command-radar__dot', ok ? 'ai-command-radar__dot--ok' : 'ai-command-radar__dot--warn')} />
              <p>{label}</p>
              <strong>{value}</strong>
            </div>
          ))}
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
                const configured = status?.models[m.id]?.configured ?? false
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
              <div className="mt-4 border-t border-[rgba(17,17,17,0.08)] pt-4 space-y-3">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6B6B6B]">Claude connection</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['api_key', 'API Key (direct)'],
                    ['antigravity_proxy', 'Antigravity / Proxy (Google login)'],
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
                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#9B9B9B]">Proxy base URL</span>
                      <input
                        value={claudeBaseUrl}
                        onChange={(e) => setClaudeBaseUrl(e.target.value)}
                        placeholder="http://localhost:8080"
                        className="admin-input w-full font-mono text-sm"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#9B9B9B]">
                        Auth token {isMasked(savedClaudeAuthToken) && <span className="text-emerald-700">Saved</span>}
                      </span>
                      <input
                        value={claudeAuthTokenInput}
                        onChange={(e) => setClaudeAuthTokenInput(e.target.value)}
                        placeholder={isMasked(savedClaudeAuthToken) ? '•••• — leave blank to keep (default: test)' : 'test'}
                        className="admin-input w-full font-mono text-sm"
                      />
                    </label>
                    <p className="text-[10px] text-[#9B9B9B]">
                      1. Run <code>npx antigravity-claude-proxy</code> → 2. Open localhost:8080 → 3. Add Google account (Antigravity login) → 4. Save here.
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] text-[#9B9B9B]">Use Anthropic API key below, or switch to Antigravity proxy for Google account access.</p>
                )}
              </div>
            )}
            {activeModel === 'openai' && status?.models.openai?.configured && (
              <div className="mt-4 border-t border-[rgba(17,17,17,0.08)] pt-4">
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6B6B6B]">
                    OpenAI model
                  </span>
                  <select
                    value={openaiModel}
                    onChange={(e) => setOpenaiModel(e.target.value)}
                    className="admin-input w-full font-mono text-sm"
                  >
                    {(aiIntegration?.supportedModels ?? [
                      'gpt-4o-mini',
                      'gpt-4o',
                      'gpt-4-turbo',
                      'gpt-4',
                      'gpt-3.5-turbo',
                    ]).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#9B9B9B]">
                    If your project lacks access to a model, SPLARO auto-falls back to the next available one.
                  </p>
                </label>
              </div>
            )}
          </section>

          <section className="ai-command-card">
            <div className="ai-command-card__head">
              <ShieldCheck className="h-4 w-4 text-[#5E7CFF]" />
              <h2>Agent responsibility</h2>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ['Commerce watch', 'orders, customers, returns'],
                ['Catalog work', 'products, SEO, content gaps'],
                ['Automation control', 'rules, sheets, alerts'],
                ['Telegram command', 'authorized manager chat'],
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
                  <label key={m.id} className="block space-y-1.5">
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6B6B6B]">
                      {m.keyLabel}
                      {hasSaved && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                          Saved
                        </span>
                      )}
                    </span>
                    <div className="relative">
                      <input
                        type={showKey[m.id] ? 'text' : 'password'}
                        value={keyInputs[m.id]}
                        onChange={(e) => setKeyInputs((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        placeholder={hasSaved ? `${saved ?? '••••'} — leave blank to keep` : m.placeholder}
                        className="w-full rounded-xl border border-[rgba(17,17,17,0.12)] bg-[#f9f8f6] px-4 py-3 pr-10 font-mono text-sm font-semibold outline-none focus:border-[#5E7CFF] focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9B9B]"
                      >
                        {showKey[m.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-[#9B9B9B]">Env fallback: <code>{m.envHint}</code></p>
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
          className="admin-input mt-3 min-h-[160px] font-mono text-sm"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are SPLARO AI, an expert e-commerce assistant..."
        />
      </section>

      <section className="ai-command-card">
        <div className="ai-command-card__head">
          <Workflow className="h-4 w-4 text-[#5E7CFF]" />
          <h2>Telegram command bridge</h2>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div className="ai-command-telegram-bridge">
            <Send className="h-4 w-4" />
            <div>
              <p>{telegramReady ? 'Telegram can control AI agent' : 'Telegram waits for existing bot setup'}</p>
              <span>
                Uses Telegram Bot settings. No token stored here. Authorized Telegram users can send normal messages to chat with agent.
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <AdminButton loading={testingTelegram} disabled={!telegramReady} onClick={() => void handleTelegramTest()}>
              <Send className="h-4 w-4" />
              Test bridge
            </AdminButton>
            <Link href="/dashboard/settings?section=notifications#telegram" className="admin-btn px-4 py-2 text-xs font-black">
              Telegram Bot <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 flex flex-wrap justify-end gap-2">
        <AdminButton variant="gold" loading={saving} onClick={() => void handleSave()}>
          <Save className="h-4 w-4" />
          Save AI settings
        </AdminButton>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toastOk, toastFail, toastApiSaved, toastWarn } from '@/lib/admin/feedback'
import { AgentChatLauncher } from '@/components/agent/AgentChatLauncher'
import { DcKpiStrip } from '@/components/dc/DcKpiStrip'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { DcIcon } from '@/components/dc/DcIcon'
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
import { McpLinkTokenPanel } from '@/components/agent/McpLinkTokenPanel'

const MODELS: { id: AgentModelId; label: string; keyLabel: string; placeholder: string; envHint: string }[] = [
  { id: 'claude', label: 'Claude (Anthropic)', keyLabel: 'Anthropic API Key', placeholder: 'sk-ant-...', envHint: 'ANTHROPIC_API_KEY' },
  { id: 'openai', label: 'OpenAI (GPT)', keyLabel: 'OpenAI API Key', placeholder: 'sk-...', envHint: 'OPENAI_API_KEY' },
  { id: 'gemini', label: 'Gemini (Google)', keyLabel: 'Gemini API Key', placeholder: 'AIza...', envHint: 'GEMINI_API_KEY' },
  { id: 'grok', label: 'Grok (xAI)', keyLabel: 'Grok API Key', placeholder: 'xai-...', envHint: 'GROK_API_KEY' },
  { id: 'manus', label: 'Manus', keyLabel: 'Manus API Key', placeholder: 'sk-… (manus.im)', envHint: 'MANUS_API_KEY' },
]

const KEY_FIELD: Record<AgentModelId, 'claudeKey' | 'openaiKey' | 'geminiKey' | 'grokKey' | 'manusKey'> = {
  claude: 'claudeKey',
  openai: 'openaiKey',
  gemini: 'geminiKey',
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


export function AiCommandCenterPanel({ embedded = false }: { embedded?: boolean }) {
  void embedded
  const openAgentChat = useAdminUiStore((s) => s.openAgentChat)
  const { data: tgData } = useTelegramIntegration()
  const { data: aiIntegration } = useAiIntegration()
  const updateAiIntegration = useUpdateAiIntegration()

  const [status, setStatus] = useState<AgentStatusResponse | null>(null)
  const [activeModel, setActiveModel] = useState<AgentModelId>('claude')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [keyInputs, setKeyInputs] = useState<Record<AgentModelId, string>>({
    claude: '', openai: '', gemini: '', grok: '', manus: '',
  })
  const [savedKeys, setSavedKeys] = useState<Record<AgentModelId, string | null>>({
    claude: null, openai: null, gemini: null, grok: null, manus: null,
  })
  const [showKey, setShowKey] = useState<Record<AgentModelId, boolean>>({
    claude: false, openai: false, gemini: false, grok: false, manus: false,
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
        hasClaudeProxy || MODELS.some((m) => keyInputs[m.id].trim() || isMasked(savedKeys[m.id]))
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
      setKeyInputs({ claude: '', openai: '', gemini: '', grok: '', manus: '' })
      setClaudeAuthTokenInput('')
      const [cfg, st] = await Promise.all([fetchAgentConfig(), fetchAgentStatus()])
      setActiveModel((cfg.activeModel as AgentModelId) || 'claude')
      setSystemPrompt(cfg.systemPrompt ?? '')
      setSavedKeys({
        claude: cfg.claudeKey,
        openai: cfg.openaiKey,
        gemini: cfg.geminiKey,
        grok: cfg.grokKey,
        manus: cfg.manusKey,
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


  const tierTone: Record<string, DcTone> = { DANGEROUS: 'bad', WRITE: 'warn', READ: 'mute' }
  const runTone: Record<string, DcTone> = {
    completed: 'ok',
    failed: 'bad',
    budget_refused: 'warn',
    running: 'info',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 96 }}>
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
            label: 'Keys',
            value: String(
              MODELS.filter((m) => modelIsConfigured(m.id, status, savedKeys, claudeAuthMode, claudeBaseUrl)).length,
            ),
            sub: `${MODELS.length} providers`,
            tone: MODELS.some((m) => modelIsConfigured(m.id, status, savedKeys, claudeAuthMode, claudeBaseUrl))
              ? 'success'
              : 'warning',
          },
          {
            label: 'Telegram',
            value: telegramReady ? 'Online' : 'Setup',
            sub: telegramReady ? 'bridge active' : tgData?.tokenConfigured ? 'chat ID লাগবে' : 'not linked',
            tone: telegramReady ? 'success' : 'warning',
          },
        ]}
      />

      {/* Chat launcher + today's budget */}
      <section style={{ ...dcCard, padding: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 14 }}>
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
              marginTop: 14,
              padding: '11px 13px',
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
                marginTop: 9,
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
          <span style={dcChip(apiOffline ? 'bad' : 'ok')}>{apiOffline ?? 'API live'}</span>
          <span style={dcChip(chatReady ? 'ok' : 'warn')}>
            {chatReady ? `${activeModelLabel} ready` : 'নিচে API key দিন'}
          </span>
          <span style={dcChip(telegramReady ? 'ok' : 'warn')}>
            Telegram {telegramReady ? 'online' : tgData?.tokenConfigured ? 'chat ID লাগবে' : 'connect করুন'}
          </span>
          <span style={dcChip(saveTarget.isLocal ? 'warn' : 'mute')}>Save target: {saveTarget.label}</span>
        </div>

        {saveTarget.isLocal ? (
          <p
            style={{
              margin: '12px 0 0',
              padding: '10px 12px',
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
      </section>

      {/* Active model + API keys */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))' }}>
        <section style={{ ...dcCard, padding: 16 }}>
          <p style={{ ...dcCaps, margin: 0 }}>Active model</p>
          <div
            style={{
              display: 'grid',
              gap: 8,
              marginTop: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            }}
          >
            {MODELS.map((m) => {
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
                    gap: 9,
                    padding: '11px 12px',
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
                        font: `700 12.5px/1.3 ${FONT}`,
                        color: isActive ? 'var(--violet)' : 'var(--ink)',
                      }}
                    >
                      {m.label}
                    </span>
                    <span style={{ display: 'block', font: `500 10.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                      {configured ? 'Key saved' : `Needs ${m.envHint}`}
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
        </section>

        <section style={{ ...dcCard, padding: 16 }}>
          <p style={{ ...dcCaps, margin: 0 }}>API keys</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {MODELS.map((m) => {
              const saved = savedKeys[m.id]
              const hasSaved = isMasked(saved) || Boolean(saved)
              return (
                <label key={m.id} style={{ display: 'block' }}>
                  <span style={dcCaps}>
                    {m.keyLabel}
                    {hasSaved ? <span style={{ color: 'var(--ok)' }}> · Saved</span> : null}
                  </span>
                  <span style={{ position: 'relative', display: 'block' }}>
                    <input
                      type={showKey[m.id] ? 'text' : 'password'}
                      value={keyInputs[m.id]}
                      onChange={(e) => setKeyInputs((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      placeholder={hasSaved ? 'Saved — leave blank to keep' : m.placeholder}
                      autoComplete="new-password"
                      autoCorrect="off"
                      spellCheck={false}
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-form-type="other"
                      name={`ai-provider-key-${m.id}`}
                      style={{ ...dcInput, paddingRight: 38 }}
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
                  <span
                    style={{ display: 'block', marginTop: 4, font: `500 10px/1.4 ${MONO}`, color: 'var(--ink-3)' }}
                  >
                    Env: {m.envHint}
                  </span>
                  {m.id === 'manus' ? (
                    <span
                      style={{ display: 'block', marginTop: 4, font: `400 10.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}
                    >
                      Manus runs its own agent — it replies async and cannot read SPLARO orders or stock.
                    </span>
                  ) : null}
                </label>
              )
            })}
          </div>
        </section>
      </div>

      {/* System instructions */}
      <section style={{ ...dcCard, padding: 16 }}>
        <p style={{ ...dcCaps, margin: 0 }}>System instructions</p>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are SPLARO Command..."
          rows={7}
          style={{ ...dcInput, marginTop: 10, minHeight: 140, resize: 'vertical', fontFamily: MONO }}
        />
      </section>

      {/* Ops quick commands */}
      <section style={{ ...dcCard, padding: 16 }}>
        <p style={{ ...dcCaps, margin: 0 }}>Ops quick commands</p>
        <p style={{ margin: '8px 0 0', font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-2)' }}>
          Chat-এ seed করে — Banglish chips for daily ops.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
          {AGENT_QUICK_COMMANDS.filter((c) => c.category === 'ops' || c.category === 'health')
            .slice(0, 8)
            .map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                disabled={!chatReady}
                onClick={() => openAgentChat(cmd.message)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 99,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: chatReady ? 'var(--ink-2)' : 'var(--ink-3)',
                  font: `600 11.5px/1 ${FONT}`,
                  cursor: chatReady ? 'pointer' : 'not-allowed',
                }}
              >
                {cmd.label}
              </button>
            ))}
        </div>
      </section>

      {/* Guardrails */}
      <section id="ai-guardrails" style={{ ...dcCard, padding: 16 }}>
        <p style={{ ...dcCaps, margin: 0 }}>Guardrails &amp; tool tiers</p>
        <p style={{ margin: '8px 0 0', font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-2)' }}>
          Live tools by tier — DANGEROUS needs Confirm. WRITE price/publish/stock also confirms.
        </p>
        <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
          {AGENT_TOOL_TIERS.map((tier) => (
            <div key={tier}>
              <span style={dcChip(tierTone[tier] ?? 'mute')}>{tier}</span>
              <div
                style={{
                  display: 'grid',
                  gap: 8,
                  marginTop: 9,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                }}
              >
                {AGENT_TOOL_CATALOG.filter((t) => t.tier === tier).map((tool) => (
                  <div
                    key={tool.name}
                    style={{
                      padding: '9px 11px',
                      borderRadius: 9,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-2)',
                    }}
                  >
                    <p style={{ margin: 0, font: `700 12px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                      {tool.label}{' '}
                      <span style={{ font: `500 12px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>· {tool.labelBn}</span>
                    </p>
                    <p style={{ margin: '3px 0 0', font: `500 9.5px/1.3 ${MONO}`, color: 'var(--ink-3)' }}>
                      {tool.name}
                    </p>
                    <p style={{ margin: '5px 0 0', font: `500 10.5px/1.45 ${FONT}`, color: 'var(--ink-2)' }}>
                      {tool.when}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Telegram bridge */}
      <section style={{ ...dcCard, padding: 16 }}>
        <p style={{ ...dcCaps, margin: 0 }}>Telegram bridge</p>
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
      </section>

      {/* Agent activity */}
      <section style={{ ...dcCard, padding: 16 }}>
        <p style={{ ...dcCaps, margin: 0 }}>Agent activity</p>
        <p style={{ margin: '8px 0 0', font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-2)' }}>
          Recent AI runs, tool calls, tiers and estimated cost — last 50 sessions.
        </p>

        {activityLoading ? (
          <p style={{ margin: '14px 0 0', font: `500 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
            Loading activity…
          </p>
        ) : activity.length === 0 ? (
          <p style={{ margin: '14px 0 0', font: `500 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
            No agent runs yet — open CHAT and ask something to see runs here.
          </p>
        ) : (
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
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
                {activity.map((run) => (
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
        )}
      </section>

      <McpLinkTokenPanel />

      {/* Save bar */}
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
    </div>
  )
}

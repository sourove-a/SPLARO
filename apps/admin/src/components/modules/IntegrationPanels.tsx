'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  Facebook,
  Plug,
  RefreshCw,
  ShoppingCart,
  Webhook,
  ChevronRight,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { toastOk, toastFail, toastWarn } from '@/lib/admin/feedback'
import {
  useIntegrationsCatalog,
  useTestTelegramIntegration,
  useTestAiIntegration,
  useTestGoogleIntegration,
  useTestPaymentIntegration,
  useTestInfrastructureIntegration,
  useTestMetaIntegration,
} from '@/lib/api/integration-hooks'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import type { IntegrationCard } from '@/lib/api/integrations'
import { integrationActionLabel, integrationSetupPath } from '@/lib/integrations/routes'
import { cn } from '@/lib/utils/cn'

const ICONS: Record<string, typeof Activity> = {
  telegram: Activity,
  openai: Plug,
  google_sheets: Plug,
  gmail: Plug,
  google_drive: Plug,
  meta_pixel: Facebook,
  google_analytics: Activity,
  search_console: Activity,
  sslcommerz: ShoppingCart,
  bkash: Plug,
  nagad: Plug,
  steadfast: Activity,
  pathao: Activity,
  redx: Activity,
  cloudflare_r2: Plug,
  smtp: Webhook,
  sms: Webhook,
}

function googleTestMode(provider: string): 'gmail' | 'sheets' | 'auto' | null {
  if (provider === 'gmail') return 'gmail'
  if (provider === 'google_sheets') return 'sheets'
  if (provider === 'google_drive') return 'auto'
  return null
}

function canTest(provider: string) {
  return (
    provider === 'telegram' ||
    provider === 'openai' ||
    provider === 'bkash' ||
    provider === 'nagad' ||
    provider === 'sslcommerz' ||
    provider === 'meta_pixel' ||
    provider === 'pathao' ||
    provider === 'redx' ||
    Boolean(googleTestMode(provider))
  )
}

function statusLabel(item: IntegrationCard) {
  if (item.connected) return 'Connected'
  if (item.status === 'error') return 'Error'
  return 'Not configured'
}

function IntegrationCardBox({
  item,
  testing,
  disabled,
  onTest,
}: {
  item: IntegrationCard
  testing: boolean
  disabled: boolean
  onTest: () => void
}) {
  const Icon = ICONS[item.provider] ?? Plug
  const href = integrationSetupPath(item.provider, item.connected)
  const testable = canTest(item.provider) && item.connected

  return (
    <article
      className={cn(
        'integ-card admin-module-card',
        item.connected && 'integ-card--on',
        item.status === 'error' && 'integ-card--err',
      )}
    >
      <div className="integ-card__top">
        <span className="integ-card__icon">
          <Icon className="h-4 w-4" />
        </span>
        <span
          className={cn(
            'integ-card__pill',
            item.connected && 'integ-card__pill--on',
            item.status === 'error' && 'integ-card__pill--err',
          )}
        >
          {statusLabel(item)}
        </span>
      </div>

      <h3 className="integ-card__name">{item.name}</h3>
      <p className="integ-card__detail">
        {item.connectionDetail ?? (item.connected ? 'Ready' : 'Setup required')}
      </p>

      {item.lastTestedAt ? (
        <p className="integ-card__meta">
          Last test:{' '}
          <span className={item.lastTestStatus === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
            {item.lastTestStatus === 'success' ? 'passed' : item.lastTestStatus ?? '—'}
          </span>
        </p>
      ) : null}

      {item.lastError ? <p className="integ-card__error">{item.lastError}</p> : null}

      <div className="integ-card__actions">
        {testable ? (
          <AdminButton
            variant="ghost"
            className="integ-card__btn"
            loading={testing}
            disabled={disabled}
            onClick={onTest}
          >
            Test API
          </AdminButton>
        ) : null}
        <AdminLinkButton
          href={href}
          variant={item.connected ? 'ghost' : 'gold'}
          className="integ-card__btn"
        >
          {integrationActionLabel(item.connected)}
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
        </AdminLinkButton>
      </div>
    </article>
  )
}

export function AllIntegrationsPanel(_props: ModuleContextProps) {
  const { data, isError, error, isLoading, refetch, isFetching } = useIntegrationsCatalog()
  const testTelegram = useTestTelegramIntegration()
  const testAi = useTestAiIntegration()
  const testGoogle = useTestGoogleIntegration()
  const testPayment = useTestPaymentIntegration()
  const testInfra = useTestInfrastructureIntegration()
  const testMeta = useTestMetaIntegration()
  const [testingId, setTestingId] = useState<string | null>(null)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchResult, setBatchResult] = useState<{ pass: number; fail: number } | null>(null)

  const items = data?.integrations ?? []
  const connectedCount = items.filter((i) => i.connected).length
  const testableConnected = items.filter((i) => i.connected && canTest(i.provider))

  const sorted = useMemo(
    () => [...items].sort((a, b) => Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name)),
    [items],
  )

  const runTest = async (item: IntegrationCard) => {
    setTestingId(item.id)
    try {
      if (item.provider === 'telegram') {
        const r = await testTelegram.mutateAsync('SPLARO integration test')
        toastOk(r.message || 'Telegram OK', `test-${item.provider}`)
      } else if (item.provider === 'openai') {
        const r = await testAi.mutateAsync({ testPrompt: 'Reply: SPLARO OK' })
        toastOk(r.message, `test-${item.provider}`)
      } else if (item.provider === 'bkash' || item.provider === 'nagad' || item.provider === 'sslcommerz') {
        const r = await testPayment.mutateAsync(item.provider)
        toastOk(r.message, `test-${item.provider}`)
      } else if (item.provider === 'meta_pixel') {
        const r = await testMeta.mutateAsync()
        if (!r.ok) throw new Error(r.message)
        toastOk(r.message, `test-${item.provider}`)
      } else if (item.provider === 'pathao' || item.provider === 'redx') {
        const r = await testInfra.mutateAsync(item.provider)
        toastOk(r.message, `test-${item.provider}`)
      } else {
        const mode = googleTestMode(item.provider)
        if (!mode) return
        const r = await testGoogle.mutateAsync(mode)
        toastOk(r.message || `${item.name} OK`, `test-${item.provider}`)
      }
      await refetch()
      return true
    } catch (err) {
      toastFail(err instanceof Error ? err.message : `${item.name} failed`, `test-${item.provider}-fail`)
      return false
    } finally {
      setTestingId(null)
    }
  }

  const runTestAll = async () => {
    if (testableConnected.length === 0) {
      toastWarn('No connected integrations with API test — configure & connect first.', 'test-all-empty')
      return
    }
    setBatchRunning(true)
    setBatchResult(null)
    let pass = 0
    let fail = 0
    for (const item of testableConnected) {
      const ok = await runTest(item)
      if (ok) pass += 1
      else fail += 1
    }
    setBatchResult({ pass, fail })
    setBatchRunning(false)
    await refetch()
    if (fail === 0) {
      toastOk(`All ${pass} integration tests passed.`, 'test-all-ok')
    } else {
      toastFail(`${fail} of ${pass + fail} tests failed — see cards for details.`, 'test-all-partial')
    }
  }

  const loadError =
    isError && error instanceof Error
      ? error.message.includes('401') || error.message.toLowerCase().includes('authentication')
        ? 'Session expired — log in again.'
        : error.message
      : isError
        ? 'API offline — run pnpm dev:api'
        : null

  return (
    <div className="integ-page">
      <div className="integ-page__bar admin-module-card">
        <div>
          <p className="integ-page__stat">
            {isLoading ? '…' : `${connectedCount} / ${items.length}`}
            <span className="integ-page__stat-label">connected</span>
          </p>
          <p className="integ-page__sub">
            {testableConnected.length} testable · verify each API from its card or run all at once
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton variant="gold" loading={batchRunning} disabled={Boolean(testingId)} onClick={() => void runTestAll()}>
            <Zap className="h-4 w-4" />
            Test all connected
          </AdminButton>
          <AdminButton variant="ghost" loading={isFetching} onClick={() => void refetch()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </AdminButton>
        </div>
      </div>

      {batchResult ? (
        <div className="integ-page__batch admin-module-card">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{batchResult.pass} passed</span>
          {batchResult.fail > 0 ? (
            <>
              <XCircle className="ml-3 h-4 w-4 text-red-500" />
              <span className="font-bold text-red-600 dark:text-red-400">{batchResult.fail} failed</span>
            </>
          ) : null}
        </div>
      ) : null}

      {loadError ? <ApiOfflineBanner message={loadError} /> : null}

      {isLoading ? (
        <p className="integ-page__loading">Loading integrations…</p>
      ) : (
        <div className="integ-grid">
          {sorted.map((item) => (
            <IntegrationCardBox
              key={item.id}
              item={item}
              testing={testingId === item.id}
              disabled={Boolean(testingId) || batchRunning}
              onTest={() => void runTest(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function WebhooksPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--admin-text-muted)]">Webhook management — Developer API Center.</p>
      <AdminLinkButton href="/dashboard/developer/api-center" variant="gold" className="px-4 py-2 text-xs font-black">
        API Center
      </AdminLinkButton>
    </div>
  )
}

export function MetaBusinessPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--admin-text-muted)]">Meta Pixel & GA4 — Marketing settings.</p>
      <AdminLinkButton href="/dashboard/settings?section=marketing" variant="gold" className="px-4 py-2 text-xs font-black">
        Marketing settings
      </AdminLinkButton>
    </div>
  )
}

export function GoogleMerchantPanel() {
  return (
    <div className="admin-module-card">
      <p className="admin-module-card__title">Google Merchant feed</p>
      <AdminButton variant="gold" className="mt-3" onClick={() => window.open('https://splaro.com.bd/feeds/google-merchant.xml', '_blank')}>
        View feed
      </AdminButton>
    </div>
  )
}

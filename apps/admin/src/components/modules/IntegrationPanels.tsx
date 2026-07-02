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
} from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import {
  useIntegrationsCatalog,
  useTestTelegramIntegration,
  useTestAiIntegration,
  useTestGoogleIntegration,
  useTestPaymentIntegration,
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
    Boolean(googleTestMode(provider))
  )
}

function IntegrationRow({
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
  const Icon = ICONS[item.id] ?? Plug
  const href = integrationSetupPath(item.provider, item.connected)
  const testable = canTest(item.provider) && item.connected

  return (
    <div
      className={cn(
        'integ-row',
        item.connected && 'integ-row--on',
        item.status === 'error' && 'integ-row--err',
      )}
    >
      <div className="integ-row__main">
        <span className="integ-row__icon">
          <Icon className="h-4 w-4" />
        </span>
        <div className="integ-row__copy min-w-0">
          <div className="integ-row__head">
            <p className="integ-row__name">{item.name}</p>
            <span
              className={cn(
                'integ-row__pill',
                item.connected && 'integ-row__pill--on',
                item.status === 'error' && 'integ-row__pill--err',
              )}
            >
              {item.connected ? 'Connected' : item.status === 'error' ? 'Error' : 'Off'}
            </span>
          </div>
          <p className="integ-row__detail">
            {item.connectionDetail ?? (item.connected ? 'Ready' : 'Not configured')}
          </p>
          {item.lastError ? <p className="integ-row__error">{item.lastError}</p> : null}
        </div>
      </div>

      <div className="integ-row__actions">
        {testable ? (
          <AdminButton
            variant="ghost"
            className="integ-row__btn integ-row__btn--ghost"
            loading={testing}
            disabled={disabled}
            onClick={onTest}
          >
            Test
          </AdminButton>
        ) : null}
        <AdminLinkButton
          href={href}
          variant={item.connected ? 'ghost' : 'gold'}
          className="integ-row__btn"
        >
          {integrationActionLabel(item.connected)}
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
        </AdminLinkButton>
      </div>
    </div>
  )
}

export function AllIntegrationsPanel(_props: ModuleContextProps) {
  const { data, isError, error, isLoading, refetch, isFetching } = useIntegrationsCatalog()
  const testTelegram = useTestTelegramIntegration()
  const testAi = useTestAiIntegration()
  const testGoogle = useTestGoogleIntegration()
  const testPayment = useTestPaymentIntegration()
  const [testingId, setTestingId] = useState<string | null>(null)

  const items = data?.integrations ?? []
  const connectedCount = items.filter((i) => i.connected).length

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
      } else {
        const mode = googleTestMode(item.provider)
        if (!mode) return
        const r = await testGoogle.mutateAsync(mode)
        toastOk(r.message || `${item.name} OK`, `test-${item.provider}`)
      }
      await refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : `${item.name} failed`, `test-${item.provider}-fail`)
    } finally {
      setTestingId(null)
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
      <div className="integ-page__bar">
        <div>
          <p className="integ-page__stat">
            {isLoading ? '…' : `${connectedCount} / ${items.length}`}
            <span className="integ-page__stat-label">connected</span>
          </p>
        </div>
        <AdminButton variant="ghost" loading={isFetching} onClick={() => void refetch()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </AdminButton>
      </div>

      {loadError ? <ApiOfflineBanner message={loadError} /> : null}

      {isLoading ? (
        <p className="integ-page__loading">Loading…</p>
      ) : (
        <div className="integ-list">
          {sorted.map((item) => (
            <IntegrationRow
              key={item.id}
              item={item}
              testing={testingId === item.id}
              disabled={Boolean(testingId)}
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

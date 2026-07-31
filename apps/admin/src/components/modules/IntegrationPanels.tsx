'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  Bot,
  CreditCard,
  Facebook,
  HardDrive,
  Mail,
  MessageCircle,
  Plug,
  RefreshCw,
  Send,
  Server,
  Smartphone,
  Table2,
  Truck,
  Webhook,
} from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { HandoffPageChrome } from '@/components/ui/HandoffPageChrome'
import { KpiGrid } from '@/components/ui/AdminHandoffBlocks'
import { toastOk, toastFail, toastIntegrationTestResult } from '@/lib/admin/feedback'
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
import { DcEmptyState, DcErrorState } from '@/components/dc/blocks/DcStates'
import type { DcModuleState } from '@/components/dc/DcPageHead'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import type { IntegrationCard } from '@/lib/api/integrations'
import { integrationSetupPath } from '@/lib/integrations/routes'
import { cn } from '@/lib/utils/cn'

const ICONS: Record<string, typeof Activity> = {
  telegram: Send,
  openai: Bot,
  google_sheets: Table2,
  gmail: Mail,
  google_drive: HardDrive,
  meta_pixel: Facebook,
  google_analytics: Activity,
  search_console: Activity,
  sslcommerz: CreditCard,
  bkash: Smartphone,
  nagad: Smartphone,
  steadfast: Truck,
  pathao: Truck,
  redx: Truck,
  cloudflare_r2: Server,
  smtp: Webhook,
  sms: MessageCircle,
}

const PROVIDER_COPY: Record<string, string> = {
  telegram: 'Login codes and order alerts',
  openai: 'AI operations and command tools',
  google_sheets: 'Daily closing and hisab backup',
  gmail: 'Transactional email delivery',
  google_drive: 'Files and backup storage',
  meta_pixel: 'Conversion event tracking',
  google_analytics: 'Storefront traffic analytics',
  search_console: 'Google indexing and search health',
  sslcommerz: 'Cards and net banking payments',
  bkash: 'Instant checkout payments',
  nagad: 'Wallet payments',
  steadfast: 'Booking, tracking and COD remittance',
  pathao: 'Courier booking and tracking',
  redx: 'Courier booking and tracking',
  cloudflare_r2: 'Media and invoice storage',
  smtp: 'System and customer email',
  sms: 'Transactional text messages',
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
    provider === 'steadfast' ||
    Boolean(googleTestMode(provider))
  )
}

/** Keys saved ≠ live API — only last successful test claims Connected. */
function statusLabel(item: IntegrationCard) {
  if (item.status === 'error') return 'Error'
  if (item.lastTestStatus === 'success') return 'Connected'
  if (item.connected) return 'Configured'
  return 'Not configured'
}

function relativeTime(value: string | null) {
  if (!value) return 'Not tested'
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime())
  const seconds = Math.floor(elapsed / 1000)
  if (seconds < 60) return `${Math.max(1, seconds)}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
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
  const testable = canTest(item.provider) && item.connected && item.status !== 'error'
  const verified = item.lastTestStatus === 'success'
  const configured = item.connected && !verified && item.status !== 'error'
  const primaryLabel = item.status === 'error' ? 'Error' : item.connected ? 'Connection' : 'Status'
  const primaryValue =
    item.status === 'error'
      ? item.lastError ?? 'Connection test failed'
      : item.connectionDetail ?? (item.connected ? 'Credentials configured' : 'Setup required')
  const actionLabel =
    item.status === 'error' ? 'Fix credentials' : item.connected ? 'Open settings' : 'Connect'

  return (
    <article className={cn('integ-card', item.status === 'error' && 'integ-card--err')}>
      <div className="integ-card__head">
        <span className="integ-card__icon">
          <Icon aria-hidden />
        </span>
        <span className="integ-card__identity">
          <h3 className="integ-card__name">{item.name}</h3>
          <span className="integ-card__description">
            {PROVIDER_COPY[item.provider] ?? 'Connected service and operations'}
          </span>
        </span>
        <span
          className={cn(
            'integ-card__pill',
            verified && 'integ-card__pill--on',
            configured && 'integ-card__pill--configured',
            item.status === 'error' && 'integ-card__pill--err',
          )}
        >
          {statusLabel(item)}
        </span>
      </div>

      <div className="integ-card__rows">
        <div className="integ-card__row">
          <span>{primaryLabel}</span>
          <strong className={item.status === 'error' ? 'integ-card__row-value--error' : undefined}>
            {primaryValue}
          </strong>
        </div>
        <div className="integ-card__row">
          <span>Last test</span>
          <strong>
            {relativeTime(item.lastTestedAt)}
            {item.lastTestStatus ? ` · ${item.lastTestStatus}` : ''}
          </strong>
        </div>
      </div>

      <div className="integ-card__actions">
        {testable ? (
          <AdminButton
            variant="ghost"
            className="integ-card__btn"
            loading={testing}
            disabled={disabled}
            onClick={onTest}
          >
            Test call
          </AdminButton>
        ) : (
          <AdminLinkButton
            href={href}
            variant={item.connected && item.status !== 'error' ? 'ghost' : 'primary'}
            className="integ-card__btn"
          >
            {actionLabel}
          </AdminLinkButton>
        )}
        {testable && item.lastTestStatus !== 'success' ? (
          <AdminLinkButton href={href} variant="ghost" className="integ-card__btn">
            Settings
          </AdminLinkButton>
        ) : null}
      </div>
    </article>
  )
}

type AllIntegrationsPanelProps = Partial<ModuleContextProps> & {
  embedded?: boolean
  previewState?: DcModuleState
}

export function AllIntegrationsPanel({
  embedded = false,
  previewState = 'live',
}: AllIntegrationsPanelProps) {
  const { data, isError, error, isLoading, refetch, isFetching } = useIntegrationsCatalog()
  const testTelegram = useTestTelegramIntegration()
  const testAi = useTestAiIntegration()
  const testGoogle = useTestGoogleIntegration()
  const testPayment = useTestPaymentIntegration()
  const testInfra = useTestInfrastructureIntegration()
  const testMeta = useTestMetaIntegration()
  const [testingId, setTestingId] = useState<string | null>(null)

  const items = useMemo(() => data?.integrations ?? [], [data])
  const configuredCount = items.filter((i) => i.connected).length
  const connectedCount = items.filter((i) => i.lastTestStatus === 'success').length

  const sorted = useMemo(
    () => [...items].sort((a, b) => Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name)),
    [items],
  )
  const firstSetupHref = useMemo(() => {
    const target = sorted.find((i) => !i.connected) ?? sorted.find((i) => i.status === 'error') ?? sorted[0]
    return target ? integrationSetupPath(target.provider, target.connected) : '/dashboard/settings'
  }, [sorted])
  const failingCount = items.filter((i) => i.status === 'error').length
  const successfulProbeCount = items.filter((i) => i.lastTestStatus === 'success').length
  const failedProbeCount = items.filter(
    (i) => i.lastTestStatus && i.lastTestStatus !== 'success',
  ).length
  const lastHealthAt = useMemo(() => {
    const stamped = items
      .map((i) => i.lastTestedAt)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1)
    return stamped ?? null
  }, [items])
  const lastHealthValue = isLoading ? '…' : relativeTime(lastHealthAt)
  const lastHealthText = lastHealthAt ? `health checked ${relativeTime(lastHealthAt)}` : 'no health check yet'

  const runTest = async (item: IntegrationCard) => {
    setTestingId(item.id)
    try {
      if (item.provider === 'telegram') {
        const r = await testTelegram.mutateAsync('SPLARO integration test')
        if (!r.ok) throw new Error(r.message || 'Telegram test failed')
        toastOk(r.message || 'Telegram OK', `test-${item.provider}`)
      } else if (item.provider === 'openai') {
        const r = await testAi.mutateAsync({ testPrompt: 'Reply: SPLARO OK' })
        if (!toastIntegrationTestResult(r, 'AI', `test-${item.provider}`)) return false
      } else if (item.provider === 'bkash' || item.provider === 'nagad' || item.provider === 'sslcommerz') {
        const r = await testPayment.mutateAsync(item.provider)
        if (!toastIntegrationTestResult(r, item.name, `test-${item.provider}`)) return false
      } else if (item.provider === 'meta_pixel') {
        const r = await testMeta.mutateAsync()
        if (!toastIntegrationTestResult(r, 'Meta Pixel', `test-${item.provider}`)) return false
      } else if (item.provider === 'pathao' || item.provider === 'redx' || item.provider === 'steadfast') {
        const r = await testInfra.mutateAsync(item.provider)
        if (!toastIntegrationTestResult(r, item.name, `test-${item.provider}`)) return false
      } else {
        const mode = googleTestMode(item.provider)
        if (!mode) return false
        const r = await testGoogle.mutateAsync(mode)
        if (!toastIntegrationTestResult(r, item.name, `test-${item.provider}`)) return false
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

  const loadError =
    isError && error instanceof Error
      ? error.message.includes('401') || error.message.toLowerCase().includes('authentication')
        ? 'Session expired — log in again.'
        : error.message
      : isError
        ? 'API offline — run pnpm dev:api'
        : null
  const previewOverride =
    previewState === 'loading' ? (
      <div className="integ-preview-loading" aria-label="Loading integrations">
        <div className="integ-preview-loading__kpis">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className="dc-skeleton" />
          ))}
        </div>
        <div className="integ-preview-loading__cards">
          {Array.from({ length: 10 }, (_, index) => (
            <span key={index} className="dc-skeleton" />
          ))}
        </div>
      </div>
    ) : previewState === 'empty' ? (
      <DcEmptyState
        icon="icon-plug"
        title="Nothing connected yet"
        body="SPLARO needs at least one courier and one payment rail before live operations can start."
        cta="Connect first integration"
        onCta={() => window.location.assign(firstSetupHref)}
      />
    ) : previewState === 'error' ? (
      <DcErrorState
        error="GET /admin/integrations → preview error state"
        hint="Use Retry to request current integration catalog again."
        onRetry={() => void refetch()}
      />
    ) : null

  return (
    <div className={cn('integ-page', embedded && 'integ-page--dc')}>
      <HandoffPageChrome
        group="Integrations"
        title="All Integrations"
        hideHeader={embedded}
        {...(embedded ? { className: 'integ-chrome--embedded' } : {})}
        sync={loadError ? 'health unavailable' : isFetching ? 'health checking…' : lastHealthText}
        offline={Boolean(loadError)}
        actions={
          embedded ? undefined : (
            <>
              <AdminButton variant="ghost" loading={isFetching} onClick={() => void refetch()}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </AdminButton>
              <AdminLinkButton href={firstSetupHref} variant="primary">
                Add integration
              </AdminLinkButton>
            </>
          )
        }
      >
        {previewOverride ?? (
          <>
          <KpiGrid
          columns={4}
          items={[
            {
              label: 'Connected',
              value: isLoading ? '…' : connectedCount,
              sub: `${configuredCount} configured · ${items.length || 0} available`,
              tone: connectedCount > 0 ? 'success' : 'default',
            },
            {
              label: 'Failing',
              value: isLoading ? '…' : failingCount,
              sub:
                failingCount > 0
                  ? `${items.find((item) => item.status === 'error')?.name ?? 'Integration'} needs attention`
                  : 'no failing integration',
              tone: failingCount > 0 ? 'danger' : 'default',
            },
            {
              label: 'API probes',
              value: isLoading ? '…' : successfulProbeCount,
              sub: `${failedProbeCount} failed · real connection tests`,
              tone: failedProbeCount > 0 ? 'warning' : successfulProbeCount > 0 ? 'success' : 'default',
            },
            {
              label: 'Last health check',
              value: lastHealthValue,
              sub: 'catalog refresh every 60 seconds',
            },
          ]}
        />

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
                  disabled={Boolean(testingId)}
                  onTest={() => void runTest(item)}
                />
              ))}
            </div>
          )}
          </>
        )}
      </HandoffPageChrome>
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
      <AdminButton variant="gold" className="mt-3" onClick={() => window.open('https://splaro.co/feeds/google-merchant.xml', '_blank')}>
        View feed
      </AdminButton>
    </div>
  )
}

'use client'

import {
  Activity,
  Facebook,
  Plug,
  RefreshCw,
  ShoppingCart,
  Webhook,
  CheckCircle2,
  XCircle,
  Settings,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import { useIntegrationsCatalog, useTestTelegramIntegration, useTestAiIntegration } from '@/lib/api/integration-hooks'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { formatRelativeTime } from '@/lib/api/orders'

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

export function AllIntegrationsPanel(_props: ModuleContextProps) {
  const { data, isError, isLoading, refetch, isFetching } = useIntegrationsCatalog()
  const testTelegram = useTestTelegramIntegration()
  const testAi = useTestAiIntegration()

  if (isError) return <ApiOfflineBanner />

  const items = data?.integrations ?? []

  const runTest = async (provider: string, name: string) => {
    try {
      if (provider === 'telegram') {
        const r = await testTelegram.mutateAsync('SPLARO integration test')
        toastOk(r.message || 'Telegram connected successfully', `test-${provider}`)
      } else if (provider === 'openai') {
        const r = await testAi.mutateAsync({ testPrompt: 'Reply: SPLARO OK' })
        toastOk(r.message, `test-${provider}`)
      } else {
        toastFail(`${name} test not wired yet — configure and save first.`, `test-${provider}`)
        return
      }
      await refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : `${name} test failed`, `test-${provider}-fail`)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <AdminButton loading={isFetching} onClick={() => void refetch()}>
          <RefreshCw className="h-4 w-4" />
          Refresh status
        </AdminButton>
      </div>
      {isLoading ? (
        <p className="text-sm font-semibold text-[var(--admin-text-muted)]">Loading integrations from database…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const Icon = ICONS[item.id] ?? Plug
            return (
              <div key={item.id} className="admin-module-card !p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[#5E7CFF]" />
                    <p className="admin-module-card__title">{item.name}</p>
                  </div>
                  {item.connected ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                <p className="mt-2 text-xs font-semibold capitalize text-[var(--admin-text-muted)]">
                  {item.connected ? 'Connected' : item.status === 'error' ? 'Error' : 'Not connected'}
                </p>
                <p className="text-[10px] font-semibold text-[var(--admin-text-muted)]">
                  {item.lastTestedAt ? `Tested ${formatRelativeTime(item.lastTestedAt)}` : 'Never tested'}
                </p>
                {item.lastError ? (
                  <p className="mt-1 text-[10px] font-semibold text-red-600">{item.lastError}</p>
                ) : null}
                <div className="mt-3 flex flex-col gap-2">
                  <AdminNavLink href={item.configurePath} className="admin-btn w-full justify-center px-3 py-2 text-xs font-black">
                    <Settings className="h-3.5 w-3.5" />
                    Configure
                  </AdminNavLink>
                  <AdminButton
                    className="w-full"
                    loading={testTelegram.isPending || testAi.isPending}
                    onClick={() => void runTest(item.provider, item.name)}
                  >
                    Test connection
                  </AdminButton>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <AdminNavLink href="/dashboard/api-health" className="text-xs font-black text-[#5E7CFF] hover:underline">
        View API Health →
      </AdminNavLink>
    </div>
  )
}

export function WebhooksPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--admin-text-muted)]">Webhook management — see Developer API Center.</p>
      <AdminNavLink href="/dashboard/developer/api-center" className="admin-btn admin-btn--gold inline-flex px-4 py-2 text-xs font-black">
        Developer API Center
      </AdminNavLink>
    </div>
  )
}

export function MetaBusinessPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm">Meta Pixel & GA4 — saved via Settings API (PostgreSQL).</p>
      <AdminNavLink href="/dashboard/settings" className="admin-btn admin-btn--gold inline-flex px-4 py-2 text-xs font-black">
        Store Settings
      </AdminNavLink>
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

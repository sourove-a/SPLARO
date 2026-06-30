'use client'

import { createElement, useEffect, useMemo, useState } from 'react'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { FinanceSubNav, FINANCE_ROUTES } from '@/components/finance/FinanceSubNav'
import { FinanceDashboard } from '@/components/finance/FinanceDashboard'
import {
  PartnerAccountsPage,
  ExpensesPanel,
  InvestmentsPanel,
  WithdrawalsPanel,
} from '@/components/finance/PartnerHubPage'
import { ProfitLossPanel } from '@/components/finance/ProfitLossPanel'
import { DailyClosingPanel } from '@/components/finance/DailyClosingPanel'
import { GoogleSheetsPanel } from '@/components/finance/GoogleSheetsPanel'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import {
  fetchDailyClosings,
  fetchExpenses,
  fetchFinanceDashboard,
  fetchPartnerHub,
  fetchPartnerTransactions,
  fetchProfitLoss,
  fetchSheetsDashboard,
} from '@/lib/api/finance'

type RouteStatus = 'ok' | 'warn' | 'down' | 'loading'

const PANELS: Record<string, React.ComponentType<ModuleContextProps> | React.ComponentType> = {
  '/dashboard/finance/finance-reports': FinanceDashboard,
  '/dashboard/finance/partner-accounts': PartnerAccountsPage,
  '/dashboard/finance/expenses': ExpensesPanel,
  '/dashboard/finance/investments': InvestmentsPanel,
  '/dashboard/finance/withdrawals': WithdrawalsPanel,
  '/dashboard/finance/profit-loss': ProfitLossPanel,
  '/dashboard/finance/daily-closing': DailyClosingPanel,
  '/dashboard/finance/google-sheets-finance': GoogleSheetsPanel,
}

async function probeRoute(href: string): Promise<boolean> {
  try {
    switch (href) {
      case '/dashboard/finance/finance-reports':
        await fetchFinanceDashboard()
        return true
      case '/dashboard/finance/partner-accounts':
        await fetchPartnerHub()
        return true
      case '/dashboard/finance/expenses':
        await fetchExpenses(1, { limit: '1' })
        return true
      case '/dashboard/finance/investments':
      case '/dashboard/finance/withdrawals':
        await fetchPartnerTransactions({ limit: '1' })
        return true
      case '/dashboard/finance/profit-loss':
        await fetchProfitLoss('monthly')
        return true
      case '/dashboard/finance/daily-closing':
        await fetchDailyClosings(1, 1)
        return true
      case '/dashboard/finance/google-sheets-finance':
        await fetchSheetsDashboard()
        return true
      default:
        return true
    }
  } catch {
    return false
  }
}

export function FinanceModulePanel(props: ModuleContextProps) {
  const { moduleHref } = props
  const [statusByHref, setStatusByHref] = useState<Partial<Record<string, RouteStatus>>>(() =>
    Object.fromEntries(FINANCE_ROUTES.map((r) => [r.href, 'loading' as const])),
  )

  useEffect(() => {
    let cancelled = false

    async function runProbes() {
      const results = await Promise.all(
        FINANCE_ROUTES.map(async ({ href }) => {
          const ok = await probeRoute(href)
          return [href, ok ? 'ok' : 'down'] as const
        }),
      )
      if (!cancelled) {
        setStatusByHref(Object.fromEntries(results))
      }
    }

    void runProbes()
    return () => {
      cancelled = true
    }
  }, [])

  const anyDown = useMemo(
    () => Object.values(statusByHref).some((s) => s === 'down'),
    [statusByHref],
  )

  const Panel = PANELS[moduleHref] ?? FinanceDashboard
  const needsContext = moduleHref !== '/dashboard/finance/finance-reports'
    && moduleHref !== '/dashboard/finance/profit-loss'
    && moduleHref !== '/dashboard/finance/daily-closing'
    && moduleHref !== '/dashboard/finance/google-sheets-finance'

  return (
    <div className="settings-section-enter flex flex-col gap-4">
      <FinanceSubNav activeHref={moduleHref} statusByHref={statusByHref} />
      {anyDown ? (
        <ApiOfflineBanner message="Finance API offline — run pnpm dev:api on port 4000." />
      ) : null}
      {needsContext
        ? createElement(Panel as React.ComponentType<ModuleContextProps>, props)
        : createElement(Panel as React.ComponentType)}
    </div>
  )
}

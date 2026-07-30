'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { PartnerHubPage } from '@/components/finance/PartnerHubPage'
import { downloadCsv } from '@/lib/admin/admin-actions'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import { fetchPartnerHub, fetchPartnerTransactions, type PartnerTransactionRow } from '@/lib/api/finance'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { getNavItemByHref } from '@/lib/navigation/admin-nav'

/**
 * Partner Hub — DC page chrome + live PartnerHubPage (setup, invest, withdraw, approve).
 * Never a read-only shell that claims writes work on this screen.
 */
export function DcPartnerHub() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="partners" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPartnerHubBody />
    </DcScreenProvider>
  )
}

function DcPartnerHubBody() {
  const hub = useQuery({
    queryKey: ['partner-hub'],
    queryFn: fetchPartnerHub,
    staleTime: 30_000,
  })
  const txs = useQuery({
    queryKey: ['partner-transactions', 'all'],
    queryFn: () => fetchPartnerTransactions(),
    staleTime: 30_000,
  })
  const { api } = useAdminConnection(25_000)

  const partners = hub.data?.partners ?? []
  const ledger: PartnerTransactionRow[] = useMemo(() => {
    const raw = txs.data as { items?: PartnerTransactionRow[]; transactions?: PartnerTransactionRow[] } | PartnerTransactionRow[] | undefined
    if (Array.isArray(raw)) return raw
    return raw?.items ?? raw?.transactions ?? []
  }, [txs.data])

  const exportHisab = () => {
    if (partners.length === 0 && ledger.length === 0) {
      toastFail('No partner data to export — load live hub first.')
      return
    }
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`splaro-partner-hisab-${date}.csv`, [
      ['Partner', 'Share %', 'Balance', 'Invested', 'Withdrawn', 'Profit share'],
      ...partners.map((p) => [
        p.name,
        String(p.sharePercent ?? ''),
        String(p.currentBalance ?? ''),
        String(p.totalInvestment ?? ''),
        String(p.totalWithdrawal ?? ''),
        String(p.totalProfitShare ?? ''),
      ]),
      [],
      ['Type', 'Partner', 'Amount', 'Status', 'Date'],
      ...ledger.map((t) => [
        t.type ?? '',
        t.partner?.name ?? '',
        String(t.amount ?? ''),
        t.status ?? '',
        t.transactionDate ?? '',
      ]),
    ])
    toastOk(`Exported ${partners.length} partners · ${ledger.length} ledger rows.`)
  }

  const scrollToWrites = () => {
    document.getElementById('partner-tx')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const pageStatus = dcPageStatus([hub, txs], api.pulse)

  return (
    <>
      <DcPageHead
        crumbGroup="Finance"
        title="Partner Hub"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={hub.isFetching ? 'syncing…' : `${partners.length} partners`}
        syncing={hub.isFetching}
        onSync={() => {
          void hub.refetch()
          void txs.refetch()
        }}
        actions={[
          {
            label: 'Export hisab',
            icon: 'icon-download',
            onClick: exportHisab,
          },
          {
            label: 'New transaction',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: scrollToWrites,
          },
        ]}
      />

      <div id="partner-tx" className="dc-partner-write-host">
        <PartnerHubPage
          moduleHref="/dashboard/finance/partner-accounts"
          navItem={
            getNavItemByHref('/dashboard/finance/partner-accounts') ?? {
              label: 'Partner Hub',
              href: '/dashboard/finance/partner-accounts',
              icon: 'Users',
              group: 'Finance',
            }
          }
        />
      </div>
    </>
  )
}

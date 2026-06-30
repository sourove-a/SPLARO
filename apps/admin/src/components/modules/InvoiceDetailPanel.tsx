'use client'

import toast from 'react-hot-toast'
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { InvoiceActionsBar } from '@/components/modules/InvoiceActionsBar'
import { STATUS_CLASS, formatBDT } from '@/components/modules/ModulePanelShell'
import { useInvoices } from '@/lib/api/hooks'
import type { ApiInvoiceRow } from '@/lib/api/commerce-finance'
import { useAdminNavigate } from '@/lib/navigation/client-nav'

const INVOICE_STATUSES: ApiInvoiceRow['status'][] = ['draft', 'sent', 'paid', 'overdue']

interface InvoiceDetailPanelProps {
  recordId: string
  moduleHref: string
}

export function InvoiceDetailPanel({ recordId, moduleHref }: InvoiceDetailPanelProps) {
  const { navigate } = useAdminNavigate()
  const { data: rows = [], isLoading, isError, refetch } = useInvoices()

  const invoice = rows.find(
    (row) => row.invoiceNumber === recordId || row.id === recordId || row.orderId === recordId,
  )

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm font-semibold text-[var(--admin-text-secondary)]">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading invoice…
      </div>
    )
  }

  if (isError || !invoice) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
          Invoice not found or API unavailable.
        </p>
        <AdminButton variant="ghost" onClick={() => navigate(moduleHref)}>
          <ArrowLeft className="h-4 w-4" />
          Back to invoices
        </AdminButton>
      </div>
    )
  }

  const handleStatusChange = (next: ApiInvoiceRow['status']) => {
    toast(
      `Invoice status is synced from order payment (${next}). Open the linked order to change payment state.`,
      { icon: 'ℹ️', style: { borderRadius: '14px', fontWeight: 600 } },
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminButton variant="ghost" onClick={() => navigate(moduleHref)}>
          <ArrowLeft className="h-4 w-4" />
          Back to invoices
        </AdminButton>
        <AdminButton onClick={() => void refetch()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </AdminButton>
      </div>

      <div className="admin-module-card relative z-[1]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="admin-kpi__label">Invoice</p>
            <h2 className="font-mono text-lg font-black text-[var(--admin-text)]">{invoice.invoiceNumber}</h2>
            <span className={`${STATUS_CLASS[invoice.status]} mt-2 capitalize`}>{invoice.status}</span>
          </div>
          <AdminButton variant="gold" onClick={() => navigate(`/dashboard/orders/${invoice.orderId}`)}>
            <ExternalLink className="h-4 w-4" />
            Open order
          </AdminButton>
        </div>

        <div className="relative z-[1] mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="admin-kpi__label">Customer</span>
            <input readOnly value={invoice.customer} className="admin-input" />
          </label>
          <label className="block space-y-1.5">
            <span className="admin-kpi__label">Amount</span>
            <input readOnly value={formatBDT(invoice.amount)} className="admin-input" />
          </label>
          <label className="block space-y-1.5">
            <span className="admin-kpi__label">Status</span>
            <select
              value={invoice.status}
              onChange={(e) => handleStatusChange(e.target.value as ApiInvoiceRow['status'])}
              className="admin-input"
            >
              {INVOICE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="admin-kpi__label">Issued</span>
            <input readOnly value={invoice.issued} className="admin-input" />
          </label>
          <label className="block space-y-1.5">
            <span className="admin-kpi__label">Due</span>
            <input readOnly value={invoice.due} className="admin-input" />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="admin-kpi__label">Order reference</span>
            <input readOnly value={invoice.orderId} className="admin-input font-mono text-xs" />
          </label>
        </div>
      </div>

      <InvoiceActionsBar orderId={invoice.orderId} invoiceNumber={invoice.invoiceNumber} />
    </div>
  )
}

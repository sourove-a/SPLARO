'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState, type CSSProperties, type ReactNode } from 'react'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import {
  approveExpense,
  createExpense,
  fetchExpenses,
  rejectExpense,
  updateExpense,
  type ExpenseRow,
} from '@/lib/api/finance'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const CATEGORY_LABELS: Record<string, string> = {
  INVENTORY_PURCHASE: 'Inventory',
  PACKAGING: 'Packaging',
  COURIER: 'Courier',
  ADVERTISING: 'Advertising',
  SALARY: 'Salary',
  OFFICE: 'Office',
  ELECTRICITY: 'Electricity',
  INTERNET: 'Internet',
  SOFTWARE: 'Software',
  EQUIPMENT: 'Equipment',
  PHOTOGRAPHY: 'Photography',
  REFUND_LOSS: 'Refund',
  RETURN_LOSS: 'Return loss',
  PAYMENT_FEES: 'Payment fees',
  TAX: 'Tax',
  MISC: 'Misc',
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  BANK: 'Bank',
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  CARD: 'Card',
  OTHER: 'Other',
}

const STATUS_TONE: Record<string, DcTone> = {
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'bad',
}

const DEFAULT_CATEGORIES = Object.keys(CATEGORY_LABELS)
const DEFAULT_METHODS = Object.keys(PAYMENT_LABELS)

type Draft = {
  category: string
  amount: string
  expenseDate: string
  vendor: string
  paymentMethod: string
  note: string
  attachmentUrl: string
  recurring: boolean
}

const emptyDraft = (): Draft => ({
  category: 'MISC',
  amount: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  vendor: '',
  paymentMethod: 'CASH',
  note: '',
  attachmentUrl: '',
  recurring: false,
})

export function DcExpenses() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="finance" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcExpensesBody />
    </DcScreenProvider>
  )
}

function DcExpensesBody() {
  const router = useRouter()
  const qc = useQueryClient()
  const { api } = useAdminConnection(25_000)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)

  const list = useQuery({
    queryKey: ['finance-expenses', page, status],
    queryFn: () =>
      fetchExpenses(page, {
        limit: '25',
        ...(status ? { status } : {}),
      }),
    staleTime: 20_000,
    retry: 1,
  })

  const categories = list.data?.categories?.length ? list.data.categories : DEFAULT_CATEGORIES
  const methods = list.data?.paymentMethods?.length ? list.data.paymentMethods : DEFAULT_METHODS
  const rows = list.data?.items ?? []
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 25))
  const pageStatus = dcPageStatus([list], api.pulse)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['finance-expenses'] })

  const createMut = useMutation({
    mutationFn: () =>
      createExpense({
        category: draft.category,
        amount: Number(draft.amount),
        expenseDate: draft.expenseDate,
        vendor: draft.vendor || undefined,
        paymentMethod: draft.paymentMethod || undefined,
        note: draft.note || undefined,
        attachmentUrl: draft.attachmentUrl || undefined,
        recurring: draft.recurring,
        createdBy: 'admin',
      }),
    onSuccess: (created) => {
      if (Number(created.amount) !== Number(draft.amount)) {
        toastFail('Server amount did not match what was sent.')
        return
      }
      toastOk('Expense recorded — pending approval.')
      setDraft(emptyDraft())
      void invalidate()
    },
    onError: (err) => toastFail(err instanceof Error ? err.message : 'Could not create expense.'),
  })

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error('Nothing to update')
      return updateExpense(editingId, {
        category: draft.category,
        amount: Number(draft.amount),
        expenseDate: draft.expenseDate,
        vendor: draft.vendor || null,
        paymentMethod: draft.paymentMethod || null,
        note: draft.note || null,
        attachmentUrl: draft.attachmentUrl || null,
        recurring: draft.recurring,
      })
    },
    onSuccess: () => {
      toastOk('Pending expense updated.')
      setEditingId(null)
      setDraft(emptyDraft())
      void invalidate()
    },
    onError: (err) => toastFail(err instanceof Error ? err.message : 'Could not update expense.'),
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => approveExpense(id, 'admin'),
    onSuccess: () => {
      toastOk('Expense approved.')
      void invalidate()
      void qc.invalidateQueries({ queryKey: ['finance-overview'] })
    },
    onError: (err) => toastFail(err instanceof Error ? err.message : 'Approve failed.'),
  })

  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectExpense(id, 'admin'),
    onSuccess: () => {
      toastOk('Expense rejected.')
      void invalidate()
    },
    onError: (err) => toastFail(err instanceof Error ? err.message : 'Reject failed.'),
  })

  const skeleton: DcBlock[] = [
    { t: 'form' } as DcBlock,
    { t: 'table', w: 'main', title: '', cols: [], rows: [] } as DcBlock,
  ]

  const startEdit = (row: ExpenseRow) => {
    setEditingId(row.id)
    setDraft({
      category: row.category,
      amount: String(row.amount),
      expenseDate: String(row.expenseDate).slice(0, 10),
      vendor: row.vendor ?? '',
      paymentMethod: row.paymentMethod ?? 'CASH',
      note: row.note ?? '',
      attachmentUrl: row.attachmentUrl ?? '',
      recurring: Boolean(row.recurring),
    })
  }

  const submit = () => {
    const amount = Number(draft.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toastFail('Amount must be greater than 0.')
      return
    }
    if (editingId) updateMut.mutate()
    else createMut.mutate()
  }

  const busy = createMut.isPending || updateMut.isPending

  return (
    <>
      <DcPageHead
        crumbGroup="Finance"
        title="Expenses"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={list.isFetching ? 'syncing…' : `${list.data?.total ?? 0} records`}
        syncing={list.isFetching}
        actions={[
          {
            label: 'Profit & Cash Flow',
            icon: 'icon-file-bar-chart',
            variant: 'ghost',
            onClick: () => router.push('/dashboard/finance/finance-reports'),
          },
        ]}
      />

      <div style={{ ...card, padding: 16, marginBottom: 16 }}>
        <div style={{ font: `600 13.5px/1 ${FONT}`, marginBottom: 12 }}>
          {editingId ? 'Edit pending expense' : 'New expense'}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
          }}
        >
          <Field label="Category">
            <select
              className="admin-input"
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c] ?? c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount (৳)">
            <input
              className="admin-input"
              type="number"
              min="0"
              step="0.01"
              value={draft.amount}
              onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
            />
          </Field>
          <Field label="Date">
            <input
              className="admin-input"
              type="date"
              value={draft.expenseDate}
              onChange={(e) => setDraft((d) => ({ ...d, expenseDate: e.target.value }))}
            />
          </Field>
          <Field label="Vendor">
            <input
              className="admin-input"
              value={draft.vendor}
              onChange={(e) => setDraft((d) => ({ ...d, vendor: e.target.value }))}
            />
          </Field>
          <Field label="Payment method">
            <select
              className="admin-input"
              value={draft.paymentMethod}
              onChange={(e) => setDraft((d) => ({ ...d, paymentMethod: e.target.value }))}
            >
              {methods.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_LABELS[m] ?? m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Receipt URL">
            <input
              className="admin-input"
              value={draft.attachmentUrl}
              onChange={(e) => setDraft((d) => ({ ...d, attachmentUrl: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Note" style={{ marginTop: 10 }}>
          <input
            className="admin-input"
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          />
        </Field>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, font: `500 13px/1 ${FONT}` }}>
          <input
            type="checkbox"
            checked={draft.recurring}
            onChange={(e) => setDraft((d) => ({ ...d, recurring: e.target.checked }))}
          />
          Recurring
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            style={{
              border: 0,
              borderRadius: 10,
              padding: '10px 14px',
              background: 'var(--ink)',
              color: 'var(--paper)',
              font: `600 12.5px/1 ${FONT}`,
              cursor: 'pointer',
            }}
          >
            {busy ? 'Saving…' : editingId ? 'Update expense' : 'Create expense'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setDraft(emptyDraft())
              }}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: '10px 14px',
                background: 'var(--surface)',
                font: `600 12.5px/1 ${FONT}`,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['', 'PENDING', 'APPROVED', 'REJECTED'].map((s) => {
          const active = status === s
          return (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => {
                setStatus(s)
                setPage(1)
              }}
              style={{
                border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                background: active ? 'var(--ink)' : 'var(--surface)',
                color: active ? 'var(--paper)' : 'var(--ink-2)',
                borderRadius: 999,
                padding: '7px 11px',
                font: `600 12px/1 ${FONT}`,
                cursor: 'pointer',
              }}
            >
              {s || 'All'}
            </button>
          )
        })}
      </div>

      {list.error ? (
        <DcErrorState
          error={`GET /expenses → ${list.error instanceof Error ? list.error.message : 'failed'}`}
          hint="Nothing was saved. Retry when the API is up."
          onRetry={() => void list.refetch()}
        />
      ) : list.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : rows.length === 0 ? (
        <DcEmptyState
          icon="icon-receipt"
          title="No expenses yet"
          body="Create one above — it stays pending until you approve it."
        />
      ) : (
        <div style={{ ...card, overflow: 'auto' }}>
          <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Category', 'Vendor', 'Amount', 'Pay', 'Status', ''].map((h) => (
                  <th
                    key={h || 'actions'}
                    style={{
                      textAlign: 'left',
                      padding: '9px 12px',
                      font: `600 10.5px/1 ${FONT}`,
                      letterSpacing: '.09em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-3)',
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={cell}>{String(row.expenseDate).slice(0, 10)}</td>
                  <td style={cell}>
                    {CATEGORY_LABELS[row.category] ?? row.category}
                    {row.recurring ? ' · rec' : ''}
                  </td>
                  <td style={cell}>{row.vendor || '—'}</td>
                  <td style={{ ...cell, font: `600 13px/1 ${MONO}` }}>{formatTaka(Number(row.amount))}</td>
                  <td style={cell}>{row.paymentMethod ? PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod : '—'}</td>
                  <td style={cell}>
                    <span
                      style={{
                        ...toneStyle(STATUS_TONE[row.status] ?? 'mute'),
                        borderRadius: 999,
                        padding: '4px 8px',
                        font: `600 11px/1 ${FONT}`,
                      }}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td style={cell}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {row.status === 'PENDING' ? (
                        <>
                          <button type="button" className="admin-input" onClick={() => startEdit(row)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="admin-input"
                            disabled={approveMut.isPending}
                            onClick={() => approveMut.mutate(row.id)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="admin-input"
                            disabled={rejectMut.isPending}
                            onClick={() => rejectMut.mutate(row.id)}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 ? (
            <div style={{ display: 'flex', gap: 8, padding: 12, justifyContent: 'flex-end' }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="admin-input">
                Prev
              </button>
              <span style={{ font: `600 12px/2 ${FONT}`, color: 'var(--ink-3)' }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="admin-input"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}

const cell = {
  padding: '10px 12px',
  font: `500 13px/1.3 ${FONT}`,
  color: 'var(--ink)',
  borderBottom: '1px solid var(--line)',
  verticalAlign: 'top' as const,
}

function Field({
  label,
  children,
  style,
}: {
  label: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <label style={{ display: 'grid', gap: 4, font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)', ...style }}>
      {label}
      {children}
    </label>
  )
}

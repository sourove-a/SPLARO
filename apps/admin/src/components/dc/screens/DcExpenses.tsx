'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import { downloadCsv } from '@/lib/admin/admin-actions'
import {
  approveExpense,
  createExpense,
  fetchExpenses,
  rejectExpense,
  updateExpense,
  type ExpenseRow,
} from '@/lib/api/finance'
import { uploadAdminImage } from '@/lib/api/upload'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import {
  financeGhostBtn,
  financePagerBtn,
  financePeriodPill,
  financePrimaryBtn,
} from '@/components/dc/screens/finance-ui'

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

const RECEIPT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf'
const RECEIPT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])

const DEFAULT_CATEGORIES = Object.keys(CATEGORY_LABELS)
const DEFAULT_METHODS = Object.keys(PAYMENT_LABELS)

function localDateInputValue(date = new Date()): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

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
  expenseDate: localDateInputValue(),
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
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

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

  const uploadReceipt = async (file: File) => {
    if (file.type && !RECEIPT_TYPES.has(file.type)) {
      toastFail('Receipts must be JPG, PNG, WebP, GIF or PDF.')
      return
    }
    setUploadingReceipt(true)
    try {
      const uploaded = await uploadAdminImage(file, 'expenses', { pipeline: false, optimize: true })
      const stored = uploaded.r2Url || uploaded.publicUrl || uploaded.url
      if (!stored) throw new Error('Upload failed')
      setDraft((d) => ({ ...d, attachmentUrl: stored }))
      if (uploaded.r2Url) toastOk('Receipt uploaded to R2.')
      else toastWarn('Receipt stored on this server — R2 sync unavailable.')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Receipt upload failed.')
    } finally {
      setUploadingReceipt(false)
    }
  }

  const busy = createMut.isPending || updateMut.isPending

  const approvedTotal = rows.filter((r) => r.status === 'APPROVED').reduce((s, r) => s + Number(r.amount || 0), 0)
  const pendingTotal = rows.filter((r) => r.status === 'PENDING').reduce((s, r) => s + Number(r.amount || 0), 0)

  const exportCsv = () => {
    if (rows.length === 0) {
      toastWarn('No expense records to export')
      return
    }
    const headers = [
      'Date',
      'Category',
      'Vendor',
      'Amount (BDT)',
      'Payment Method',
      'Status',
      'Note',
      'Receipt URL',
      'Recurring',
    ]
    const csvRows = [
      headers,
      ...rows.map((r) => [
        String(r.expenseDate).slice(0, 10),
        CATEGORY_LABELS[r.category] ?? r.category,
        r.vendor || '—',
        String(r.amount),
        r.paymentMethod ? PAYMENT_LABELS[r.paymentMethod] ?? r.paymentMethod : '—',
        r.status,
        r.note || '',
        r.attachmentUrl || '',
        r.recurring ? 'Yes' : 'No',
      ]),
    ]
    downloadCsv(`splaro-expenses-${localDateInputValue()}.csv`, csvRows)
    toastOk(`Exported ${rows.length} expense records`)
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Finance"
        title="Expenses"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={list.isFetching ? 'syncing…' : `${list.data?.total ?? 0} records`}
        syncing={list.isFetching}
        onSync={() => void list.refetch()}
        actions={[
          {
            label: 'Profit & Cash Flow',
            icon: 'icon-file-bar-chart',
            onClick: () => router.push('/dashboard/finance/finance-reports'),
          },
          {
            label: 'Export CSV',
            icon: 'icon-download',
            onClick: exportCsv,
          },
        ]}
      />

      {rows.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ ...card, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              Approved Expenses
            </span>
            <span style={{ font: `700 21px/1 ${MONO}`, color: 'var(--ink)' }}>
              {formatTaka(approvedTotal)}
            </span>
            <span style={{ font: `400 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>hitting current accounts</span>
          </div>

          <div style={{ ...card, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              Pending Approval
            </span>
            <span style={{ font: `700 21px/1 ${MONO}`, color: pendingTotal > 0 ? 'var(--warn)' : 'var(--ink)' }}>
              {formatTaka(pendingTotal)}
            </span>
            <span style={{ font: `400 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>awaiting owner sign-off</span>
          </div>

          <div style={{ ...card, padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: `600 11px/1 ${FONT}`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              Total Records
            </span>
            <span style={{ font: `700 21px/1 ${MONO}`, color: 'var(--ink)' }}>
              {list.data?.total ?? 0}
            </span>
            <span style={{ font: `400 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>all recorded entries</span>
          </div>
        </div>
      ) : null}

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
          <div style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
            <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>Receipt</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                disabled={uploadingReceipt || busy}
                onClick={() => receiptInputRef.current?.click()}
                style={financeGhostBtn}
              >
                {uploadingReceipt ? 'Uploading…' : 'Upload image / PDF'}
              </button>
              <input
                ref={receiptInputRef}
                type="file"
                accept={RECEIPT_ACCEPT}
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void uploadReceipt(file)
                }}
              />
              {draft.attachmentUrl ? (
                <>
                  <a
                    href={draft.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ font: `600 12.5px/1 ${FONT}`, color: 'var(--violet)' }}
                  >
                    View receipt
                  </a>
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, attachmentUrl: '' }))}
                    style={financeGhostBtn}
                  >
                    Clear
                  </button>
                </>
              ) : null}
            </div>
            <input
              className="admin-input"
              placeholder="Or paste a URL"
              value={draft.attachmentUrl}
              onChange={(e) => setDraft((d) => ({ ...d, attachmentUrl: e.target.value }))}
            />
          </div>
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
            style={financePrimaryBtn}
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
              style={financeGhostBtn}
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
              style={financePeriodPill(active)}
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
        <>
          <div className="dc-mobile-route-panel" aria-label="Expenses">
            <div className="dc-mobile-list">
              {rows.map((row) => {
                const tone = toneStyle(STATUS_TONE[row.status] ?? 'mute')
                return (
                  <div key={row.id} style={{ display: 'grid', gap: 8 }}>
                    <article className="dc-mobile-list-card dc-mobile-list-card--static">
                      <span className="dc-mobile-list-card__icon" style={{ background: tone.bg, color: tone.fg }}>
                        <DcIcon name="icon-receipt" size={15} />
                      </span>
                      <span className="dc-mobile-list-card__copy">
                        <span className="dc-mobile-list-card__title">
                          {CATEGORY_LABELS[row.category] ?? row.category}
                          {row.vendor ? ` · ${row.vendor}` : ''}
                        </span>
                        <span className="dc-mobile-list-card__sub">
                          {String(row.expenseDate).slice(0, 10)} · {row.status}
                          {row.paymentMethod
                            ? ` · ${PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod}`
                            : ''}
                          {row.recurring ? ' · recurring' : ''}
                        </span>
                      </span>
                      <span className="dc-mobile-list-card__value">{formatTaka(Number(row.amount))}</span>
                    </article>
                    {row.status === 'PENDING' ? (
                      <ExpenseRowActions
                        row={row}
                        onEdit={startEdit}
                        onApprove={() => approveMut.mutate(row.id)}
                        onReject={() => rejectMut.mutate(row.id)}
                        approvePending={approveMut.isPending}
                        rejectPending={rejectMut.isPending}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
            <ExpensePagination page={page} totalPages={totalPages} onPage={setPage} />
          </div>

          <div className="dc-desktop-route-panel">
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
                      <td style={cell}>
                        {row.paymentMethod ? PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod : '—'}
                      </td>
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
                        {row.status === 'PENDING' ? (
                          <ExpenseRowActions
                            row={row}
                            onEdit={startEdit}
                            onApprove={() => approveMut.mutate(row.id)}
                            onReject={() => rejectMut.mutate(row.id)}
                            approvePending={approveMut.isPending}
                            rejectPending={rejectMut.isPending}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ExpensePagination page={page} totalPages={totalPages} onPage={setPage} />
            </div>
          </div>
        </>
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

function ExpenseRowActions({
  row,
  onEdit,
  onApprove,
  onReject,
  approvePending,
  rejectPending,
}: {
  row: ExpenseRow
  onEdit: (row: ExpenseRow) => void
  onApprove: () => void
  onReject: () => void
  approvePending: boolean
  rejectPending: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <button type="button" style={financeGhostBtn} onClick={() => onEdit(row)}>
        Edit
      </button>
      <button type="button" style={financeGhostBtn} disabled={approvePending} onClick={onApprove}>
        Approve
      </button>
      <button type="button" style={financeGhostBtn} disabled={rejectPending} onClick={onReject}>
        Reject
      </button>
    </div>
  )
}

function ExpensePagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display: 'flex', gap: 8, padding: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} style={financePagerBtn(page <= 1)}>
        Prev
      </button>
      <span style={{ font: `600 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        style={financePagerBtn(page >= totalPages)}
      >
        Next
      </button>
    </div>
  )
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

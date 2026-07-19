'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { MessageSquareQuote, Star } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { ModulePanelShell } from '@/components/modules/ModulePanelShell'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import {
  deleteReview,
  fetchReviews,
  updateReviewReply,
  updateReviewStatus,
  type ApiReview,
  type ReviewStatus,
} from '@/lib/api/reviews'
import { revalidateWebCache } from '@/lib/api/revalidate'
import { downloadCsv } from '@/lib/admin/admin-actions'
import { toastOk, toastFail, toastApiSaved } from '@/lib/admin/feedback'
import { verifyPersisted, verifyStringEquals } from '@/lib/admin/mutation-verify'
import { cn } from '@/lib/utils/cn'

const STATUS_TABS: { key: ReviewStatus | 'ALL'; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'ALL', label: 'All' },
]

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[#16181d]">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn('h-3 w-3', i < rating ? 'fill-current' : 'opacity-25')}
          strokeWidth={1.5}
        />
      ))}
    </span>
  )
}

export function ProductReviewsPanel() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ReviewStatus | 'ALL'>('PENDING')
  const [rows, setRows] = useState<ApiReview[]>([])
  const [loading, setLoading] = useState(true)
  const [replyId, setReplyId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  const [loadError, setLoadError] = useState(false)

  const load = () => {
    setLoading(true)
    setLoadError(false)
    fetchReviews({ limit: 200 })
      .then((data) => setRows(data.reviews ?? []))
      .catch(() => {
        setRows([])
        setLoadError(true)
        toastFail('Could not load reviews — check API connection.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter((row) => {
      if (status !== 'ALL' && row.status !== status) return false
      if (!q) return true
      const product = row.product?.name?.toLowerCase() ?? ''
      const customer = `${row.customer?.firstName ?? ''} ${row.customer?.lastName ?? ''}`.toLowerCase()
      const body = `${row.title ?? ''} ${row.body ?? ''}`.toLowerCase()
      return product.includes(q) || customer.includes(q) || body.includes(q)
    })
  }, [query, rows, status])

  const counts = useMemo(() => ({
    pending: rows.filter((r) => r.status === 'PENDING').length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    rejected: rows.filter((r) => r.status === 'REJECTED').length,
  }), [rows])

  const exportReviews = () => {
    if (!filtered.length) {
      toastFail('Nothing to export — adjust your filters.')
      return
    }
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`splaro-reviews-${date}.csv`, [
      ['Product', 'Customer', 'Rating', 'Title', 'Review', 'Status', 'Date'],
      ...filtered.map((row) => [
        row.product?.name ?? '—',
        `${row.customer?.firstName ?? ''} ${row.customer?.lastName ?? ''}`.trim() || 'Guest',
        String(row.rating),
        row.title ?? '',
        row.body ?? '',
        row.status,
        row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : '',
      ]),
    ])
    toastOk(`Exported ${filtered.length} review${filtered.length === 1 ? '' : 's'}.`)
  }

  const setStatusAction = async (id: string, next: 'APPROVED' | 'REJECTED' | 'PENDING') => {
    try {
      const updated = await updateReviewStatus(id, next)
      if (!verifyPersisted(updated.status === next, 'Review status did not persist on server')) return
      void revalidateWebCache(['storefront-products'])
      if (next === 'APPROVED') {
        toastOk('Review approved — live on storefront.')
      } else {
        toastApiSaved(`Review marked ${next.toLowerCase()}`)
      }
      load()
    } catch {
      toastFail('Could not update review status.')
    }
  }

  const remove = async (id: string) => {
    try {
      const result = await deleteReview(id)
      if (!verifyPersisted(result.deleted === true, 'Review delete did not persist on server')) return
      void revalidateWebCache(['storefront-products'])
      toastApiSaved('Review')
      load()
    } catch {
      toastFail('Could not delete review.')
    }
  }

  const openReply = (row: ApiReview) => {
    setReplyId(row.id)
    setReplyText(row.adminReply ?? '')
  }

  const saveReply = async (id: string) => {
    const nextReply = replyText.trim() || null
    try {
      const updated = await updateReviewReply(id, nextReply)
      if (!verifyStringEquals(updated.adminReply ?? '', nextReply ?? '', 'Official reply')) return
      void revalidateWebCache(['storefront-products'])
      toastApiSaved(nextReply ? 'Official reply' : 'Reply removal')
      setReplyId(null)
      setReplyText('')
      load()
    } catch {
      toastFail('Could not save reply.')
    }
  }

  return (
    <div className="space-y-5">
      <section className="admin-module-card admin-module-card--accent">
        <h3 className="admin-module-card__title mb-1">Customer reviews moderation</h3>
        <p className="admin-module-card__subtitle">
          Storefront এ শুধু <strong>Approved</strong> রিভিউ দেখায়। Guest দেখতে পারে, লিখতে হলে account লাগে।
          ছবি upload নেই — শুধু text review।
        </p>
      </section>

      {loadError ? (
        <ApiOfflineBanner message="Reviews API offline — run pnpm dev:api on port 4000, then refresh." />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatus(tab.key)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-black transition',
              status === tab.key
                ? 'border-[#16181d] bg-[#16181d]/15 text-[#16181d]'
                : 'border-white/10 text-[var(--admin-text-secondary)] hover:border-white/20',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ModulePanelShell
        kpis={[
          ['Pending', String(counts.pending), 'warning'],
          ['Approved', String(counts.approved), 'success'],
          ['Rejected', String(counts.rejected), 'default'],
          ['Showing', String(filtered.length), 'gold'],
        ]}
        pipeline={[
          ['Pending', counts.pending],
          ['Approved', counts.approved],
          ['Rejected', counts.rejected],
        ]}
        query={query}
        onQuery={setQuery}
        searchPlaceholder="Search product, customer, review text..."
        createLabel="Refresh queue"
        onCreate={load}
        onRefresh={load}
        onExport={exportReviews}
        tableIcon={MessageSquareQuote}
        tableTitle={`Reviews · ${filtered.length} results`}
        footer={loading ? 'Loading…' : `Moderate reviews before they appear on product pages`}
      >
        {filtered.length === 0 && !loading ? (
          <p className="p-4 text-sm text-[var(--admin-text-muted)]">
            No reviews in this filter. Customer submissions land here as <strong>Pending</strong>.
          </p>
        ) : (
          <table className="admin-module-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Customer</th>
                <th>Rating</th>
                <th>Review</th>
                <th>Status</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td>
                      <p className="text-sm font-black text-[var(--admin-text-primary)]">{row.product?.name ?? '—'}</p>
                      <p className="text-[10px] font-mono text-[var(--admin-text-muted)]">{row.product?.slug}</p>
                    </td>
                    <td>
                      <p className="text-sm font-bold">
                        {row.customer
                          ? `${row.customer.firstName} ${row.customer.lastName}`
                          : 'Guest'}
                      </p>
                      {row.verifiedPurchase && (
                        <span className="text-[10px] font-black uppercase tracking-wide text-emerald-400">
                          Verified purchase
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Stars rating={row.rating} />
                        <span className="text-xs font-black">{row.rating}</span>
                      </div>
                      {row.helpfulCount > 0 && (
                        <p className="text-[10px] text-[var(--admin-text-muted)]">{row.helpfulCount} helpful</p>
                      )}
                    </td>
                    <td className="max-w-xs">
                      {row.title && <p className="text-xs font-black">{row.title}</p>}
                      <p className="line-clamp-3 text-xs text-[var(--admin-text-secondary)]">{row.body}</p>
                      {row.adminReply && (
                        <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-[#16181d]">
                          Reply: {row.adminReply}
                        </p>
                      )}
                    </td>
                    <td>
                      <span
                        className={cn(
                          'admin-status',
                          row.status === 'APPROVED' && 'admin-status--delivered',
                          row.status === 'PENDING' && 'admin-status--pending',
                          row.status === 'REJECTED' && 'admin-status--cancelled',
                        )}
                      >
                        {row.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="text-xs text-[var(--admin-text-muted)]">
                      {new Date(row.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="space-x-2 whitespace-nowrap">
                      {row.status !== 'APPROVED' && (
                        <AdminButton variant="ghost" onClick={() => void setStatusAction(row.id, 'APPROVED')}>
                          Approve
                        </AdminButton>
                      )}
                      {row.status !== 'REJECTED' && (
                        <AdminButton variant="ghost" onClick={() => void setStatusAction(row.id, 'REJECTED')}>
                          Reject
                        </AdminButton>
                      )}
                      <AdminButton variant="ghost" onClick={() => openReply(row)}>
                        Reply
                      </AdminButton>
                      <AdminButton variant="ghost" onClick={() => void remove(row.id)}>
                        Delete
                      </AdminButton>
                    </td>
                  </tr>
                  {replyId === row.id && (
                    <tr key={`${row.id}-reply`}>
                      <td colSpan={7} className="bg-[rgba(16, 17, 20, 0.06)] p-4">
                        <p className="mb-2 text-xs font-black text-[var(--admin-text-primary)]">
                          Official SPLARO reply (Bangla or English)
                        </p>
                        <textarea
                          className="admin-input min-h-[88px] w-full"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="ধন্যবাদ — আমরা আপনার ফিডব্যাক মূল্যায়ন করছি…"
                          maxLength={800}
                        />
                        <div className="mt-2 flex gap-2">
                          <AdminButton variant="gold" onClick={() => void saveReply(row.id)}>
                            Save reply
                          </AdminButton>
                          <AdminButton variant="ghost" onClick={() => { setReplyId(null); setReplyText('') }}>
                            Cancel
                          </AdminButton>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </ModulePanelShell>
    </div>
  )
}

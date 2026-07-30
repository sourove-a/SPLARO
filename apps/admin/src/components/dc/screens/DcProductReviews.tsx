'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastApiSaved, toastFail, toastOk } from '@/lib/admin/feedback'
import { verifyPersisted } from '@/lib/admin/mutation-verify'
import {
  deleteReview,
  fetchReviews,
  updateReviewStatus,
  type ApiReview,
} from '@/lib/api/reviews'
import { revalidateWebCache } from '@/lib/api/revalidate'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `600 11px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

const STATUS_TONE: Record<string, DcTone> = {
  PENDING: 'warn',
  FLAGGED: 'bad',
  APPROVED: 'ok',
  REJECTED: 'mute',
}

function customerLine(r: ApiReview): string {
  const name = r.customer
    ? `${r.customer.firstName} ${r.customer.lastName}`.trim()
    : 'Anonymous'
  const verified = r.verifiedPurchase ? 'verified buyer' : 'unverified · no order match'
  return `${name || 'Anonymous'} · ${verified}`
}

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

export function DcProductReviews() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="reviews" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcProductReviewsBody />
    </DcScreenProvider>
  )
}

function DcProductReviewsBody() {
  const qc = useQueryClient()
  const [deleting, setDeleting] = useState<ApiReview | null>(null)
  const [busy, setBusy] = useState(false)

  // One unfiltered read
  const reviews = useQuery({
    queryKey: ['reviews', 'all'],
    queryFn: () => fetchReviews({ limit: 200 }),
    staleTime: 30_000,
  })
  const { api } = useAdminConnection(25_000)

  const all = useMemo(() => reviews.data?.reviews ?? [], [reviews.data])

  const queue = useMemo(
    () => all.filter((r) => r.status === 'PENDING' || r.status === 'FLAGGED'),
    [all],
  )
  const published = useMemo(() => all.filter((r) => r.status === 'APPROVED'), [all])
  const flagged = useMemo(() => all.filter((r) => r.status === 'FLAGGED'), [all])

  const oldestWaiting = useMemo(() => {
    if (queue.length === 0) return null
    return queue.reduce((oldest, r) =>
      new Date(r.createdAt) < new Date(oldest.createdAt) ? r : oldest,
    )
  }, [queue])

  const productCount = useMemo(
    () => new Set(published.map((r) => r.productId)).size,
    [published],
  )

  const avgRating = useMemo(() => {
    if (published.length === 0) return null
    const sum = published.reduce((t, r) => t + r.rating, 0)
    return Math.round((sum / published.length) * 10) / 10
  }, [published])

  const spread = useMemo(() => {
    const buckets = [
      { label: '5 stars', match: (n: number) => n === 5, tone: 'ok' as DcTone },
      { label: '4 stars', match: (n: number) => n === 4, tone: 'ok' as DcTone },
      { label: '3 stars', match: (n: number) => n === 3, tone: 'warn' as DcTone },
      { label: '2 stars and below', match: (n: number) => n <= 2, tone: 'bad' as DcTone },
    ]
    return buckets.map((b) => {
      const count = published.filter((r) => b.match(r.rating)).length
      return {
        ...b,
        count,
        share: published.length > 0 ? Math.round((count / published.length) * 100) : 0,
      }
    })
  }, [published])

  const afterWrite = () => {
    void qc.invalidateQueries({ queryKey: ['reviews'] })
    void revalidateWebCache(['storefront-products'])
  }

  const runModerate = async (id: string, next: 'APPROVED' | 'REJECTED') => {
    setBusy(true)
    try {
      const updated = await updateReviewStatus(id, next)
      if (!verifyPersisted(updated.status === next, 'Review status did not persist on server')) return
      afterWrite()
      if (next === 'APPROVED') {
        toastOk('Review approved — live on storefront.')
      } else {
        toastApiSaved('Review marked rejected')
      }
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not update review status.')
    } finally {
      setBusy(false)
    }
  }

  const runDelete = async (id: string) => {
    setBusy(true)
    try {
      const result = await deleteReview(id)
      if (!verifyPersisted(result.deleted === true, 'Review delete did not persist on server')) return
      setDeleting(null)
      afterWrite()
      toastApiSaved('Review deleted')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not delete review.')
    } finally {
      setBusy(false)
    }
  }

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'cards', cardMin: '340px', items: [] } as DcBlock,
    { t: 'list', title: '', items: [] } as DcBlock,
  ]

  const pageStatus = dcPageStatus([reviews], api.pulse)

  return (
    <>
      <DcPageHead
        crumbGroup="Catalog"
        title="Product Reviews"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          reviews.isFetching ? 'syncing…' : `${all.length} review${all.length === 1 ? '' : 's'}`
        }
        syncing={reviews.isFetching}
        onSync={() => void reviews.refetch()}
      />

      {reviews.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : reviews.error ? (
        <DcErrorState
          error={`GET /admin/reviews → ${reviews.error instanceof Error ? reviews.error.message : '500 Internal Server Error'}`}
          hint="Published reviews on the storefront are unaffected — only this view failed to load."
          onRetry={() => void reviews.refetch()}
        />
      ) : all.length === 0 ? (
        <DcEmptyState
          icon="icon-message-square-quote"
          title="No reviews yet"
          body="A review lands here within a minute of being submitted on a product page. Nothing reaches the storefront until it is published."
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi
              label="Awaiting moderation"
              value={String(queue.length)}
              sub={
                oldestWaiting
                  ? `oldest waiting ${daysAgo(oldestWaiting.createdAt)} day${daysAgo(oldestWaiting.createdAt) === 1 ? '' : 's'}`
                  : 'queue is clear'
              }
              color={queue.length > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
            <Kpi
              label="Published"
              value={String(published.length)}
              sub={`on ${productCount} product${productCount === 1 ? '' : 's'}`}
            />
            <Kpi
              label="Average rating"
              value={avgRating != null ? avgRating.toFixed(1) : '—'}
              sub={`of 5 · ${published.length} published`}
              color={avgRating != null && avgRating >= 4 ? 'var(--ok)' : 'var(--ink)'}
            />
            <Kpi
              label="Flagged"
              value={String(flagged.length)}
              sub="held back by moderation"
              color={flagged.length > 0 ? 'var(--bad)' : 'var(--ink)'}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
              Awaiting moderation
            </span>
            {queue.length === 0 ? (
              <div style={{ ...card, padding: '44px 20px', textAlign: 'center' }}>
                <span style={{ font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-3)' }}>
                  Moderation queue is clear. Every review has been actioned.
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                  gap: 12,
                }}
              >
                {queue.map((r) => (
                  <ReviewCard
                    key={r.id}
                    review={r}
                    busy={busy}
                    onPublish={() => void runModerate(r.id, 'APPROVED')}
                    onReject={() => void runModerate(r.id, 'REJECTED')}
                    onDelete={() => setDeleting(r)}
                  />
                ))}
              </div>
            )}
          </div>

          <div style={{ ...card, padding: '6px 16px 10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 0 9px',
              }}
            >
              <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                Rating spread
              </span>
              <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                {published.length} published review{published.length === 1 ? '' : 's'}
              </span>
            </div>
            {spread.map((b) => {
              const t = toneStyle(b.tone)
              return (
                <div
                  key={b.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '10px 0',
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <span
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 28,
                      height: 28,
                      flex: 'none',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-2)',
                      color: t.fg,
                    }}
                  >
                    <DcIcon name="icon-star" size={13} />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <span style={{ font: `500 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                      {b.label}
                    </span>
                    <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
                      {b.count} review{b.count === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span
                    style={{
                      display: 'block',
                      width: 96,
                      height: 5,
                      borderRadius: 99,
                      background: 'var(--surface-3)',
                      overflow: 'hidden',
                      flex: 'none',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        borderRadius: 99,
                        width: `${b.share}%`,
                        background: t.fg,
                      }}
                    />
                  </span>
                  <span
                    style={{
                      flex: 'none',
                      width: 42,
                      textAlign: 'right',
                      font: `600 12.5px/1 ${MONO}`,
                      color: 'var(--ink)',
                    }}
                  >
                    {b.share}%
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <DcModal
        open={deleting !== null}
        title="Delete review permanently?"
        subtitle={
          deleting
            ? `This removes the review for ${deleting.product?.name ?? 'this product'} from the database. It cannot be undone.`
            : undefined
        }
        confirmLabel="Delete permanently"
        danger
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && void runDelete(deleting.id)}
      />
    </>
  )
}

/* ── review card ─────────────────────────────────────────────────── */

function ReviewCard({
  review,
  busy,
  onPublish,
  onReject,
  onDelete,
}: {
  review: ApiReview
  busy: boolean
  onPublish: () => void
  onReject: () => void
  onDelete: () => void
}) {
  const tone = toneStyle(STATUS_TONE[review.status] ?? 'mute')
  const isFlagged = review.status === 'FLAGGED'

  return (
    <div
      style={{
        ...card,
        padding: '14px 15px',
        display: 'flex',
        flexDirection: 'column',
        gap: 11,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          <span
            style={{ font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)', textWrap: 'pretty' }}
          >
            {review.product?.name ?? 'Unknown product'}
          </span>
          <span style={{ font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
            {customerLine(review)}
          </span>
        </span>
        <span
          style={{
            flex: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 8px',
            borderRadius: 6,
            font: `600 10.5px/1 ${FONT}`,
            letterSpacing: '.04em',
            border: `1px solid ${tone.bd}`,
            background: tone.bg,
            color: tone.fg,
            whiteSpace: 'nowrap',
          }}
        >
          {review.status}
        </span>
      </div>

      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <DcIcon
            key={n}
            name="icon-star"
            size={12}
            color={n <= review.rating ? 'var(--warn)' : 'var(--surface-3)'}
          />
        ))}
        <span
          style={{ font: `600 11.5px/1 ${FONT}`, color: 'var(--ink-3)', marginLeft: 5 }}
        >
          {review.rating.toFixed(1)}
        </span>
      </span>

      {review.title ? (
        <span style={{ font: `600 12.5px/1.35 ${FONT}`, color: 'var(--ink)' }}>
          {review.title}
        </span>
      ) : null}

      <p
        style={{
          margin: 0,
          font: `400 12.5px/1.55 ${FONT}`,
          color: 'var(--ink-2)',
          textWrap: 'pretty',
        }}
      >
        {review.body?.trim() || 'No written review — rating only.'}
      </p>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingTop: 2 }}>
        {isFlagged ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid var(--bad-bd)',
                background: 'var(--bad-soft)',
                color: 'var(--bad)',
                cursor: busy ? 'not-allowed' : 'pointer',
                font: `600 11.5px/1 ${FONT}`,
              }}
            >
              Delete
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
                cursor: busy ? 'not-allowed' : 'pointer',
                font: `600 11.5px/1 ${FONT}`,
              }}
            >
              Keep hidden
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onPublish}
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid var(--violet-solid)',
                background: 'var(--violet-solid)',
                color: 'var(--on-violet)',
                cursor: busy ? 'not-allowed' : 'pointer',
                font: `600 11.5px/1 ${FONT}`,
              }}
            >
              Publish
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
                cursor: busy ? 'not-allowed' : 'pointer',
                font: `600 11.5px/1 ${FONT}`,
              }}
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color?: string
}) {
  return (
    <div
      style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span style={capsLabel}>{label}</span>
      <span
        style={{ font: `700 25px/1 ${FONT}`, letterSpacing: '-.025em', color: color ?? 'var(--ink)' }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}

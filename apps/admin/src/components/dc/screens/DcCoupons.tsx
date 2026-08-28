'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcField, DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import {
  verifyBooleanEquals,
  verifyDeleteSuccess,
  verifyStringEquals,
} from '@/lib/admin/mutation-verify'
import {
  createCoupon,
  deleteCoupon,
  fetchCoupons,
  toggleCoupon,
  type ApiCoupon,
} from '@/lib/api/coupons'
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


const TYPE_LABEL: Record<ApiCoupon['type'], string> = {
  PERCENTAGE: '% off',
  FIXED_AMOUNT: 'Flat ৳ off',
  FREE_SHIPPING: 'Free delivery',
  BUY_X_GET_Y: 'Buy X get Y',
}

const DAY = 86_400_000

function localDateInputValue(date = new Date()): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

function couponValue(c: ApiCoupon): string {
  const v = Number(c.value || 0)
  if (c.type === 'PERCENTAGE') return `${v}%`
  if (c.type === 'FREE_SHIPPING') return 'delivery'
  return formatTaka(v)
}

/** Percentage coupons with no ceiling are the classic way to lose money on one big order. */
function isUncapped(c: ApiCoupon): boolean {
  return c.type === 'PERCENTAGE' && (c.maxDiscountAmount === null || Number(c.maxDiscountAmount) <= 0)
}

interface CouponForm {
  code: string
  type: ApiCoupon['type']
  value: string
  minOrderAmount: string
  maxDiscountAmount: string
  usageLimit: string
  expiresAt: string
}

const EMPTY_FORM: CouponForm = {
  code: '',
  type: 'PERCENTAGE',
  value: '',
  minOrderAmount: '',
  maxDiscountAmount: '',
  usageLimit: '',
  expiresAt: '',
}

export function DcCoupons() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="coupons" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcCouponsBody />
    </DcScreenProvider>
  )
}

function DcCouponsBody() {
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const { api } = useAdminConnection(25_000)
  const minExpiryDate = localDateInputValue()

  const coupons = useQuery({
    queryKey: ['coupons'],
    queryFn: fetchCoupons,
    staleTime: 30_000,
    retry: 1,
  })
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['coupons'] })

  const create = useMutation({ mutationFn: createCoupon, onSuccess: invalidate })
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleCoupon(id, isActive),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: deleteCoupon, onSuccess: invalidate })

  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState<ApiCoupon | null>(null)
  const [confirmOff, setConfirmOff] = useState<ApiCoupon | null>(null)

  const rows = useMemo(() => coupons.data?.coupons ?? [], [coupons.data])
  const now = Date.now()

  const active = rows.filter((c) => c.isActive)
  const redemptions = rows.reduce((s, c) => s + Number(c.usedCount || 0), 0)
  const expiringSoon = active.filter(
    (c) => c.expiresAt && new Date(c.expiresAt).getTime() - now < 7 * DAY && new Date(c.expiresAt).getTime() > now,
  )
  const expired = rows.filter((c) => c.expiresAt && new Date(c.expiresAt).getTime() <= now)
  const uncapped = active.filter(isUncapped)
  const nearlyUsedUp = active.filter(
    (c) => c.usageLimit !== null && c.usageLimit > 0 && Number(c.usedCount || 0) / c.usageLimit >= 0.8,
  )
  const bestPerformer = rows
    .filter((c) => Number(c.usedCount || 0) > 0)
    .sort((a, b) => Number(b.usedCount || 0) - Number(a.usedCount || 0))[0]

  const pageStatus = dcPageStatus([coupons], api.pulse)

  const decisions: Array<{
    key: string
    title: string
    headline: string
    detail: string
    why: string
    tone: DcTone
  }> = [
    ...(uncapped.length > 0
      ? [
          {
            key: 'uncapped',
            title: 'Percentage coupons with no ceiling',
            headline: uncapped.map((c) => c.code).slice(0, 3).join(', '),
            detail: `${uncapped.length} live code${uncapped.length === 1 ? '' : 's'}`,
            why: 'On a ৳50,000 order a 20% code gives away ৳10,000. Set a max discount amount.',
            tone: 'bad' as DcTone,
          },
        ]
      : []),
    ...(nearlyUsedUp.length > 0
      ? [
          {
            key: 'exhausted',
            title: 'Usage limit nearly reached',
            headline: nearlyUsedUp.map((c) => `${c.code} ${c.usedCount}/${c.usageLimit}`).slice(0, 2).join(' · '),
            detail: `${nearlyUsedUp.length} code${nearlyUsedUp.length === 1 ? '' : 's'} above 80%`,
            why: 'Once the limit hits, customers see a rejection at checkout. Raise it or let it die on purpose.',
            tone: 'warn' as DcTone,
          },
        ]
      : []),
    ...(expiringSoon.length > 0
      ? [
          {
            key: 'expiring',
            title: 'Expiring within 7 days',
            headline: expiringSoon.map((c) => c.code).slice(0, 3).join(', '),
            detail: `${expiringSoon.length} live code${expiringSoon.length === 1 ? '' : 's'}`,
            why: 'If a campaign still points at these codes, the campaign breaks when they lapse.',
            tone: 'info' as DcTone,
          },
        ]
      : []),
    ...(expired.some((c) => c.isActive)
      ? [
          {
            key: 'stale',
            title: 'Still switched on but already expired',
            headline: expired
              .filter((c) => c.isActive)
              .map((c) => c.code)
              .slice(0, 3)
              .join(', '),
            detail: 'reads as live in this list',
            why: 'Switch them off so the list tells the truth about what a customer can actually use.',
            tone: 'warn' as DcTone,
          },
        ]
      : []),
  ]

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'decide', title: '', items: [] } as DcBlock,
    { t: 'table', w: 'full', title: '', cols: [], rows: [] } as DcBlock,
  ]

  const runCreate = () => {
    const code = form.code.trim().toUpperCase()
    if (!code) {
      toast('warn', 'Code required', 'The customer types this at checkout — it cannot be blank.')
      return
    }
    const value = Number(form.value)
    const needsValue = form.type === 'PERCENTAGE' || form.type === 'FIXED_AMOUNT'
    if (needsValue && (!Number.isFinite(value) || value <= 0)) {
      toast('warn', 'Value required', 'A discount of 0 does nothing. Enter what comes off the order.')
      return
    }
    if (form.type === 'PERCENTAGE' && value > 100) {
      toast('warn', 'Over 100%', 'A percentage above 100 would pay the customer to order.')
      return
    }

    create.mutate(
      {
        code,
        type: form.type,
        value: needsValue ? value : 0,
        isActive: true,
        ...(Number(form.minOrderAmount) > 0 ? { minOrderAmount: Number(form.minOrderAmount) } : {}),
        ...(Number(form.maxDiscountAmount) > 0
          ? { maxDiscountAmount: Number(form.maxDiscountAmount) }
          : {}),
        ...(Number(form.usageLimit) > 0 ? { usageLimit: Number(form.usageLimit) } : {}),
        ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt).toISOString() } : {}),
      },
      {
        onSuccess: (res) => {
          if (!verifyStringEquals(res.coupon.code, code, 'Coupon code')) return
          if (!verifyBooleanEquals(res.coupon.isActive, true, 'Coupon active state')) return
          setNewOpen(false)
          setForm(EMPTY_FORM)
          toast(
            'ok',
            `${res.coupon.code} saved and active`,
            'Server confirmed checkout eligibility. Switch it off here to stop it.',
          )
        },
        onError: (err) =>
          toast(
            'bad',
            'Could not create the coupon',
            err instanceof Error ? err.message : 'POST /admin/coupons failed',
          ),
      },
    )
  }

  const runToggle = (c: ApiCoupon, next: boolean) => {
    toggle.mutate(
      { id: c.id, isActive: next },
      {
        onSuccess: (res) => {
          if (!verifyBooleanEquals(res.coupon.isActive, next, 'Coupon active state')) return
          setConfirmOff(null)
          toast(
            'ok',
            `${c.code} is now ${next ? 'active' : 'switched off'}`,
            next
              ? 'Server confirmed checkout eligibility.'
              : 'Server confirmed checkout will reject new attempts.',
          )
        },
        onError: (err) => {
          setConfirmOff(null)
          toast(
            'bad',
            'Could not change the coupon',
            err instanceof Error ? err.message : `PATCH /admin/coupons/${c.id} failed`,
          )
        },
      },
    )
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Marketing"
        title="Coupons"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          coupons.isFetching
            ? 'syncing…'
            : `${active.length} live of ${rows.length} · ${redemptions} redemption${redemptions === 1 ? '' : 's'}`
        }
        syncing={coupons.isFetching}
        onSync={() => void coupons.refetch()}
        actions={[
          {
            label: 'New coupon',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => {
              setForm(EMPTY_FORM)
              setNewOpen(true)
            },
          },
        ]}
      />

      {coupons.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : coupons.error ? (
        <DcErrorState
          error={`GET /admin/coupons → ${coupons.error instanceof Error ? coupons.error.message : '500 Internal Server Error'}`}
          hint="Existing codes still work at checkout — only this list failed to load."
          onRetry={() => void coupons.refetch()}
        />
      ) : rows.length === 0 ? (
        <DcEmptyState
          icon="icon-tag"
          title="No coupons yet"
          body="A coupon is a code the customer types at checkout. Nothing is discounted until one exists and is switched on."
          cta="Create a coupon"
          onCta={() => setNewOpen(true)}
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
            <Kpi label="Live codes" value={String(active.length)} sub={`${rows.length} total on file`} />
            <Kpi label="Redemptions" value={String(redemptions)} sub="times a code was accepted" />
            <Kpi
              label="Uncapped %"
              value={String(uncapped.length)}
              sub="no ceiling on the discount"
              color={uncapped.length > 0 ? 'var(--bad)' : 'var(--ok)'}
            />
            <Kpi
              label="Best performer"
              value={bestPerformer ? bestPerformer.code : '—'}
              sub={
                bestPerformer
                  ? `${bestPerformer.usedCount} use${bestPerformer.usedCount === 1 ? '' : 's'}`
                  : 'nothing has been redeemed yet'
              }
              color={bestPerformer ? 'var(--ok)' : undefined}
            />
          </div>

          {decisions.length > 0 ? (
            <div style={{ ...card, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '13px 16px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 9,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  Discount risk
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 60,
                    font: `400 11.5px/1.4 ${FONT}`,
                    color: 'var(--ink-3)',
                  }}
                >
                  every one of these costs money or breaks a checkout
                </span>
              </div>
              <div
                style={{
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(330px, 100%), 1fr))',
                  gap: 10,
                }}
              >
                {decisions.map((d) => {
                  const tone = toneStyle(d.tone)
                  return (
                    <div
                      key={d.key}
                      style={{
                        border: '1px solid var(--line)',
                        borderLeft: `3px solid ${tone.fg}`,
                        borderRadius: 11,
                        background: 'var(--surface-2)',
                        padding: '12px 13px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 9,
                      }}
                    >
                      <span style={{ font: `600 13px/1.35 ${FONT}`, color: 'var(--ink)' }}>
                        {d.title}
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          padding: '9px 10px',
                          border: '1px solid var(--line)',
                          borderRadius: 9,
                          background: 'var(--surface)',
                        }}
                      >
                        <span style={{ font: `600 12.5px/1.4 ${MONO}`, color: tone.fg }}>
                          {d.headline}
                        </span>
                        <span style={{ font: `500 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                          {d.detail}
                        </span>
                      </div>
                      <span
                        style={{
                          font: `400 11.5px/1.55 ${FONT}`,
                          color: 'var(--ink-3)',
                          textWrap: 'pretty',
                        }}
                      >
                        {d.why}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div style={{ ...card, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                padding: '12px 15px',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <span
                style={{ flex: 1, minWidth: 140, font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}
              >
                All coupons
              </span>
              <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                {rows.length} code{rows.length === 1 ? '' : 's'}
              </span>
            </div>
            <div
              style={{
                padding: 12,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(290px, 100%), 1fr))',
                gap: 10,
              }}
            >
              {rows.map((c) => {
                const isExpired = Boolean(c.expiresAt && new Date(c.expiresAt).getTime() <= now)
                const usable = c.isActive && !isExpired
                const tone = toneStyle(usable ? 'ok' : c.isActive ? 'warn' : 'mute')
                const usedLabel = c.usageLimit
                  ? `${c.usedCount} / ${c.usageLimit}`
                  : `${c.usedCount} / unlimited`
                const pctUsed =
                  c.usageLimit && c.usageLimit > 0
                    ? Math.min(100, (Number(c.usedCount || 0) / c.usageLimit) * 100)
                    : null
                return (
                  <div
                    key={c.id}
                    style={{
                      border: '1px solid var(--line)',
                      borderLeft: `3px solid ${tone.fg}`,
                      borderRadius: 11,
                      background: 'var(--surface-2)',
                      padding: '12px 13px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 9,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                      <span
                        style={{
                          display: 'grid',
                          placeItems: 'center',
                          width: 28,
                          height: 28,
                          flex: 'none',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          background: 'var(--surface)',
                          color: isUncapped(c) ? 'var(--bad)' : 'var(--violet-ink)',
                        }}
                      >
                        <DcIcon
                          name={c.type === 'FREE_SHIPPING' ? 'icon-truck' : 'icon-tag'}
                          size={13}
                        />
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                        }}
                      >
                        <span style={{ font: `700 13.5px/1.3 ${MONO}`, color: 'var(--ink)' }}>
                          {c.code}
                        </span>
                        <span style={{ font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                          {couponValue(c)} · {TYPE_LABEL[c.type]}
                          {c.minOrderAmount
                            ? ` over ${formatTaka(Number(c.minOrderAmount))}`
                            : ', no minimum'}
                        </span>
                      </span>
                      {/* Rule 6: icon + worded badge, and a worded button below. */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          flex: 'none',
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: `1px solid ${tone.bd}`,
                          background: tone.bg,
                          color: tone.fg,
                          font: `600 10px/1.3 ${FONT}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <DcIcon
                          name={
                            usable ? 'icon-check-circle' : c.isActive ? 'icon-clock' : 'icon-eye-off'
                          }
                          size={10}
                        />
                        {usable ? 'Live' : c.isActive ? 'On but expired' : 'Switched off'}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        padding: '9px 10px',
                        borderRadius: 9,
                        border: '1px solid var(--line)',
                        background: 'var(--surface)',
                      }}
                    >
                      {[
                        ['Used', usedLabel],
                        [
                          'Expires',
                          c.expiresAt
                            ? new Date(c.expiresAt).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'never — switch it off by hand',
                        ],
                        [
                          'Ceiling',
                          c.maxDiscountAmount
                            ? formatTaka(Number(c.maxDiscountAmount))
                            : c.type === 'PERCENTAGE'
                              ? 'none — one big order can cost you'
                              : 'not applicable',
                        ],
                      ].map(([k, v]) => (
                        <span
                          key={k}
                          style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}
                        >
                          <span
                            style={{
                              width: 54,
                              flex: 'none',
                              font: `600 9.5px/1.4 ${FONT}`,
                              letterSpacing: '.08em',
                              textTransform: 'uppercase',
                              color: 'var(--ink-3)',
                            }}
                          >
                            {k}
                          </span>
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              font: `500 11.5px/1.45 ${MONO}`,
                              color:
                                k === 'Ceiling' && isUncapped(c) ? 'var(--bad)' : 'var(--ink-2)',
                            }}
                          >
                            {v}
                          </span>
                        </span>
                      ))}
                      {pctUsed !== null ? (
                        <span
                          style={{
                            height: 4,
                            borderRadius: 99,
                            background: 'var(--surface-3)',
                            overflow: 'hidden',
                          }}
                        >
                          <span
                            style={{
                              display: 'block',
                              width: `${pctUsed}%`,
                              height: '100%',
                              borderRadius: 99,
                              background: pctUsed >= 80 ? 'var(--warn)' : 'var(--ink-3)',
                            }}
                          />
                        </span>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        disabled={toggle.isPending}
                        onClick={() => (c.isActive ? setConfirmOff(c) : runToggle(c, true))}
                        style={{
                          height: 29,
                          padding: '0 11px',
                          borderRadius: 8,
                          border: '1px solid var(--line-2)',
                          background: 'transparent',
                          color: 'var(--ink-2)',
                          cursor: toggle.isPending ? 'not-allowed' : 'pointer',
                          font: `600 11.5px/1 ${FONT}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.isActive ? 'Switch off' : 'Switch on'}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${c.code}`}
                        title={`Delete ${c.code}`}
                        onClick={() => setConfirmDelete(c)}
                        style={{
                          display: 'grid',
                          placeItems: 'center',
                          width: 29,
                          height: 29,
                          borderRadius: 8,
                          border: '1px solid var(--bad-bd)',
                          background: 'var(--bad-soft)',
                          color: 'var(--bad)',
                          cursor: 'pointer',
                        }}
                      >
                        <DcIcon name="icon-trash-2" size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── create ───────────────────────────────────────────────── */}
      <DcModal
        open={newOpen}
        title="New coupon"
        subtitle="It goes live the moment it is created — customers can use it at checkout straight away."
        confirmLabel="Create coupon"
        busy={create.isPending}
        onClose={() => setNewOpen(false)}
        onConfirm={runCreate}
      >
        <DcField
          label="Code"
          value={form.code}
          onChange={(v) => setForm((f) => ({ ...f, code: v.toUpperCase() }))}
          placeholder="EID25"
          mono
          hint="Case does not matter at checkout — it is stored uppercase."
        />

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              font: `600 11px/1 ${FONT}`,
              letterSpacing: '.07em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Kind
          </span>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ApiCoupon['type'] }))}
            style={selectStyle}
          >
            <option value="PERCENTAGE">Percentage off the order</option>
            <option value="FIXED_AMOUNT">Flat taka off the order</option>
            <option value="FREE_SHIPPING">Free delivery</option>
            <option value="BUY_X_GET_Y">Buy X get Y</option>
          </select>
        </label>

        {form.type === 'PERCENTAGE' || form.type === 'FIXED_AMOUNT' ? (
          <DcField
            label={form.type === 'PERCENTAGE' ? 'Percent off' : 'Taka off (৳)'}
            value={form.value}
            onChange={(v) => setForm((f) => ({ ...f, value: v }))}
            mono
          />
        ) : null}

        <DcField
          label="Minimum order (৳)"
          value={form.minOrderAmount}
          onChange={(v) => setForm((f) => ({ ...f, minOrderAmount: v }))}
          mono
          hint="Leave blank to allow the code on any order size."
        />

        {form.type === 'PERCENTAGE' ? (
          <DcField
            label="Maximum discount (৳)"
            value={form.maxDiscountAmount}
            onChange={(v) => setForm((f) => ({ ...f, maxDiscountAmount: v }))}
            mono
            hint="Without a ceiling, one large order can give away far more than you intended."
          />
        ) : null}

        <DcField
          label="Usage limit"
          value={form.usageLimit}
          onChange={(v) => setForm((f) => ({ ...f, usageLimit: v }))}
          mono
          hint="Total redemptions across all customers. Blank means unlimited."
        />

        <DcField
          label="Expires on"
          value={form.expiresAt}
          onChange={(v) => setForm((f) => ({ ...f, expiresAt: v }))}
          type="date"
          min={minExpiryDate}
          mono
          hint="Choose a date from the calendar. Leave blank for no expiry."
        />
      </DcModal>

      {/* ── switch off ───────────────────────────────────────────── */}
      <DcModal
        open={confirmOff !== null}
        title={confirmOff ? `Switch off ${confirmOff.code}?` : 'Switch off coupon'}
        subtitle="Checkout will reject the code from the next attempt. Any order already placed keeps its discount."
        confirmLabel="Switch off"
        busy={toggle.isPending}
        onClose={() => setConfirmOff(null)}
        onConfirm={() => confirmOff && runToggle(confirmOff, false)}
      />

      {/* ── delete ───────────────────────────────────────────────── */}
      <DcModal
        open={confirmDelete !== null}
        title={confirmDelete ? `Delete ${confirmDelete.code}?` : 'Delete coupon'}
        subtitle={
          confirmDelete
            ? `Used ${confirmDelete.usedCount} time${confirmDelete.usedCount === 1 ? '' : 's'}. Deleting removes the code for good — switching it off is usually what you want.`
            : ''
        }
        confirmLabel="Delete for good"
        danger
        busy={remove.isPending}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() =>
          confirmDelete &&
          remove.mutate(confirmDelete.id, {
            onSuccess: (res) => {
              if (!verifyDeleteSuccess(res)) return
              const code = confirmDelete.code
              setConfirmDelete(null)
              toast('ok', `${code} deleted`, 'Server confirmed the coupon was removed.')
            },
            onError: (err) => {
              setConfirmDelete(null)
              toast(
                'bad',
                'Could not delete the coupon',
                err instanceof Error
                  ? err.message
                  : `DELETE /admin/coupons/${confirmDelete.id} failed`,
              )
            },
          })
        }
      />
    </>
  )
}

const selectStyle = {
  height: 40,
  padding: '0 10px',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  font: `400 12.5px/1 ${FONT}`,
  outline: 'none',
} as const

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color?: string | undefined
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

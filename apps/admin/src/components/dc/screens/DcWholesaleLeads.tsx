'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, formatCount, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastApiSaved, toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import { verifyPersisted, verifyStringEquals } from '@/lib/admin/mutation-verify'
import { downloadCsv } from '@/lib/admin/admin-actions'
import {
  deleteWholesaleInquiry,
  fetchWholesaleInquiries,
  updateWholesaleInquiry,
  WHOLESALE_STATUSES,
  type ApiWholesaleInquiry,
  type WholesaleStatus,
} from '@/lib/api/wholesale'
import { telHref, whatsappHref } from '@/lib/format/bd-phone'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { resolveMediaUrl } from '@/lib/media-url'

/** 12,500 reads as 12.5k in a tile — the exact figure lives in the row. */
function compactUnits(units: number): string {
  if (!Number.isFinite(units) || units <= 0) return '0'
  if (units >= 1_000_000) return `${(units / 1_000_000).toFixed(units >= 10_000_000 ? 0 : 1)}M`
  if (units >= 1_000) return `${(units / 1_000).toFixed(units >= 10_000 ? 0 : 1)}k`
  return String(units)
}

/** A live lead past its reminder date. Decided leads have no reminder left. */
function isOverdue(lead: ApiWholesaleInquiry): boolean {
  if (!lead.nextFollowUpAt) return false
  if (lead.status === 'WON' || lead.status === 'LOST') return false
  return new Date(lead.nextFollowUpAt).getTime() < Date.now()
}

function followUpLabel(lead: ApiWholesaleInquiry): string | null {
  if (!lead.nextFollowUpAt) return null
  if (lead.status === 'WON' || lead.status === 'LOST') return null
  const due = new Date(lead.nextFollowUpAt)
  if (Number.isNaN(due.getTime())) return null
  const days = Math.round((due.getTime() - Date.now()) / 86_400_000)
  if (days < 0) return `Overdue ${Math.abs(days)}d`
  if (days === 0) return 'Follow up today'
  return `Follow up in ${days}d`
}

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

const STATUS_TONE: Record<WholesaleStatus, DcTone> = {
  NEW: 'warn',
  CONTACTED: 'info',
  QUALIFIED: 'ok',
  WON: 'ok',
  LOST: 'mute',
}

const STATUS_HELP: Record<WholesaleStatus, string> = {
  NEW: 'Nobody has called this buyer yet.',
  CONTACTED: 'Reached out — waiting on their reply.',
  QUALIFIED: 'Real buyer, quote or samples in progress.',
  WON: 'Buying from us.',
  LOST: 'Not going ahead.',
}

function hoursAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000))
}

function waitedLabel(iso: string): string {
  const hours = hoursAgo(iso)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function DcWholesaleLeads() {
  const router = useRouter()
  return (
    <DcScreenProvider
      screen="wholesale-leads"
      onNavigate={(next) => router.push(`/dashboard/${next}`)}
    >
      <DcWholesaleLeadsBody />
    </DcScreenProvider>
  )
}

function DcWholesaleLeadsBody() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<WholesaleStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<ApiWholesaleInquiry | null>(null)
  const [deleting, setDeleting] = useState<ApiWholesaleInquiry | null>(null)
  const [notes, setNotes] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [sort, setSort] = useState<'recent' | 'volume' | 'followup'>('recent')
  const [busy, setBusy] = useState(false)
  const debouncedSearch = useDebouncedValue(search, 300)
  const pageSize = 25

  useEffect(() => {
    setPage(1)
  }, [statusFilter, debouncedSearch, sort])

  const leads = useQuery({
    queryKey: ['wholesale-inquiries', statusFilter, debouncedSearch, page, sort],
    queryFn: () =>
      fetchWholesaleInquiries({
        ...(statusFilter === 'ALL' ? {} : { status: statusFilter }),
        ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
        ...(sort !== 'recent' ? { sort } : {}),
        page,
        limit: pageSize,
      }),
    staleTime: 30_000,
  })
  const { api } = useAdminConnection(25_000)

  const rows = useMemo(() => leads.data?.inquiries ?? [], [leads.data])
  const counts = leads.data?.counts
  const newCount = counts?.NEW ?? 0
  const waiting = useMemo(() => rows.filter((row) => row.status === 'NEW'), [rows])
  const oldestWaiting = useMemo(() => {
    if (waiting.length === 0) return null
    return waiting.reduce((oldest, row) =>
      new Date(row.createdAt) < new Date(oldest.createdAt) ? row : oldest,
    )
  }, [waiting])
  const exportCountries = useMemo(
    () =>
      new Set(
        rows
          .filter((row) => !/bangladesh/i.test(row.country))
          .map((row) => row.country.trim().toLowerCase()),
      ).size,
    [rows],
  )

  const afterWrite = () => {
    void qc.invalidateQueries({ queryKey: ['wholesale-inquiries'] })
  }

  const setStatus = async (row: ApiWholesaleInquiry, next: WholesaleStatus) => {
    setBusy(true)
    try {
      const updated = await updateWholesaleInquiry(row.id, { status: next })
      if (!verifyPersisted(updated.status === next, 'Status did not persist on server')) return
      afterWrite()
      setOpen((current) => (current && current.id === row.id ? updated : current))
      toastApiSaved(`Marked ${next.toLowerCase()}`)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not update this enquiry')
    } finally {
      setBusy(false)
    }
  }

  const saveNotes = async (row: ApiWholesaleInquiry) => {
    setBusy(true)
    try {
      const updated = await updateWholesaleInquiry(row.id, {
        adminNotes: notes,
        nextFollowUpAt: followUp ? new Date(followUp).toISOString() : null,
      })
      if (!verifyStringEquals(updated.adminNotes ?? '', notes.trim(), 'Note')) return
      afterWrite()
      setOpen(updated)
      setFollowUp(updated.nextFollowUpAt ? updated.nextFollowUpAt.slice(0, 10) : '')
      toastApiSaved(followUp ? 'Note and follow-up saved' : 'Note saved')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not save the note')
    } finally {
      setBusy(false)
    }
  }

  const runDelete = async (row: ApiWholesaleInquiry) => {
    setBusy(true)
    try {
      await deleteWholesaleInquiry(row.id)
      afterWrite()
      setDeleting(null)
      setOpen(null)
      toastApiSaved('Enquiry deleted')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not delete this enquiry')
    } finally {
      setBusy(false)
    }
  }

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'list', title: '', items: [] } as DcBlock,
  ]
  const funnel = leads.data?.funnel
  const pageStatus = dcPageStatus([leads], api.pulse)

  const exportCsv = () => {
    if (rows.length === 0) {
      toastWarn('No wholesale leads to export')
      return
    }
    const total = leads.data?.total ?? rows.length
    if (total > rows.length) {
      toastWarn(`Exporting this page only — ${rows.length} of ${total} matching the filter.`)
    }
    const headers = [
      'Reference',
      'Company',
      'Contact Name',
      'Industry',
      'Email',
      'Phone',
      'Country',
      'Product Interest',
      'Monthly Quantity',
      'Monthly Units',
      'Programme',
      'Follow Up',
      'Message',
      'Status',
      'Created Date',
      'Admin Notes',
    ]
    const csvRows = [
      headers,
      ...rows.map((row) => [
        row.referenceCode || '—',
        row.companyName || '—',
        row.fullName,
        row.industry || '—',
        row.email || '—',
        row.phone,
        row.country,
        row.productInterest || '—',
        row.monthlyQuantity || '—',
        row.monthlyUnits ? String(row.monthlyUnits) : '',
        row.tier?.name || '—',
        row.nextFollowUpAt ? row.nextFollowUpAt.slice(0, 10) : '',
        row.message || '',
        row.status,
        new Date(row.createdAt).toISOString().slice(0, 10),
        row.adminNotes || '',
      ]),
    ]
    downloadCsv(`splaro-wholesale-leads-${new Date().toISOString().slice(0, 10)}.csv`, csvRows)
    toastOk(
      `Exported ${rows.length} wholesale lead${rows.length === 1 ? '' : 's'}${
        total > rows.length ? ' on this page' : ''
      }.`,
    )
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Customers"
        title="Wholesale Leads"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          leads.isFetching
            ? 'syncing…'
            : `${leads.data?.total ?? rows.length} enquir${(leads.data?.total ?? rows.length) === 1 ? 'y' : 'ies'}`
        }
        syncing={leads.isFetching}
        onSync={() => void leads.refetch()}
        actions={[
          {
            label: 'Export CSV',
            icon: 'icon-download',
            onClick: exportCsv,
          },
        ]}
      />

      {leads.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : leads.error ? (
        <DcErrorState
          error={`GET /admin/wholesale-inquiries → ${leads.error instanceof Error ? leads.error.message : '500 Internal Server Error'}`}
          hint="The storefront form still accepts enquiries — only this view failed to load."
          onRetry={() => void leads.refetch()}
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
              label="Waiting for a call"
              value={formatCount(newCount)}
              sub={
                oldestWaiting
                  ? `oldest waiting ${waitedLabel(oldestWaiting.createdAt)}`
                  : 'nothing waiting'
              }
              color={newCount > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
            <Kpi
              label="Overdue follow-ups"
              value={formatCount(funnel?.overdueFollowUps ?? 0)}
              sub={
                (funnel?.overdueFollowUps ?? 0) > 0
                  ? 'past their reminder date'
                  : 'nothing overdue'
              }
              color={(funnel?.overdueFollowUps ?? 0) > 0 ? 'var(--bad)' : 'var(--ink)'}
            />
            <Kpi
              label="Pipeline"
              value={compactUnits(funnel?.pipelineUnits ?? 0)}
              sub={`pcs/mo still winnable · ${counts?.CONTACTED ?? 0} in conversation`}
            />
            <Kpi
              label="Won"
              value={formatCount(counts?.WON ?? 0)}
              sub={
                funnel?.winRate == null
                  ? `${counts?.QUALIFIED ?? 0} qualified · nothing decided yet`
                  : `${funnel.winRate}% of decided · ${compactUnits(funnel.wonUnits)} pcs/mo`
              }
              color={(counts?.WON ?? 0) > 0 ? 'var(--ok)' : 'var(--ink)'}
            />
            <Kpi label="Export countries" value={formatCount(exportCountries)} sub="outside Bangladesh" />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <FilterChip
              label={`All (${leads.data?.total ?? 0})`}
              active={statusFilter === 'ALL'}
              onClick={() => {
                setStatusFilter('ALL')
                setPage(1)
              }}
            />
            {WHOLESALE_STATUSES.map((status) => (
              <FilterChip
                key={status}
                label={`${status.charAt(0)}${status.slice(1).toLowerCase()} (${counts?.[status] ?? 0})`}
                active={statusFilter === status}
                onClick={() => {
                  setStatusFilter(status)
                  setPage(1)
                }}
              />
            ))}
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as 'recent' | 'volume' | 'followup')
              }
              aria-label="Sort leads"
              style={{
                height: 32,
                padding: '0 9px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
                font: `600 12px/1 ${FONT}`,
                cursor: 'pointer',
              }}
            >
              <option value="recent">Newest first</option>
              <option value="volume">Biggest volume</option>
              <option value="followup">Follow-up due</option>
            </select>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reference, name, company, phone"
              style={{
                marginLeft: 'auto',
                minWidth: 240,
                border: '1px solid var(--line)',
                borderRadius: 10,
                background: 'var(--surface)',
                padding: '8px 11px',
                font: `400 12.5px/1 ${FONT}`,
                color: 'var(--ink)',
              }}
            />
          </div>

          {rows.length === 0 ? (
            <DcEmptyState
              icon="icon-factory"
              title={search || statusFilter !== 'ALL' ? 'Nothing matches that filter' : 'No wholesale enquiries yet'}
              body="Buyers reach this list from the storefront footer — Company → Wholesale & Export."
            />
          ) : (
            <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
                gap: 12,
              }}
            >
              {rows.map((row) => (
                <LeadCard
                  key={row.id}
                  lead={row}
                  busy={busy}
                  onOpen={() => {
                    setOpen(row)
                    setNotes(row.adminNotes ?? '')
                    setFollowUp(row.nextFollowUpAt ? row.nextFollowUpAt.slice(0, 10) : '')
                  }}
                  onStatus={(next) => void setStatus(row, next)}
                />
              ))}
            </div>
            {(leads.data?.pages ?? 1) > 1 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={busy || page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  style={chipButton}
                >
                  Previous
                </button>
                <span style={{ font: `400 12.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                  Page {leads.data?.page ?? page} of {leads.data?.pages ?? 1}
                </span>
                <button
                  type="button"
                  disabled={busy || page >= (leads.data?.pages ?? 1)}
                  onClick={() => setPage((current) => current + 1)}
                  style={chipButton}
                >
                  Next
                </button>
              </div>
            ) : null}
            </>
          )}
        </>
      )}

      {open ? (
        <DcModal
          open
          title={open.companyName || open.fullName}
          subtitle={STATUS_HELP[open.status]}
          confirmLabel="Save note"
          busy={busy}
          width="min(620px, 94vw)"
          onClose={() => setOpen(null)}
          onConfirm={() => void saveNotes(open)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {open.referenceCode ? (
              <DetailRow label="Reference" value={open.referenceCode} mono />
            ) : null}
            <DetailRow label="Contact" value={open.fullName} />
            {open.companyName ? <DetailRow label="Company" value={open.companyName} /> : null}
            <DetailRow label="Business type" value={open.industry} />
            <DetailRow label="Country" value={open.country} />
            <DetailRow label="Phone" value={open.phone} mono />
            {open.email ? (
              <DetailRow
                label="Email"
                value={open.email}
                mono
                href={`mailto:${open.email}`}
              />
            ) : null}
            {open.productInterest ? (
              <DetailRow label="Products" value={open.productInterest} />
            ) : null}
            {open.tier ? <DetailRow label="Programme" value={open.tier.name} /> : null}
            {open.monthlyQuantity || open.monthlyUnits ? (
              <DetailRow
                label="Monthly quantity"
                value={
                  open.monthlyUnits
                    ? `${formatCount(open.monthlyUnits)} pcs/mo${
                        open.monthlyQuantity ? ` · picked "${open.monthlyQuantity}"` : ''
                      }`
                    : open.monthlyQuantity!
                }
              />
            ) : null}
            {open.targetLaunch ? (
              <DetailRow
                label="Target launch"
                value={new Date(open.targetLaunch).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              />
            ) : null}

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={capsLabel}>Follow up on</span>
              <input
                type="date"
                value={followUp}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setFollowUp(event.target.value)}
                disabled={open.status === 'WON' || open.status === 'LOST'}
                style={{
                  height: 34,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink)',
                  font: `500 12.5px/1 ${FONT}`,
                }}
              />
              <span style={{ font: `400 11.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
                {open.status === 'WON' || open.status === 'LOST'
                  ? 'Decided leads carry no reminder.'
                  : 'Saved with the note. Overdue leads are counted at the top of this page.'}
              </span>
            </label>
            {open.message ? <DetailRow label="Message" value={open.message} /> : null}
            {(open.imageUrls?.length ?? 0) > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={capsLabel}>Product photos</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
                  {open.imageUrls!.map((url) => {
                    const src = resolveMediaUrl(url)
                    return (
                    <a
                      key={url}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        aspectRatio: '1',
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: '1px solid var(--line)',
                        background: 'var(--surface)',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </a>
                    )
                  })}
                </div>
              </div>
            ) : null}
            <DetailRow label="Received" value={`${waitedLabel(open.createdAt)} · ${open.sourcePath ?? '/wholesale'}`} />
            {open.handledAt && open.status !== 'NEW' ? (
              <DetailRow label="First handled" value={waitedLabel(open.handledAt)} />
            ) : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={capsLabel}>Internal note</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="What was agreed on the call, pricing quoted, next step…"
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  background: 'var(--surface)',
                  padding: '9px 11px',
                  font: `400 12.5px/1.5 ${FONT}`,
                  color: 'var(--ink)',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={capsLabel}>Move to</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {WHOLESALE_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={busy || open.status === status}
                    title={STATUS_HELP[status]}
                    onClick={() => void setStatus(open, status)}
                    style={{
                      ...chipButton,
                      opacity: open.status === status ? 0.45 : 1,
                    }}
                  >
                    {status.charAt(0)}
                    {status.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => setDeleting(open)}
              style={{ ...chipButton, color: 'var(--bad)', alignSelf: 'flex-start' }}
            >
              Delete enquiry
            </button>
          </div>
        </DcModal>
      ) : null}

      {deleting ? (
        <DcModal
          open
          danger
          title="Delete this enquiry?"
          subtitle="Mark it Lost instead if you want to keep the record."
          confirmLabel="Delete permanently"
          busy={busy}
          busyLabel="Deleting…"
          onClose={() => setDeleting(null)}
          onConfirm={() => void runDelete(deleting)}
        >
          <span style={{ font: `400 12.5px/1.6 ${FONT}`, color: 'var(--ink-2)' }}>
            {deleting.fullName} · {deleting.phone} will be removed from this list. This cannot be
            undone.
          </span>
        </DcModal>
      ) : null}
    </>
  )
}

const chipButton = {
  border: '1px solid var(--line)',
  borderRadius: 999,
  background: 'var(--surface)',
  color: 'var(--ink)',
  padding: '7px 12px',
  font: `600 12px/1 ${FONT}`,
  cursor: 'pointer',
} as const

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...chipButton,
        background: active ? 'var(--ink)' : 'var(--surface)',
        color: active ? 'var(--surface)' : 'var(--ink-2)',
      }}
    >
      {label}
    </button>
  )
}

function DetailRow({
  label,
  value,
  mono,
  href,
}: {
  label: string
  value: string
  mono?: boolean
  href?: string
}) {
  const text = (
    <span
      style={{
        font: mono ? `500 12.5px/1.5 ${MONO}` : `400 13px/1.55 ${FONT}`,
        color: 'var(--ink)',
        whiteSpace: 'pre-wrap',
      }}
    >
      {value}
    </span>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={capsLabel}>{label}</span>
      {href ? (
        <a href={href} style={{ color: 'inherit', textDecoration: 'underline' }}>
          {text}
        </a>
      ) : (
        text
      )}
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
    <div style={{ ...card, padding: '14px 15px' }}>
      <span style={capsLabel}>{label}</span>
      <div style={{ font: `600 24px/1.1 ${FONT}`, color: color ?? 'var(--ink)', margin: '7px 0 3px' }}>
        {value}
      </div>
      <span style={{ font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}

function LeadCard({
  lead,
  busy,
  onOpen,
  onStatus,
}: {
  lead: ApiWholesaleInquiry
  busy: boolean
  onOpen: () => void
  onStatus: (next: WholesaleStatus) => void
}) {
  return (
    <div style={{ ...card, padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ font: `600 14px/1.3 ${FONT}`, color: 'var(--ink)' }}>
              {lead.companyName || lead.fullName}
            </span>
            {lead.referenceCode ? (
              <span style={{ font: `600 10.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                {lead.referenceCode}
              </span>
            ) : null}
          </span>
          <span style={{ font: `400 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
            {lead.industry} · {lead.country}
            {lead.tier ? ` · ${lead.tier.name}` : ''}
          </span>
        </div>
        <span style={{ ...toneStyle(STATUS_TONE[lead.status]), whiteSpace: 'nowrap' }}>
          {lead.status.charAt(0)}
          {lead.status.slice(1).toLowerCase()}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <span style={{ font: `500 12.5px/1 ${MONO}`, color: 'var(--ink-2)' }}>{lead.phone}</span>
        {lead.monthlyUnits ? (
          <span
            title={lead.monthlyQuantity ?? undefined}
            style={{ font: `600 12px/1 ${FONT}`, color: 'var(--ink-2)' }}
          >
            {formatCount(lead.monthlyUnits)} pcs/mo
          </span>
        ) : lead.monthlyQuantity ? (
          <span style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
            {lead.monthlyQuantity}
          </span>
        ) : null}
        {followUpLabel(lead) ? (
          <span
            style={{
              font: `600 12px/1 ${FONT}`,
              color: isOverdue(lead) ? 'var(--bad)' : 'var(--ink-3)',
            }}
          >
            {followUpLabel(lead)}
          </span>
        ) : null}
        <span style={{ font: `400 12px/1 ${FONT}`, color: 'var(--ink-3)', marginLeft: 'auto' }}>
          {waitedLabel(lead.createdAt)}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <a href={telHref(lead.phone)} style={{ ...chipButton, textDecoration: 'none' }}>
          Call
        </a>
        <a
          href={whatsappHref(lead.phone)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...chipButton, textDecoration: 'none' }}
        >
          WhatsApp
        </a>
        {lead.email ? (
          <a href={`mailto:${lead.email}`} style={{ ...chipButton, textDecoration: 'none' }}>
            Email
          </a>
        ) : null}
        {lead.status === 'NEW' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus('CONTACTED')}
            style={chipButton}
          >
            Mark contacted
          </button>
        ) : null}
        <button type="button" onClick={onOpen} style={{ ...chipButton, marginLeft: 'auto' }}>
          Open
        </button>
      </div>
    </div>
  )
}

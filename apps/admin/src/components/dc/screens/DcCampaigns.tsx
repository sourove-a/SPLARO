'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcField, DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import {
  formatCampaignType,
  mapCampaignStatus,
  type ApiCampaign,
  type CampaignAudience,
  type CampaignType,
} from '@/lib/api/marketing'
import { downloadCsv } from '@/lib/admin/admin-actions'
import { toastOk, toastWarn } from '@/lib/admin/feedback'
import {
  useCampaignStats,
  useCampaigns,
  useCreateCampaign,
  useDeleteCampaign,
  useDuplicateCampaign,
  useSendCampaign,
  useUpdateCampaign,
} from '@/lib/api/hooks'
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

const th = {
  textAlign: 'left' as const,
  padding: '9px 15px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

const td = { padding: '10px 15px', font: `400 12.5px/1.4 ${FONT}`, color: 'var(--ink-2)' } as const

const STATE_TONE: Record<'draft' | 'scheduled' | 'live' | 'ended' | 'failed', DcTone> = {
  draft: 'mute',
  scheduled: 'info',
  live: 'ok',
  ended: 'mute',
  failed: 'bad',
}

const AUDIENCE_LABEL: Record<CampaignAudience, string> = {
  ALL: 'Everyone on file',
  LOYAL: 'Repeat buyers',
  INACTIVE: 'Gone quiet',
  HIGH_SPENDERS: 'Top spenders',
  TAG: 'A specific tag',
}

interface CampaignForm {
  name: string
  subject: string
  body: string
  type: CampaignType
  targetAudience: CampaignAudience
  targetTag: string
}

const EMPTY_FORM: CampaignForm = {
  name: '',
  subject: '',
  body: '',
  type: 'EMAIL',
  targetAudience: 'ALL',
  targetTag: '',
}

export function DcCampaigns() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="campaigns" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcCampaignsBody />
    </DcScreenProvider>
  )
}

function DcCampaignsBody() {
  const { toast } = useDcScreen()
  const campaigns = useCampaigns()
  const stats = useCampaignStats()
  const create = useCreateCampaign()
  const update = useUpdateCampaign()
  const send = useSendCampaign()
  const duplicate = useDuplicateCampaign()
  const remove = useDeleteCampaign()
  const { api } = useAdminConnection(25_000)

  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<ApiCampaign | null>(null)
  const [form, setForm] = useState<CampaignForm>(EMPTY_FORM)
  const [confirmSend, setConfirmSend] = useState<ApiCampaign | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ApiCampaign | null>(null)

  const [channelFilter, setChannelFilter] = useState<string>('ALL')
  const [stateFilter, setStateFilter] = useState<string>('ALL')

  const rows = useMemo(() => campaigns.data ?? [], [campaigns.data])
  const filteredRows = useMemo(() => {
    let list = rows
    if (channelFilter !== 'ALL') {
      list = list.filter((c) => (c.type || '').toUpperCase() === channelFilter)
    }
    if (stateFilter !== 'ALL') {
      list = list.filter((c) => mapCampaignStatus(c.status).toUpperCase() === stateFilter)
    }
    return list
  }, [rows, channelFilter, stateFilter])

  const drafts = rows.filter((c) => mapCampaignStatus(c.status) === 'draft')
  const scheduled = rows.filter((c) => mapCampaignStatus(c.status) === 'scheduled')

  const s = stats.data
  const totalSent = s?.totalSent ?? rows.reduce((n, c) => n + Number(c.totalSent || 0), 0)
  const openRate = s?.openRate ?? 0
  const clickRate = s?.clickRate ?? 0

  const pageStatus = dcPageStatus([campaigns, stats], api.pulse)

  /** A campaign that sent to nobody, or landed with nobody, is worth saying out loud. */
  const deadOnArrival = rows.filter(
    (c) => Number(c.totalSent || 0) > 20 && Number(c.totalOpened || 0) === 0,
  )

  const decisions: Array<{
    key: string
    title: string
    headline: string
    detail: string
    why: string
    tone: DcTone
    cta?: { label: string; run: () => void }
  }> = [
    ...(drafts.length > 0
      ? [
          {
            key: 'drafts',
            title: 'Drafts that never went out',
            headline: String(drafts.length),
            detail: drafts
              .map((c) => c.name)
              .slice(0, 2)
              .join(' · '),
            why: 'A draft costs nothing and earns nothing. Send it or delete it so the list means something.',
            tone: 'warn' as DcTone,
          },
        ]
      : []),
    ...(scheduled.length > 0
      ? [
          {
            key: 'scheduled',
            title: 'Scheduled to go out',
            headline: String(scheduled.length),
            detail: scheduled
              .map((c) => `${c.name}${c.scheduledAt ? ` · ${fmtDateTime(c.scheduledAt)}` : ''}`)
              .slice(0, 2)
              .join(' · '),
            why: 'These will send without you touching anything. Check the copy before the clock does.',
            tone: 'info' as DcTone,
          },
        ]
      : []),
    ...(deadOnArrival.length > 0
      ? [
          {
            key: 'unopened',
            title: 'Sent but nobody opened it',
            headline: String(deadOnArrival.length),
            detail: deadOnArrival
              .map((c) => c.name)
              .slice(0, 2)
              .join(' · '),
            why: 'Either the subject line failed or the send never reached inboxes. Check delivery before writing another.',
            tone: 'bad' as DcTone,
          },
        ]
      : []),
    ...(totalSent > 0 && openRate < 10
      ? [
          {
            key: 'openrate',
            title: 'Open rate is below 10%',
            headline: `${openRate.toFixed(1)}%`,
            detail: `across ${totalSent} sends`,
            why: 'At this rate the list is stale or the sends are landing in spam. Cleaning the list beats sending more.',
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

  const refetchAll = () => {
    void campaigns.refetch()
    void stats.refetch()
  }

  const openNewCampaign = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setNewOpen(true)
  }

  const runSave = () => {
    const name = form.name.trim()
    const subject = form.subject.trim()
    const body = form.body.trim()
    const targetTag = form.targetTag.trim()

    if (!name) {
      toast('warn', 'Name required', 'This is what you will look for in the list later.')
      return
    }
    if (!subject) {
      toast('warn', 'Subject required', 'The subject line decides whether anyone opens it.')
      return
    }
    if (!body) {
      toast('warn', 'Message required', 'There is nothing to send yet.')
      return
    }
    if (form.targetAudience === 'TAG' && !targetTag) {
      toast('warn', 'Tag required', 'You picked a tag audience but did not say which tag.')
      return
    }

    if (editing) {
      update.mutate(
        {
          id: editing.id,
          name,
          subject,
          body,
        },
        {
          onSuccess: (res) => {
            const persisted =
              res.id === editing.id &&
              res.name.trim() === name &&
              String(res.subject ?? '').trim() === subject &&
              String(res.body ?? '').trim() === body
            if (!persisted) {
              toast(
                'bad',
                'Campaign could not be verified',
                'Server response did not match the edited campaign.',
              )
              refetchAll()
              return
            }
            setEditing(null)
            setForm(EMPTY_FORM)
            toast('ok', `${res.name} updated`, 'The server confirmed the campaign changes.')
          },
          onError: (err) =>
            toast(
              'bad',
              'Could not update the campaign',
              err instanceof Error
                ? err.message
                : `PATCH /marketing/campaigns/${editing.id} failed`,
            ),
        },
      )
      return
    }

    create.mutate(
      {
        name,
        subject,
        body,
        type: form.type,
        targetAudience: form.targetAudience,
        ...(form.targetAudience === 'TAG' ? { targetTag } : {}),
      },
      {
        onSuccess: (res) => {
          const persisted =
            Boolean(res.id) &&
            res.name.trim() === form.name.trim() &&
            String(res.subject ?? '').trim() === form.subject.trim() &&
            mapCampaignStatus(res.status) === 'draft'
          if (!persisted) {
            toast(
              'bad',
              'Draft could not be verified',
              'Server response did not match the campaign form.',
            )
            refetchAll()
            return
          }
          setNewOpen(false)
          setForm(EMPTY_FORM)
          toast(
            'ok',
            `${res.name} saved as a draft`,
            'Nothing has been sent. Use Send when the copy is final.',
          )
        },
        onError: (err) =>
          toast(
            'bad',
            'Could not create the campaign',
            err instanceof Error ? err.message : 'POST /marketing/campaigns failed',
          ),
      },
    )
  }

  const exportCsv = () => {
    if (rows.length === 0) {
      toastWarn('No campaign records to export')
      return
    }
    const headers = [
      'Campaign Name',
      'Subject',
      'Channel',
      'Audience',
      'Sent',
      'Delivered',
      'Opened',
      'Clicked',
      'State',
      'Scheduled At',
      'Sent At',
    ]
    const csvRows = [
      headers,
      ...rows.map((c) => {
        const sent = Number(c.totalSent || 0)
        const opened = Number(c.totalOpened || 0)
        const clicked = Number(c.totalClicked || 0)
        return [
          c.name,
          c.subject ?? '',
          c.type,
          c.recipientType ?? 'ALL',
          String(sent),
          String(c.totalDelivered || 0),
          sent > 0 ? `${((opened / sent) * 100).toFixed(1)}%` : '0%',
          sent > 0 ? `${((clicked / sent) * 100).toFixed(1)}%` : '0%',
          mapCampaignStatus(c.status),
          c.scheduledAt ? new Date(c.scheduledAt).toISOString() : '',
          c.sentAt ? new Date(c.sentAt).toISOString() : '',
        ]
      }),
    ]
    downloadCsv(`splaro-campaigns-${new Date().toISOString().slice(0, 10)}.csv`, csvRows)
    toastOk(`Exported ${rows.length} campaigns to CSV`)
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Marketing"
        title="Campaigns"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          campaigns.isFetching || stats.isFetching
            ? 'syncing…'
            : `${rows.length} campaign${rows.length === 1 ? '' : 's'} · ${drafts.length} draft${drafts.length === 1 ? '' : 's'}`
        }
        syncing={campaigns.isFetching || stats.isFetching}
        onSync={refetchAll}
        actions={[
          {
            label: 'New campaign',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: openNewCampaign,
          },
          {
            label: 'Export CSV',
            icon: 'icon-download',
            onClick: exportCsv,
          },
        ]}
      />

      {campaigns.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : campaigns.error ? (
        <DcErrorState
          error={`GET /marketing/campaigns → ${campaigns.error instanceof Error ? campaigns.error.message : '500 Internal Server Error'}`}
          hint="Nothing has been sent or cancelled — only this list failed to load."
          onRetry={refetchAll}
        />
      ) : rows.length === 0 ? (
        <DcEmptyState
          icon="icon-megaphone"
          title="No campaigns yet"
          body="A campaign is one message to one audience — email or SMS. It stays a draft until you send it."
          cta="Write the first one"
          onCta={openNewCampaign}
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
              label="Messages sent"
              value={totalSent.toLocaleString('en-IN')}
              sub={`${rows.length} campaigns total`}
            />
            <Kpi
              label="Open rate"
              value={stats.error ? '—' : `${openRate.toFixed(1)}%`}
              sub={
                stats.error
                  ? 'GET /marketing/campaigns/stats failed'
                  : `${(s?.totalOpened ?? 0).toLocaleString('en-IN')} opens`
              }
              color={!stats.error && openRate < 10 && totalSent > 0 ? 'var(--warn)' : undefined}
            />
            <Kpi
              label="Click rate"
              value={stats.error ? '—' : `${clickRate.toFixed(1)}%`}
              sub={
                stats.error
                  ? 'stats feed unavailable'
                  : `${(s?.totalClicked ?? 0).toLocaleString('en-IN')} clicks`
              }
            />
            <Kpi
              label="Waiting to send"
              value={String(drafts.length + scheduled.length)}
              sub={`${drafts.length} draft · ${scheduled.length} scheduled`}
              color={drafts.length > 0 ? 'var(--warn)' : undefined}
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
                  What to do about the list
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 60,
                    font: `400 11.5px/1.4 ${FONT}`,
                    color: 'var(--ink-3)',
                  }}
                >
                  sending more rarely fixes any of these
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
                          alignItems: 'baseline',
                          gap: 8,
                          flexWrap: 'wrap',
                          padding: '9px 10px',
                          border: '1px solid var(--line)',
                          borderRadius: 9,
                          background: 'var(--surface)',
                        }}
                      >
                        <span style={{ font: `700 15px/1.2 ${MONO}`, color: tone.fg }}>
                          {d.headline}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            font: `500 11px/1.4 ${FONT}`,
                            color: 'var(--ink-3)',
                          }}
                        >
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

          <div style={{ ...card, overflow: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
                padding: '12px 15px',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {['ALL', 'EMAIL', 'SMS'].map((ch) => {
                  const active = channelFilter === ch
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannelFilter(ch)}
                      style={{
                        padding: '4px 9px',
                        borderRadius: 7,
                        border: `1px solid ${active ? 'var(--violet-bd)' : 'var(--line)'}`,
                        background: active ? 'var(--violet-soft)' : 'var(--surface-2)',
                        color: active ? 'var(--violet)' : 'var(--ink-2)',
                        font: `600 11px/1 ${FONT}`,
                        cursor: 'pointer',
                      }}
                    >
                      {ch}
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {['ALL', 'DRAFT', 'SCHEDULED', 'LIVE', 'FAILED', 'ENDED'].map((st) => {
                  const active = stateFilter === st
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStateFilter(st)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 7,
                        border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                        background: active ? 'var(--surface-3)' : 'transparent',
                        color: active ? 'var(--ink)' : 'var(--ink-3)',
                        font: `500 10.5px/1 ${FONT}`,
                        cursor: 'pointer',
                      }}
                    >
                      {st}
                    </button>
                  )
                })}
                <span
                  style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)', marginLeft: 6 }}
                >
                  {filteredRows.length} record{filteredRows.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Campaign</th>
                    <th style={th}>Channel</th>
                    <th style={th}>Audience</th>
                    <th style={{ ...th, textAlign: 'right' }}>Sent</th>
                    <th style={{ ...th, textAlign: 'right' }}>Delivered</th>
                    <th style={{ ...th, textAlign: 'right' }}>Opened</th>
                    <th style={{ ...th, textAlign: 'right' }}>Clicked</th>
                    <th style={th}>State</th>
                    <th style={th} aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((c) => {
                    const state = mapCampaignStatus(c.status)
                    const tone = toneStyle(STATE_TONE[state])
                    const sent = Number(c.totalSent || 0)
                    const opened = Number(c.totalOpened || 0)
                    const canSend = state === 'draft' || state === 'scheduled' || state === 'failed'
                    const canEdit = state === 'draft' || state === 'scheduled' || state === 'failed'
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ ...td, color: 'var(--ink)' }}>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                              {c.name}
                            </span>
                            <span
                              style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}
                            >
                              {c.subject ?? 'no subject line'}
                            </span>
                          </span>
                        </td>
                        <td style={td}>{formatCampaignType(c.type)}</td>
                        <td
                          style={{
                            ...td,
                            color: c.recipientType ? 'var(--ink-2)' : 'var(--ink-3)',
                          }}
                        >
                          {c.recipientType ? formatCampaignType(c.recipientType) : 'not recorded'}
                        </td>
                        <td style={{ ...td, textAlign: 'right', font: `600 12.5px/1 ${MONO}` }}>
                          {sent.toLocaleString('en-IN')}
                        </td>
                        <td style={{ ...td, textAlign: 'right', font: `500 12.5px/1 ${MONO}` }}>
                          {Number(c.totalDelivered || 0).toLocaleString('en-IN')}
                        </td>
                        <td
                          style={{
                            ...td,
                            textAlign: 'right',
                            font: `500 12.5px/1 ${MONO}`,
                            color: sent > 20 && opened === 0 ? 'var(--bad)' : 'var(--ink-2)',
                          }}
                        >
                          {sent > 0 ? `${((opened / sent) * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ ...td, textAlign: 'right', font: `500 12.5px/1 ${MONO}` }}>
                          {sent > 0
                            ? `${((Number(c.totalClicked || 0) / sent) * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                        <td style={{ padding: '10px 15px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '3px 8px',
                              borderRadius: 6,
                              border: `1px solid ${tone.bd}`,
                              background: tone.bg,
                              color: tone.fg,
                              font: `600 11px/1 ${FONT}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 99,
                                background: 'currentColor',
                              }}
                            />
                            {state === 'draft'
                              ? 'Draft — not sent'
                              : state === 'scheduled'
                                ? c.scheduledAt
                                  ? `Sends ${fmtDateTime(c.scheduledAt)}`
                                  : 'Scheduled'
                                : state === 'live'
                                  ? c.sentAt
                                    ? `Sent ${fmtDateTime(c.sentAt)}`
                                    : 'Sending'
                                  : state === 'failed'
                                    ? 'Failed — retry available'
                                    : 'Ended'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 15px' }}>
                          <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {canEdit ? (
                              <button
                                type="button"
                                disabled={update.isPending}
                                onClick={() => {
                                  const audience = (
                                    Object.keys(AUDIENCE_LABEL) as CampaignAudience[]
                                  ).includes(c.recipientType as CampaignAudience)
                                    ? (c.recipientType as CampaignAudience)
                                    : 'ALL'
                                  setEditing(c)
                                  setForm({
                                    name: c.name,
                                    subject: c.subject ?? '',
                                    body: c.body ?? '',
                                    type: c.type === 'SMS' ? 'SMS' : 'EMAIL',
                                    targetAudience: audience,
                                    targetTag: c.recipientTags?.[0] ?? '',
                                  })
                                }}
                                style={{
                                  height: 28,
                                  padding: '0 11px',
                                  borderRadius: 8,
                                  border: '1px solid var(--line-2)',
                                  background: 'transparent',
                                  color: 'var(--ink-2)',
                                  cursor: update.isPending ? 'not-allowed' : 'pointer',
                                  font: `600 11.5px/1 ${FONT}`,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Edit
                              </button>
                            ) : null}
                            {canSend ? (
                              <button
                                type="button"
                                disabled={send.isPending}
                                onClick={() => setConfirmSend(c)}
                                style={{
                                  height: 28,
                                  padding: '0 11px',
                                  borderRadius: 8,
                                  border: '1px solid var(--violet-solid)',
                                  background: 'var(--violet-solid)',
                                  color: 'var(--on-violet)',
                                  cursor: send.isPending ? 'not-allowed' : 'pointer',
                                  font: `600 11.5px/1 ${FONT}`,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {state === 'failed' ? 'Retry send' : 'Send now'}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={duplicate.isPending}
                              onClick={() =>
                                duplicate.mutate(c.id, {
                                  onSuccess: (res) => {
                                    if (!res.id || mapCampaignStatus(res.status) !== 'draft') {
                                      toast(
                                        'bad',
                                        'Copy could not be verified',
                                        'Server did not return a saved draft.',
                                      )
                                      refetchAll()
                                      return
                                    }
                                    toast(
                                      'ok',
                                      `Copied to “${res.name}”`,
                                      'The copy is a draft — nothing was sent.',
                                    )
                                  },
                                  onError: (err) =>
                                    toast(
                                      'bad',
                                      'Could not duplicate',
                                      err instanceof Error
                                        ? err.message
                                        : `POST /marketing/campaigns/${c.id}/duplicate failed`,
                                    ),
                                })
                              }
                              style={{
                                height: 28,
                                padding: '0 11px',
                                borderRadius: 8,
                                border: '1px solid var(--line-2)',
                                background: 'transparent',
                                color: 'var(--ink-2)',
                                cursor: duplicate.isPending ? 'not-allowed' : 'pointer',
                                font: `600 11.5px/1 ${FONT}`,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${c.name}`}
                              title={`Delete ${c.name}`}
                              onClick={() => setConfirmDelete(c)}
                              style={{
                                display: 'grid',
                                placeItems: 'center',
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                border: '1px solid var(--bad-bd)',
                                background: 'var(--bad-soft)',
                                color: 'var(--bad)',
                                cursor: 'pointer',
                              }}
                            >
                              <DcIcon name="icon-trash-2" size={12} />
                            </button>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── create ───────────────────────────────────────────────── */}
      <DcModal
        open={newOpen || editing !== null}
        title={editing ? 'Edit campaign' : 'New campaign'}
        subtitle={
          editing
            ? 'Changes apply to this campaign. Nothing is sent while you edit.'
            : 'Saved as a draft. Nothing reaches a customer until you press Send.'
        }
        confirmLabel={editing ? 'Save changes' : 'Save draft'}
        busy={create.isPending || update.isPending}
        onClose={() => {
          setNewOpen(false)
          setEditing(null)
        }}
        onConfirm={runSave}
      >
        <DcField
          label="Internal name"
          value={form.name}
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          placeholder="Eid drop — repeat buyers"
          hint="Only you see this. Customers see the subject line."
        />

        {!editing ? (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                style={{
                  font: `600 11px/1 ${FONT}`,
                  letterSpacing: '.07em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                Channel
              </span>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CampaignType }))}
                style={selectStyle}
              >
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                style={{
                  font: `600 11px/1 ${FONT}`,
                  letterSpacing: '.07em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                Audience
              </span>
              <select
                value={form.targetAudience}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    targetAudience: e.target.value as CampaignAudience,
                  }))
                }
                style={selectStyle}
              >
                {(Object.keys(AUDIENCE_LABEL) as CampaignAudience[]).map((a) => (
                  <option key={a} value={a}>
                    {AUDIENCE_LABEL[a]}
                  </option>
                ))}
              </select>
            </label>

            {form.targetAudience === 'TAG' ? (
              <DcField
                label="Tag"
                value={form.targetTag}
                onChange={(v) => setForm((f) => ({ ...f, targetTag: v }))}
                mono
              />
            ) : null}
          </>
        ) : null}

        <DcField
          label="Subject"
          value={form.subject}
          onChange={(v) => setForm((f) => ({ ...f, subject: v }))}
          hint="This is the whole reason someone opens it."
        />
        <DcField
          label="Message"
          value={form.body}
          onChange={(v) => setForm((f) => ({ ...f, body: v }))}
          area
        />
      </DcModal>

      {/* ── send ─────────────────────────────────────────────────── */}
      <DcModal
        open={confirmSend !== null}
        title={confirmSend ? `Send “${confirmSend.name}” now?` : 'Send campaign'}
        subtitle={
          confirmSend
            ? `This goes out over ${formatCampaignType(confirmSend.type)} immediately. A send cannot be recalled.`
            : ''
        }
        confirmLabel="Send now"
        busy={send.isPending}
        onClose={() => setConfirmSend(null)}
        onConfirm={() =>
          confirmSend &&
          send.mutate(confirmSend.id, {
            onSuccess: (res) => {
              const name = confirmSend.name
              setConfirmSend(null)
              if (!Number.isFinite(res.sent) || res.sent < 0) {
                toast(
                  'bad',
                  'Send result could not be verified',
                  'Server returned an invalid recipient count.',
                )
              } else if (res.sent === 0) {
                toast(
                  'warn',
                  `${name} reached nobody`,
                  'Server reported 0 recipients. Check audience and channel setup.',
                )
              } else {
                toast(
                  'ok',
                  `${name} sent to ${res.sent.toLocaleString('en-IN')}`,
                  'Server confirmed recipient count. Open and click rates fill in later.',
                )
              }
            },
            onError: (err) => {
              setConfirmSend(null)
              toast(
                'bad',
                'Send failed',
                err instanceof Error
                  ? err.message
                  : `POST /marketing/campaigns/${confirmSend.id}/send failed`,
              )
            },
          })
        }
      />

      {/* ── delete ───────────────────────────────────────────────── */}
      <DcModal
        open={confirmDelete !== null}
        title={confirmDelete ? `Delete “${confirmDelete.name}”?` : 'Delete campaign'}
        subtitle={
          confirmDelete
            ? Number(confirmDelete.totalSent || 0) > 0
              ? `It already went to ${Number(confirmDelete.totalSent).toLocaleString('en-IN')} people. Deleting also loses its open and click history.`
              : 'It never sent, so nothing but the draft is lost.'
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
              if (res.deleted !== confirmDelete.id) {
                toast(
                  'bad',
                  'Delete could not be verified',
                  'Server did not confirm the campaign ID.',
                )
                refetchAll()
                return
              }
              const name = confirmDelete.name
              setConfirmDelete(null)
              toast('ok', `${name} deleted`, 'It is gone from the campaign list.')
            },
            onError: (err) => {
              setConfirmDelete(null)
              toast(
                'bad',
                'Could not delete the campaign',
                err instanceof Error
                  ? err.message
                  : `DELETE /marketing/campaigns/${confirmDelete.id} failed`,
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

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
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
  color?: string | undefined
}) {
  return (
    <div
      style={{
        ...card,
        padding: '14px 15px 13px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <span style={capsLabel}>{label}</span>
      <span
        style={{
          font: `700 25px/1 ${FONT}`,
          letterSpacing: '-.025em',
          color: color ?? 'var(--ink)',
        }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}

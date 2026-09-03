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
import { FONT, MONO, formatCount, toneStyle, type DcTone } from '@/components/dc/tokens'
import {
  formatCampaignType,
  mapCampaignStatus,
  type ApiCampaign,
  type CampaignAudience,
  type CampaignType,
  type CampaignRecipient,
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
  useAudienceEstimate,
  useCampaignRecipients,
  useCoupons,
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
  ALL: 'Everyone on file (All Customers)',
  LOYAL: 'Repeat buyers (2+ Orders / VIP)',
  HIGH_SPENDERS: 'Top spenders (৳10,000+ Lifetime)',
  INACTIVE: 'Gone quiet (No orders in 30d)',
  TAG: 'Target by specific tag',
}

interface CampaignForm {
  name: string
  subject: string
  body: string
  type: CampaignType
  targetAudience: CampaignAudience
  targetTag: string
  selectedCoupon?: string
}

const EMPTY_FORM: CampaignForm = {
  name: '',
  subject: '',
  body: '',
  type: 'WHATSAPP',
  targetAudience: 'ALL',
  targetTag: '',
  selectedCoupon: '',
}

const PRESET_TEMPLATES = [
  {
    title: '✨ Eid VIP Drop',
    desc: 'Festive early access',
    type: 'WHATSAPP' as CampaignType,
    audience: 'LOYAL' as CampaignAudience,
    subject: '✨ Exclusive Eid Drop: VIP Early Access',
    body: `Dear *{{name}}*,\n\nWe are delighted to invite you to the private showcase of our latest *Eid Couture Collection*.\n\nEnjoy an exclusive *{{coupon}}* VIP benefit on all new arrivals at {{store_url}}.\n\nWarm regards,\n*SPLARO Luxury Atelier*`,
  },
  {
    title: '👑 High Spender Perk',
    desc: 'Top customer reward',
    type: 'WHATSAPP' as CampaignType,
    audience: 'HIGH_SPENDERS' as CampaignAudience,
    subject: '👑 Private Privilege for {{first_name}}',
    body: `Hello *{{first_name}}*,\n\nAs one of our most valued patrons, your exclusive privilege code *{{coupon}}* is now active.\n\nExplore our bespoke bridal and festive line before public release: {{store_url}}\n\nComplimentary luxury shipping included.`,
  },
  {
    title: '📱 Flash Drop (SMS)',
    desc: 'Fast SMS broadcast',
    type: 'SMS' as CampaignType,
    audience: 'ALL' as CampaignAudience,
    subject: 'SPLARO Flash Drop',
    body: `SPLARO: Exclusive weekend drop! Enjoy special discount with code {{coupon}}. Shop now at {{store_url}}`,
  },
  {
    title: '🌸 Re-engagement',
    desc: 'Win back 30d+ quiet',
    type: 'WHATSAPP' as CampaignType,
    audience: 'INACTIVE' as CampaignAudience,
    subject: '🌸 We Miss You, {{first_name}}!',
    body: `Hi *{{first_name}}*,\n\nWe noticed you have not visited us recently. To welcome you back, enjoy a special discount with coupon code: *{{coupon}}*.\n\nDiscover what is new at SPLARO: {{store_url}}`,
  },
]

function renderFormattedText(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <strong key={i}>{part.slice(1, -1)}</strong>
    }
    return part
  })
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
  const coupons = useCoupons()
  const create = useCreateCampaign()
  const update = useUpdateCampaign()
  const send = useSendCampaign()
  const duplicate = useDuplicateCampaign()
  const remove = useDeleteCampaign()
  const { api } = useAdminConnection(25_000)

  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<ApiCampaign | null>(null)
  const [form, setForm] = useState<CampaignForm>(EMPTY_FORM)
  const [previewTab, setPreviewTab] = useState<CampaignType>('WHATSAPP')
  const [confirmSend, setConfirmSend] = useState<ApiCampaign | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ApiCampaign | null>(null)

  // WhatsApp Dispatch Drawer State
  const [dispatchCampaign, setDispatchCampaign] = useState<ApiCampaign | null>(null)
  const [sentRecipientIds, setSentRecipientIds] = useState<Set<string>>(new Set())
  const [queueSearch, setQueueSearch] = useState('')
  const [queueFilter, setQueueFilter] = useState<'ALL' | 'PENDING' | 'SENT'>('ALL')

  const recipientsQuery = useCampaignRecipients(dispatchCampaign?.id)

  const [channelFilter, setChannelFilter] = useState<string>('ALL')
  const [stateFilter, setStateFilter] = useState<string>('ALL')

  const audienceEstimate = useAudienceEstimate({
    type: form.type,
    audience: form.targetAudience,
    tag: form.targetTag,
  })

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
  // The KPI used to print a hardcoded `WhatsApp · SMS · Email`, which said
  // nothing about this store. Count the channels campaigns actually use.
  const channelsUsed = Array.from(
    new Set(
      rows.map((c) => {
        const type = (c.type || '').toUpperCase()
        if (type === 'WHATSAPP') return 'WhatsApp'
        if (type === 'SMS') return 'SMS'
        return 'Email'
      }),
    ),
  )

  const pageStatus = dcPageStatus([campaigns, stats], api.pulse)

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
            title: 'Drafts ready for dispatch',
            headline: String(drafts.length),
            detail: drafts
              .map((c) => c.name)
              .slice(0, 2)
              .join(' · '),
            why: 'Draft campaigns reach customers when you dispatch or schedule them.',
            tone: 'info' as DcTone,
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
            why: 'These will broadcast automatically when the schedule arrives.',
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
    setPreviewTab('WHATSAPP')
    setNewOpen(true)
  }

  const applyPreset = (preset: typeof PRESET_TEMPLATES[number]) => {
    setForm((f) => ({
      ...f,
      name: f.name || preset.title,
      subject: preset.subject,
      body: preset.body,
      type: preset.type,
      targetAudience: preset.audience,
    }))
    setPreviewTab(preset.type)
  }

  const insertVariable = (tag: string) => {
    setForm((f) => ({
      ...f,
      body: f.body ? `${f.body} ${tag}` : tag,
    }))
  }

  const onSelectCoupon = (code: string) => {
    setForm((f) => {
      let body = f.body
      if (code && !body.includes(code)) {
        body = body ? `${body}\n\nUse coupon code: *${code}* for special discount.` : `Use coupon code: *${code}* for special discount.`
      }
      return {
        ...f,
        selectedCoupon: code,
        body,
      }
    })
  }

  const runSave = () => {
    const name = form.name.trim()
    const subject = form.subject.trim()
    const body = form.body.trim()
    const targetTag = form.targetTag.trim()

    if (!name) {
      toast('warn', 'Name required', 'This is what you will look for in the campaign list.')
      return
    }
    if (!subject) {
      toast('warn', 'Subject / Title required', 'A compelling headline drives open and engagement rates.')
      return
    }
    if (!body) {
      toast('warn', 'Message body required', 'Please write the campaign content to dispatch.')
      return
    }
    if (form.targetAudience === 'TAG' && !targetTag) {
      toast('warn', 'Tag required', 'You selected a Tag audience but did not specify the tag name.')
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
            setEditing(null)
            setForm(EMPTY_FORM)
            toast('ok', `${res.name} updated`, 'The server confirmed campaign changes.')
          },
          onError: (err) =>
            toast(
              'bad',
              'Could not update campaign',
              err instanceof Error ? err.message : `PATCH failed`,
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
          setNewOpen(false)
          setForm(EMPTY_FORM)
          toast(
            'ok',
            `${res.name} created as draft`,
            'Nothing has been sent yet. Click "Send / Dispatch" when ready.',
          )
        },
        onError: (err) =>
          toast(
            'bad',
            'Could not create campaign',
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

  const exportWhatsAppQueueCsv = (campaignName: string, items: CampaignRecipient[]) => {
    if (items.length === 0) {
      toastWarn('No recipients found in queue')
      return
    }
    const headers = ['Name', 'Phone', 'Email', 'Formatted Message', 'WhatsApp Direct URL']
    const csvRows = [
      headers,
      ...items.map((r) => [r.name, r.phone || '', r.email || '', r.formattedMessage, r.whatsAppUrl]),
    ]
    downloadCsv(`whatsapp-dispatch-${campaignName.toLowerCase().replace(/\s+/g, '-')}.csv`, csvRows)
    toastOk(`Exported ${items.length} recipients for WhatsApp broadcast`)
  }

  // Calculate live SMS stats
  const isBanglaUnicode = /[\u0980-\u09FF]/.test(form.body)
  const charLimitPerSms = isBanglaUnicode ? 70 : 160
  const totalChars = form.body.length
  const smsParts = Math.max(1, Math.ceil(totalChars / charLimitPerSms))
  const recipientCount = audienceEstimate.data?.count ?? 0
  const estimatedSmsCost = (recipientCount * smsParts * 0.35).toFixed(2)

  // Filtered queue recipients
  const filteredRecipients = useMemo(() => {
    const list = recipientsQuery.data ?? []
    return list.filter((r) => {
      const matchSearch =
        !queueSearch ||
        r.name.toLowerCase().includes(queueSearch.toLowerCase()) ||
        (r.phone || '').includes(queueSearch)
      if (!matchSearch) return false
      const isSent = sentRecipientIds.has(r.id)
      if (queueFilter === 'PENDING') return !isSent
      if (queueFilter === 'SENT') return isSent
      return true
    })
  }, [recipientsQuery.data, queueSearch, queueFilter, sentRecipientIds])

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
          body="Create a targeted campaign for WhatsApp, SMS, or Email to reach your customers with exclusive drops and promos."
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
              label="Messages Sent"
              value={formatCount(totalSent)}
              sub={`${formatCount(rows.length)} campaigns created`}
            />
            <Kpi
              label="Open / Click Rate"
              value={stats.error ? '—' : `${openRate.toFixed(1)}%`}
              sub={stats.error ? 'Stats unavailable' : `${clickRate.toFixed(1)}% CTR recorded`}
            />
            <Kpi
              label="Channels Active"
              value={formatCount(channelsUsed.length)}
              sub={channelsUsed.length > 0 ? channelsUsed.join(' · ') : 'no campaigns on any channel yet'}
            />
            <Kpi
              label="Active Drafts"
              value={formatCount(drafts.length)}
              sub="Ready for dispatch"
              color={drafts.length > 0 ? 'var(--violet)' : undefined}
            />
          </div>

          {decisions.length > 0 ? (
            <div style={{ ...card, padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={capsLabel}>Attention Needed</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {decisions.map((d) => {
                  const tone = toneStyle(d.tone)
                  return (
                    <div
                      key={d.key}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: `1px solid ${tone.bd}`,
                        background: tone.bg,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ font: `600 12px/1 ${FONT}`, color: tone.fg }}>{d.title}</span>
                        <span style={{ font: `700 13px/1 ${MONO}`, color: tone.fg }}>{d.headline}</span>
                      </div>
                      <span style={{ font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>{d.why}</span>
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
                {['ALL', 'WHATSAPP', 'SMS', 'EMAIL'].map((ch) => {
                  const active = channelFilter === ch
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannelFilter(ch)}
                      style={{
                        padding: '6px 9px',
                        borderRadius: 7,
                        border: `1px solid ${active ? 'var(--violet-bd)' : 'var(--line)'}`,
                        background: active ? 'var(--violet-soft)' : 'var(--surface-2)',
                        color: active ? 'var(--violet)' : 'var(--ink-2)',
                        font: `600 11px/1 ${FONT}`,
                        cursor: 'pointer',
                      }}
                    >
                      {ch === 'WHATSAPP' ? '💬 WhatsApp' : ch === 'SMS' ? '📱 SMS' : ch === 'EMAIL' ? '✉️ Email' : 'All Channels'}
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
                        padding: '6px 8px',
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
                <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)', marginLeft: 6 }}>
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
                    <th style={{ ...th, textAlign: 'right' }}>Opened / Engaged</th>
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
                    const isWhatsApp = (c.type || '').toUpperCase() === 'WHATSAPP'
                    const canSend = state === 'draft' || state === 'scheduled' || state === 'failed'
                    const canEdit = state === 'draft' || state === 'scheduled' || state === 'failed'

                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ ...td, color: 'var(--ink)' }}>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                              {c.name}
                            </span>
                            <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
                              {c.subject ?? 'No headline'}
                            </span>
                          </span>
                        </td>
                        <td style={td}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '2px 7px',
                              borderRadius: 6,
                              background: isWhatsApp ? 'var(--ok-soft)' : 'var(--surface-2)',
                              color: isWhatsApp ? 'var(--ok)' : 'var(--ink)',
                              font: `600 11px/1 ${FONT}`,
                            }}
                          >
                            {isWhatsApp ? '💬 WhatsApp' : c.type === 'SMS' ? '📱 SMS' : '✉️ Email'}
                          </span>
                        </td>
                        <td style={{ ...td, color: 'var(--ink-2)' }}>
                          {AUDIENCE_LABEL[c.recipientType as CampaignAudience] ?? c.recipientType ?? 'All'}
                        </td>
                        <td style={{ ...td, textAlign: 'right', font: `600 12.5px/1 ${MONO}` }}>
                          {sent > 0 ? formatCount(sent) : '—'}
                        </td>
                        <td style={{ ...td, textAlign: 'right', font: `500 12.5px/1 ${MONO}` }}>
                          {sent > 0 ? formatCount(Number(c.totalDelivered || 0)) : '—'}
                        </td>
                        <td style={{ ...td, textAlign: 'right', font: `500 12.5px/1 ${MONO}` }}>
                          {sent > 0 ? `${((opened / sent) * 100).toFixed(1)}%` : '—'}
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
                            <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
                            {state === 'draft'
                              ? 'Draft'
                              : state === 'scheduled'
                                ? 'Scheduled'
                                : state === 'live'
                                  ? 'Dispatched'
                                  : state === 'failed'
                                    ? 'Failed'
                                    : 'Ended'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 15px' }}>
                          <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {isWhatsApp ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setDispatchCampaign(c)
                                  setQueueSearch('')
                                  setQueueFilter('ALL')
                                }}
                                style={{
                                  height: 28,
                                  padding: '0 11px',
                                  borderRadius: 8,
                                  border: '1px solid var(--ok-bd)',
                                  background: 'var(--ok-soft)',
                                  color: 'var(--ok)',
                                  cursor: 'pointer',
                                  font: `600 11.5px/1 ${FONT}`,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                💬 WhatsApp Queue
                              </button>
                            ) : null}

                            {canSend && !isWhatsApp ? (
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

                            {canEdit ? (
                              <button
                                type="button"
                                disabled={update.isPending}
                                onClick={() => {
                                  setEditing(c)
                                  setForm({
                                    name: c.name,
                                    subject: c.subject ?? '',
                                    body: c.body ?? '',
                                    type: (c.type as CampaignType) || 'WHATSAPP',
                                    targetAudience: (c.recipientType as CampaignAudience) || 'ALL',
                                    targetTag: c.recipientTags?.[0] ?? '',
                                    selectedCoupon: '',
                                  })
                                  setPreviewTab((c.type as CampaignType) || 'WHATSAPP')
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

                            <button
                              type="button"
                              disabled={duplicate.isPending}
                              onClick={() => duplicate.mutate(c.id)}
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
                              Copy
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

      {/* ── CREATE / EDIT MODAL WITH LIVE PREVIEW (EXPANDED STUDIO) ─── */}
      <DcModal
        open={newOpen || editing !== null}
        title={editing ? 'Edit Campaign' : 'Create Campaign Studio'}
        subtitle="Craft targeted messaging, dynamic variables, and preview the live mobile bubble."
        confirmLabel={editing ? 'Save Changes' : 'Save as Draft'}
        width="min(960px, 96vw)"
        busy={create.isPending || update.isPending}
        onClose={() => {
          setNewOpen(false)
          setEditing(null)
        }}
        onConfirm={runSave}
      >
        {/* Top: 1-Click Copy Presets */}
        {!editing ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={capsLabel}>⚡ 1-Click Luxury Templates</span>
              <span style={{ font: `400 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                Click to load pre-written high-converting copy
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              {PRESET_TEMPLATES.map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="dc-campaign-preset-btn"
                >
                  <span style={{ font: `600 11.5px/1.2 ${FONT}`, color: 'var(--ink)' }}>{preset.title}</span>
                  <span style={{ font: `400 10.5px/1.2 ${FONT}`, color: 'var(--ink-3)' }}>{preset.desc}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="dc-campaign-studio-grid">
          {/* Left Column: Form Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!editing ? (
              <div>
                <span style={capsLabel}>1. Select Outreach Channel</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                  {[
                    { id: 'WHATSAPP', label: '💬 WhatsApp', desc: 'VIP Direct' },
                    { id: 'SMS', label: '📱 SMS', desc: 'Bulk Blast' },
                    { id: 'EMAIL', label: '✉️ Email', desc: 'Rich HTML' },
                  ].map((ch) => {
                    const active = form.type === ch.id
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, type: ch.id as CampaignType }))
                          setPreviewTab(ch.id as CampaignType)
                        }}
                        className={`dc-campaign-channel-card ${active ? (ch.id === 'WHATSAPP' ? 'dc-campaign-channel-card--active-whatsapp' : 'dc-campaign-channel-card--active-other') : ''}`}
                      >
                        <div style={{ font: `700 13px/1.2 ${FONT}` }}>{ch.label}</div>
                        <div style={{ font: `400 10.5px/1.2 ${FONT}`, opacity: 0.75, marginTop: 3 }}>{ch.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <DcField
              label="Campaign Name"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="e.g. Eid Drop VIP Private Showcase"
              hint="Internal reference name in dashboard."
            />

            {!editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={capsLabel}>Target Audience Segment</span>
                  <span
                    style={{
                      font: `600 11px/1 ${MONO}`,
                      color: 'var(--violet)',
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: 'var(--violet-soft)',
                      border: '1px solid var(--violet-bd)',
                    }}
                  >
                    {audienceEstimate.isLoading
                      ? 'calculating…'
                      : `${audienceEstimate.data?.count ?? 0} recipients`}
                  </span>
                </div>
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
              </div>
            ) : null}

            {/* Active Coupon Selector */}
            {coupons.data?.coupons && coupons.data.coupons.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={capsLabel}>Link Active Store Coupon</span>
                <select
                  value={form.selectedCoupon}
                  onChange={(e) => onSelectCoupon(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">No coupon attached</option>
                  {coupons.data.coupons
                    .filter((cp) => cp.isActive)
                    .map((cp) => (
                      <option key={cp.id} value={cp.code}>
                        {cp.code} — {cp.type === 'PERCENTAGE' ? `${cp.value}% OFF` : `৳${cp.value} OFF`}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}

            <DcField
              label={form.type === 'EMAIL' ? 'Email Subject Line' : 'Broadcast Headline'}
              value={form.subject}
              onChange={(v) => setForm((f) => ({ ...f, subject: v }))}
              placeholder="e.g. ✨ Exclusive Eid Drop: 20% Off for VIP Members"
            />

            {/* Dedicated Variable Insertion Toolbar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={capsLabel}>Message Content</span>
                <span style={{ font: `400 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                  Personalized per customer
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                  padding: '6px 8px',
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                }}
              >
                <span style={{ font: `600 10.5px/1 ${FONT}`, color: 'var(--ink-3)', marginRight: 2 }}>
                  Tags:
                </span>
                {[
                  { tag: '{{name}}', label: 'Full Name' },
                  { tag: '{{first_name}}', label: 'First Name' },
                  { tag: '{{coupon}}', label: 'Coupon' },
                  { tag: '{{store_url}}', label: 'Store URL' },
                ].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => insertVariable(item.tag)}
                    className="dc-campaign-tag-chip"
                  >
                    <span>+</span>
                    <span>{item.tag}</span>
                  </button>
                ))}
              </div>

              <DcField
                label=""
                value={form.body}
                onChange={(v) => setForm((f) => ({ ...f, body: v }))}
                placeholder="Write your message here. In WhatsApp, use *bold* or _italics_ for luxury styling."
                area
              />

              {/* Real-time Delivery & Cost Breakdown */}
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  font: `500 11.5px/1.3 ${FONT}`,
                  color: 'var(--ink-2)',
                }}
              >
                {form.type === 'SMS' ? (
                  <>
                    <span>
                      {isBanglaUnicode ? 'Bangla (Unicode)' : 'GSM (English)'} · {totalChars}/{charLimitPerSms} chars ({smsParts} SMS {smsParts > 1 ? 'parts' : 'part'})
                    </span>
                    <span style={{ font: `700 11.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                      Est: ৳{estimatedSmsCost}
                    </span>
                  </>
                ) : form.type === 'WHATSAPP' ? (
                  <>
                    <span>💬 Direct VIP Outreach via WhatsApp</span>
                    <span style={{ font: `700 11.5px/1 ${MONO}`, color: 'var(--ok)' }}>
                      Free (৳0 Gateway Cost)
                    </span>
                  </>
                ) : (
                  <>
                    <span>✉️ SMTP Verified Email Blast</span>
                    <span style={{ font: `700 11.5px/1 ${MONO}`, color: 'var(--violet)' }}>
                      {recipientCount} Recipients
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Sleek Live Mobile Phone Mockup Studio */}
          <div className="dc-campaign-phone-frame">
            {/* Phone Speaker Notch Header */}
            <div className="dc-campaign-phone-notch">
              <div className="dc-campaign-phone-speaker" />
            </div>

            {/* Preview Channel Switcher Header */}
            <div className="dc-campaign-phone-tabs">
              {[
                { id: 'WHATSAPP' as CampaignType, label: '💬 WhatsApp' },
                { id: 'SMS' as CampaignType, label: '📱 SMS' },
                { id: 'EMAIL' as CampaignType, label: '✉️ Email' },
              ].map((tab) => {
                const active = previewTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewTab(tab.id)}
                    className={`dc-campaign-phone-tab-btn ${active ? 'dc-campaign-phone-tab-btn--active' : ''}`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {previewTab === 'WHATSAPP' ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {/* WhatsApp Chat App Bar */}
                <div
                  style={{
                    background: 'var(--surface-3)',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 99,
                      background: 'var(--ok)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--on-violet)',
                      font: `700 13px/1 ${FONT}`,
                    }}
                  >
                    S
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        font: `600 12.5px/1.2 ${FONT}`,
                        color: 'var(--ink)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      SPLARO Concierge
                      <span style={{ color: 'var(--ok)', fontSize: 11 }}>✓</span>
                    </div>
                    <div style={{ font: `400 10.5px/1.2 ${FONT}`, color: 'var(--ink-3)' }}>
                      Official Business
                    </div>
                  </div>
                </div>

                {/* WhatsApp Chat Body */}
                <div
                  style={{
                    padding: 14,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    background: 'var(--surface-2)',
                  }}
                >
                  <div className="dc-campaign-whatsapp-bubble">
                    {form.subject ? (
                      <div
                        style={{
                          fontWeight: 700,
                          marginBottom: 6,
                          color: 'var(--ink)',
                          borderBottom: '1px dashed var(--ok-bd)',
                          paddingBottom: 4,
                        }}
                      >
                        {form.subject}
                      </div>
                    ) : null}
                    <div>
                      {form.body
                        ? renderFormattedText(
                            form.body
                              .replace(/\{\{\s*name\s*\}\}/gi, 'Fatema Khan')
                              .replace(/\{\{\s*first_name\s*\}\}/gi, 'Fatema')
                              .replace(/\{\{\s*coupon\s*\}\}/gi, form.selectedCoupon || 'EID20')
                              .replace(/\{\{\s*store_url\s*\}\}/gi, 'https://splaro.co'),
                          )
                        : 'Hello {{name}}, preview your WhatsApp message bubble here in real time.'}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 6,
                      }}
                    >
                      <span style={{ font: `400 10px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                        10:42 AM
                      </span>
                      <span style={{ color: 'var(--info)', fontSize: 11 }}>✓✓</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : previewTab === 'SMS' ? (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, background: 'var(--surface-2)' }}>
                <div style={{ textAlign: 'center', font: `600 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                  SMS Preview · Sender ID: SPLARO
                </div>
                <div className="dc-campaign-sms-bubble">
                  {form.body
                    ? form.body
                        .replace(/\{\{\s*name\s*\}\}/gi, 'Fatema')
                        .replace(/\{\{\s*coupon\s*\}\}/gi, form.selectedCoupon || 'EID20')
                        .replace(/\{\{\s*store_url\s*\}\}/gi, 'splaro.co')
                    : 'SPLARO: New arrivals! Shop now at splaro.co'}
                </div>
              </div>
            ) : (
              <div className="dc-campaign-email-card">
                <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    From: <b>SPLARO</b> &lt;concierge@splaro.co&gt;
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                    {form.subject || 'Exclusive Drop for You'}
                  </div>
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', flex: 1 }}>
                  {form.body
                    ? form.body
                        .replace(/\{\{\s*name\s*\}\}/gi, 'Fatema Khan')
                        .replace(/\{\{\s*coupon\s*\}\}/gi, form.selectedCoupon || 'EID20')
                    : 'Discover our newest luxury arrivals exclusively curated for you.'}
                </div>
              </div>
            )}
          </div>
        </div>
      </DcModal>

      {/* ── WHATSAPP DISPATCH QUEUE STUDIO MODAL ───────────────────── */}
      <DcModal
        open={dispatchCampaign !== null}
        title={dispatchCampaign ? `💬 WhatsApp Dispatch: ${dispatchCampaign.name}` : 'WhatsApp Dispatch'}
        subtitle="Launch personalized 1-click WhatsApp chats with each targeted customer, or download the full broadcast CSV."
        confirmLabel="Close Queue"
        width="min(860px, 96vw)"
        onClose={() => setDispatchCampaign(null)}
        onConfirm={() => setDispatchCampaign(null)}
      >
        {recipientsQuery.isLoading ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
            Loading targeted recipients…
          </div>
        ) : recipientsQuery.data && recipientsQuery.data.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              {/* Search & Filter bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
                <input
                  type="text"
                  placeholder="Search by customer name or phone…"
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  style={{
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    color: 'var(--ink)',
                    font: `400 12px/1 ${FONT}`,
                    outline: 'none',
                    flex: 1,
                  }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['ALL', 'PENDING', 'SENT'] as const).map((filter) => {
                    const active = queueFilter === filter
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setQueueFilter(filter)}
                        style={{
                          height: 34,
                          padding: '0 10px',
                          borderRadius: 8,
                          border: `1px solid ${active ? 'var(--violet-bd)' : 'var(--line)'}`,
                          background: active ? 'var(--violet-soft)' : 'var(--surface-2)',
                          color: active ? 'var(--violet)' : 'var(--ink-2)',
                          font: `600 11px/1 ${FONT}`,
                          cursor: 'pointer',
                        }}
                      >
                        {filter}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() =>
                    dispatchCampaign &&
                    exportWhatsAppQueueCsv(dispatchCampaign.name, recipientsQuery.data ?? [])
                  }
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--line-2)',
                    background: 'var(--surface-2)',
                    color: 'var(--ink-2)',
                    font: `600 11.5px/1 ${FONT}`,
                    cursor: 'pointer',
                  }}
                >
                  📥 Download CSV ({filteredRecipients.length})
                </button>
              </div>
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <th style={th}>Customer</th>
                    <th style={th}>Phone Number</th>
                    <th style={th}>Dispatch Status</th>
                    <th style={{ ...th, textAlign: 'right' }}>Direct Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipients.map((r) => {
                    const isSent = sentRecipientIds.has(r.id)
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ ...td, fontWeight: 600, color: 'var(--ink)' }}>{r.name}</td>
                        <td style={{ ...td, font: `500 12px/1 ${MONO}` }}>{r.phone || 'No phone'}</td>
                        <td style={td}>
                          {isSent ? (
                            <span style={{ color: 'var(--ok)', fontWeight: 600, fontSize: 11 }}>✓ Dispatched</span>
                          ) : (
                            <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>Pending</span>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <a
                            href={r.whatsAppUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setSentRecipientIds((prev) => new Set([...prev, r.id]))}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 12px',
                              borderRadius: 7,
                              background: isSent ? 'var(--ok-soft)' : 'var(--ok)',
                              color: isSent ? 'var(--ok)' : 'var(--on-violet)',
                              border: isSent ? '1px solid var(--ok-bd)' : 'none',
                              font: `600 11.5px/1 ${FONT}`,
                              textDecoration: 'none',
                            }}
                          >
                            💬 {isSent ? 'Resend' : 'Send WhatsApp'}
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
            No recipients with phone numbers matched this segment.
          </div>
        )}
      </DcModal>

      {/* ── SMS & EMAIL SEND CONFIRMATION MODAL ────────────────────── */}
      <DcModal
        open={confirmSend !== null}
        title={confirmSend ? `Send “${confirmSend.name}” now?` : 'Send campaign'}
        subtitle={
          confirmSend
            ? `This broadcast will be sent via ${formatCampaignType(confirmSend.type)} immediately.`
            : ''
        }
        confirmLabel="Confirm & Send"
        busy={send.isPending}
        onClose={() => setConfirmSend(null)}
        onConfirm={() =>
          confirmSend &&
          send.mutate(confirmSend.id, {
            onSuccess: (res) => {
              const name = confirmSend.name
              setConfirmSend(null)
              if (res.sent === 0) {
                toast('warn', `${name} reached 0 recipients`, 'No recipients matched the audience.')
              } else {
                toast('ok', `${name} successfully sent to ${res.sent.toLocaleString('en-IN')}`, 'Delivery logs updated.')
              }
            },
            onError: (err) => {
              setConfirmSend(null)
              toast(
                'bad',
                'Send failed',
                err instanceof Error ? err.message : 'Broadcast delivery failed',
              )
            },
          })
        }
      />

      {/* ── DELETE MODAL ───────────────────────────────────────────── */}
      <DcModal
        open={confirmDelete !== null}
        title={confirmDelete ? `Delete “${confirmDelete.name}”?` : 'Delete campaign'}
        subtitle="This action permanently deletes the campaign record and cannot be undone."
        confirmLabel="Delete for good"
        danger
        busy={remove.isPending}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() =>
          confirmDelete &&
          remove.mutate(confirmDelete.id, {
            onSuccess: () => {
              setConfirmDelete(null)
              toast('ok', 'Campaign deleted', 'Record removed from system.')
            },
            onError: (err) => {
              setConfirmDelete(null)
              toast('bad', 'Could not delete', err instanceof Error ? err.message : 'DELETE failed')
            },
          })
        }
      />
    </>
  )
}

const selectStyle = {
  height: 38,
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
          font: `700 22px/1 ${FONT}`,
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

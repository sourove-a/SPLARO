'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { useMarketingOverview } from '@/lib/api/hooks'
import { sendTestSms } from '@/lib/api/notifications'
import { formatBdPhone, localBdNumber, operatorOf, telHref } from '@/lib/format/bd-phone'
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

/** Rate per segment used for the cost estimate on this screen only. */
const TAKA_PER_SEGMENT = 0.35
const GSM_PER_SEGMENT = 160
const UCS2_PER_SEGMENT = 70

const TEMPLATES: Array<{ label: string; body: string; why: string }> = [
  {
    label: 'Order confirmed',
    body: 'আপনার SPLARO অর্ডার কনফার্ম হয়েছে। COD ডেলিভারির আগে কল আসবে।',
    why: 'Sent right after checkout so the customer knows COD means a call first.',
  },
  {
    label: 'Out for delivery',
    body: 'আপনার SPLARO পার্সেল আজ ডেলিভারির জন্য বের হয়েছে। ফোন সঙ্গে রাখুন।',
    why: 'Cuts failed deliveries — the rider gets picked up on the first call.',
  },
  {
    label: 'Advance payment needed',
    body: 'COD ঝুঁকির কারণে অর্ডারটি কনফার্ম করতে অগ্রিম পেমেন্ট লাগবে। বিকাশ: 01711-204556',
    why: 'Used on flagged COD orders instead of cancelling them outright.',
  },
  {
    label: 'Back in stock',
    body: 'Your saved SPLARO item is back in stock. Order before it goes again.',
    why: 'English on purpose — this one goes to the list that reads English.',
  },
]

/**
 * A single SMS is 160 GSM-7 characters, but any Bangla character forces the whole
 * message to UCS-2, where a segment is only 70 characters. That is the difference
 * between one SMS and three for the same sentence, so it is worth showing.
 */
function segmentsOf(text: string): {
  chars: number
  unicode: boolean
  perSegment: number
  segments: number
  cost: number
} {
  const chars = [...text].length
  // Anything outside printable ASCII (Bangla, emoji, curly quotes) forces UCS-2.
  const unicode = /[^\u0020-\u007e]/.test(text)
  const perSegment = unicode ? UCS2_PER_SEGMENT : GSM_PER_SEGMENT
  const segments = chars === 0 ? 0 : Math.ceil(chars / perSegment)
  return { chars, unicode, perSegment, segments, cost: segments * TAKA_PER_SEGMENT }
}

/**
 * The order `SmsService` tries providers in. No endpoint reports which keys are
 * set, so this screen states the order and marks only what it can prove — the
 * provider that answered the last send from here.
 */
const PROVIDER_CHAIN: Array<{ id: string; title: string; sub: string }> = [
  {
    id: 'bdbulksms',
    title: 'BDBulkSMS · first choice',
    sub: 'bulksmsbd.net · needs BDBULKSMS_API_KEY on the API',
  },
  {
    id: 'elitbuzz',
    title: 'ElitBuzz · fallback',
    sub: 'msg.elitbuzz-bd.com · needs ELITBUZZ_API_TOKEN',
  },
  {
    id: 'greenweb',
    title: 'GreenWeb · last resort',
    sub: 'api.greenweb.com.bd · needs GREENWEB_SMS_USER and PASS',
  },
]

const FACTS: Array<{ icon: string; title: string; sub: string; tag: string }> = [
  {
    icon: 'icon-phone',
    title: 'Numbers are normalised to 880…',
    sub: '01711-204556 and +880 1711-204556 both become 8801711204556 before sending.',
    tag: 'AUTO',
  },
  {
    icon: 'icon-shield-x',
    title: 'A bad number is refused, not sent',
    sub: 'the API rejects anything that is not a valid 01XXXXXXXXX mobile before it reaches a provider.',
    tag: 'GUARD',
  },
  {
    icon: 'icon-triangle-alert',
    title: 'A failed send is never retried',
    sub: 'the log keeps the provider error; sending again is a manual decision.',
    tag: 'MANUAL',
  },
  {
    icon: 'icon-zap',
    title: 'Automation sends through the same chain',
    sub: 'a SEND_SMS automation rule bills exactly like a send from this screen.',
    tag: 'LINKED',
  },
]

const STATUS_TONE = (status: string): DcTone => {
  const s = status.toUpperCase()
  if (s === 'SENT' || s === 'DELIVERED') return 'ok'
  if (s === 'FAILED' || s === 'REJECTED' || s === 'BOUNCED') return 'bad'
  if (s === 'PENDING' || s === 'QUEUED') return 'warn'
  return 'mute'
}

export function DcSmsCenter() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="sms" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcSmsCenterBody />
    </DcScreenProvider>
  )
}

function DcSmsCenterBody() {
  const { toast } = useDcScreen()
  const overview = useMarketingOverview()
  const { api } = useAdminConnection(25_000)

  const [phone, setPhone] = useState('01711-204556')
  const [draft, setDraft] = useState(TEMPLATES[0]?.body ?? '')
  const [confirmSend, setConfirmSend] = useState(false)
  const [sending, setSending] = useState(false)
  /** Which link in the provider chain served the last send from this screen. */
  const [lastProvider, setLastProvider] = useState<string | null>(null)

  const logs = useMemo(() => overview.data?.smsLogs ?? [], [overview.data])
  const seg = useMemo(() => segmentsOf(draft), [draft])
  const pageStatus = dcPageStatus([overview], api.pulse)

  const sent = logs.filter((l) => ['SENT', 'DELIVERED'].includes(l.status.toUpperCase()))
  const failed = logs.filter((l) =>
    ['FAILED', 'REJECTED', 'BOUNCED'].includes(l.status.toUpperCase()),
  )
  const deliveryRate = logs.length > 0 ? (sent.length / logs.length) * 100 : 0
  const digits = localBdNumber(phone)
  const phoneValid = digits.length === 11 && digits.startsWith('01')
  const operator = operatorOf(phone)

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'form', w: 'main', title: '', fields: [] } as DcBlock,
    { t: 'list', w: 'side', title: '', items: [] } as DcBlock,
    { t: 'table', w: 'full', title: '', cols: [], rows: [] } as DcBlock,
  ]

  const runSend = () => {
    setSending(true)
    setConfirmSend(false)
    sendTestSms(digits, draft)
      .then((res) => {
        // The endpoint answers 200 even when the provider refused, so `ok` is
        // the only thing that says whether anything actually left the building.
        if (!res.ok) {
          setLastProvider(null)
          toast('bad', 'The provider refused it', res.message)
          return
        }
        setLastProvider(res.provider)
        toast(
          'ok',
          `Accepted by ${res.provider ?? 'the provider'} for ${formatBdPhone(digits)}`,
          'Accepted is not delivered — the operator decides that.',
        )
        void overview.refetch()
      })
      .catch((err: unknown) =>
        toast(
          'bad',
          'Send failed',
          err instanceof Error ? err.message : 'POST /admin/notifications/test/sms failed',
        ),
      )
      .finally(() => setSending(false))
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Integrations"
        title="SMS Center"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          overview.isFetching
            ? 'syncing…'
            : `${logs.length} log${logs.length === 1 ? '' : 's'} · ${deliveryRate.toFixed(0)}% delivered`
        }
        syncing={overview.isFetching}
        onSync={() => void overview.refetch()}
      />

      <div
        style={{
          ...card,
          borderLeft: '3px solid var(--warn)',
          padding: '12px 15px',
          display: 'flex',
          gap: 11,
          alignItems: 'flex-start',
        }}
      >
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 26,
            height: 26,
            flex: 'none',
            borderRadius: 8,
            border: '1px solid var(--warn-bd)',
            background: 'var(--warn-soft)',
            color: 'var(--warn)',
          }}
        >
          <DcIcon name="icon-triangle-alert" size={13} />
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            font: `400 12.5px/1.6 ${FONT}`,
            color: 'var(--ink-2)',
            textWrap: 'pretty',
          }}
        >
          Bangla is Unicode: {UCS2_PER_SEGMENT} characters per SMS, not {GSM_PER_SEGMENT}. The same
          sentence in Bangla can cost three times what it costs in English — the segment count under
          the composer is the real billing unit, not the character count.
        </span>
      </div>

      {overview.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : overview.error ? (
        <DcErrorState
          error={`GET /admin/hub/marketing/overview → ${overview.error instanceof Error ? overview.error.message : '500 Internal Server Error'}`}
          hint="Order SMS still fires from the API — only this console's log view failed."
          onRetry={() => void overview.refetch()}
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
            <Kpi label="Messages logged" value={String(logs.length)} sub="in the window the API returns" />
            <Kpi
              label="Delivered"
              value={`${deliveryRate.toFixed(0)}%`}
              sub={`${sent.length} of ${logs.length}`}
              color={logs.length > 0 && deliveryRate < 90 ? 'var(--warn)' : 'var(--ok)'}
            />
            <Kpi
              label="Failed"
              value={String(failed.length)}
              sub={failed.length > 0 ? 'operator or provider rejected these' : 'nothing rejected'}
              color={failed.length > 0 ? 'var(--bad)' : undefined}
            />
            <Kpi
              label="Cost per Bangla SMS"
              value={`৳${TAKA_PER_SEGMENT.toFixed(2)}`}
              sub="per 70-character segment"
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'flex-start',
              width: '100%',
            }}
          >
            <div style={{ flex: '1 1 52%', minWidth: 330, maxWidth: '100%' }}>
              <div style={{ ...card, overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '12px 15px',
                    borderBottom: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 9,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 120,
                      font: `600 13.5px/1.3 ${FONT}`,
                      color: 'var(--ink)',
                    }}
                  >
                    Send one message
                  </span>
                  <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    goes to a real phone
                  </span>
                </div>
                <div
                  style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 13 }}
                >
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span
                      style={{
                        font: `600 11px/1 ${FONT}`,
                        letterSpacing: '.07em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-3)',
                      }}
                    >
                      Recipient
                    </span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01711-204556"
                      inputMode="tel"
                      style={{
                        height: 40,
                        padding: '0 12px',
                        borderRadius: 9,
                        border: `1px solid ${phone && !phoneValid ? 'var(--bad-bd)' : 'var(--line)'}`,
                        background: 'var(--surface-2)',
                        outline: 'none',
                        color: 'var(--ink)',
                        font: `400 13px/1 ${MONO}`,
                      }}
                    />
                    <span
                      style={{
                        font: `400 11.5px/1.4 ${FONT}`,
                        color: phone && !phoneValid ? 'var(--bad)' : 'var(--ink-3)',
                      }}
                    >
                      {!phone
                        ? 'A BD mobile number — 11 digits starting 01.'
                        : phoneValid
                          ? `${formatBdPhone(digits)}${operator ? ` · ${operator}` : ''}`
                          : `${digits.length} digit${digits.length === 1 ? '' : 's'} — a BD mobile number needs 11, starting 01.`}
                    </span>
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
                      Message
                    </span>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={4}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 9,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        outline: 'none',
                        resize: 'vertical',
                        color: 'var(--ink)',
                        font: `400 13px/1.6 ${FONT}`,
                      }}
                    />
                  </label>

                  {/* Rule 4: never a bare character count — say what it costs. */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 7,
                      padding: '11px 12px',
                      border: `1px solid ${seg.unicode ? 'var(--warn-bd)' : 'var(--line)'}`,
                      borderRadius: 10,
                      background: seg.unicode ? 'var(--warn-soft)' : 'var(--surface-2)',
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          font: `700 15px/1.2 ${MONO}`,
                          color: seg.unicode ? 'var(--warn)' : 'var(--ink)',
                        }}
                      >
                        {seg.segments} SMS
                      </span>
                      <span style={{ font: `600 12.5px/1.3 ${MONO}`, color: 'var(--ink-2)' }}>
                        ≈ ৳{seg.cost.toFixed(2)}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 90,
                          textAlign: 'right',
                          font: `500 11.5px/1.3 ${MONO}`,
                          color: 'var(--ink-3)',
                        }}
                      >
                        {seg.chars}/{seg.perSegment} per segment
                      </span>
                    </span>
                    <span
                      style={{
                        font: `400 11.5px/1.5 ${FONT}`,
                        color: 'var(--ink-3)',
                        textWrap: 'pretty',
                      }}
                    >
                      {seg.unicode
                        ? 'Bangla forces the whole message into Unicode, so a segment is 70 characters instead of 160. Writing the same thing in English would cost less than half.'
                        : 'Plain English stays in GSM-7 at 160 characters per segment. One Bangla character drops that to 70.'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={sending || !phoneValid || seg.segments === 0}
                      onClick={() => setConfirmSend(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        height: 34,
                        padding: '0 14px',
                        borderRadius: 9,
                        border: '1px solid var(--violet-solid)',
                        background: 'var(--violet-solid)',
                        color: 'var(--on-violet)',
                        cursor:
                          sending || !phoneValid || seg.segments === 0 ? 'not-allowed' : 'pointer',
                        opacity: sending || !phoneValid || seg.segments === 0 ? 0.55 : 1,
                        font: `600 12.5px/1 ${FONT}`,
                      }}
                    >
                      <DcIcon name="icon-send" size={13} />
                      <span>{sending ? 'Sending…' : `Send ${seg.segments} SMS`}</span>
                    </button>
                    {phoneValid ? (
                      <a
                        href={telHref(digits)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          height: 34,
                          padding: '0 13px',
                          borderRadius: 9,
                          border: '1px solid var(--line-2)',
                          color: 'var(--ink-2)',
                          font: `600 12.5px/1 ${FONT}`,
                        }}
                      >
                        <DcIcon name="icon-phone" size={13} />
                        <span>Call instead</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flex: '1 1 32%', minWidth: 290, maxWidth: '100%' }}>
              <div style={{ ...card, padding: '6px 16px 10px' }}>
                <div style={{ padding: '12px 0 9px' }}>
                  <span style={{ font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                    Templates
                  </span>
                </div>
                {TEMPLATES.map((tpl) => {
                  const s = segmentsOf(tpl.body)
                  return (
                    <div
                      key={tpl.label}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        padding: '11px 0',
                        borderTop: '1px solid var(--line)',
                      }}
                    >
                      <span
                        style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}
                      >
                        <span
                          style={{
                            flex: 1,
                            minWidth: 90,
                            font: `600 12.5px/1.3 ${FONT}`,
                            color: 'var(--ink)',
                          }}
                        >
                          {tpl.label}
                        </span>
                        <span style={{ font: `600 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                          {s.segments} SMS · ৳{s.cost.toFixed(2)}
                        </span>
                      </span>
                      <span
                        style={{
                          font: `400 11.5px/1.5 ${FONT}`,
                          color: 'var(--ink-3)',
                          textWrap: 'pretty',
                        }}
                      >
                        {tpl.why}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDraft(tpl.body)}
                        style={{
                          alignSelf: 'flex-start',
                          height: 28,
                          padding: '0 11px',
                          borderRadius: 8,
                          border: '1px solid var(--line-2)',
                          background: 'transparent',
                          color: 'var(--ink-2)',
                          cursor: 'pointer',
                          font: `600 11.5px/1 ${FONT}`,
                        }}
                      >
                        Use this
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'flex-start',
              width: '100%',
            }}
          >
            <div style={{ flex: '1 1 46%', minWidth: 300, maxWidth: '100%' }}>
              <div style={{ ...card, padding: '6px 16px 10px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 9,
                    flexWrap: 'wrap',
                    padding: '12px 0 9px',
                  }}
                >
                  <span
                    style={{ flex: 1, minWidth: 110, font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}
                  >
                    Provider chain
                  </span>
                  <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    tried in this order
                  </span>
                </div>
                {PROVIDER_CHAIN.map((p, i) => {
                  const served = lastProvider === p.id
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
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
                          color: served ? 'var(--ok)' : 'var(--ink-3)',
                          font: `600 11px/1 ${MONO}`,
                        }}
                      >
                        {i + 1}
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
                        <span style={{ font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                          {p.title}
                        </span>
                        <span
                          style={{
                            font: `400 11px/1.45 ${MONO}`,
                            color: 'var(--ink-3)',
                            wordBreak: 'break-word',
                          }}
                        >
                          {p.sub}
                        </span>
                      </span>
                      {served ? (
                        <span
                          style={{
                            flex: 'none',
                            alignSelf: 'flex-start',
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--ok-bd)',
                            background: 'var(--ok-soft)',
                            color: 'var(--ok)',
                            font: '700 9px/1.4 Inter, sans-serif',
                            letterSpacing: '.08em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          SERVED LAST SEND
                        </span>
                      ) : null}
                    </div>
                  )
                })}
                <div
                  style={{
                    marginTop: 10,
                    padding: '9px 11px',
                    borderRadius: 9,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    font: `400 11.5px/1.55 ${FONT}`,
                    color: 'var(--ink-3)',
                  }}
                >
                  No endpoint reports which of these keys are set on the API, so this screen will
                  not claim one is active. Send a message — whichever provider answers is marked
                  above.
                </div>
              </div>
            </div>

            <div style={{ flex: '1 1 46%', minWidth: 300, maxWidth: '100%' }}>
              <div style={{ ...card, padding: '6px 16px 10px' }}>
                <div style={{ padding: '12px 0 9px' }}>
                  <span style={{ font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                    Things worth knowing
                  </span>
                </div>
                {FACTS.map((f) => (
                  <div
                    key={f.title}
                    style={{
                      display: 'flex',
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
                        color: 'var(--ink-2)',
                      }}
                    >
                      <DcIcon name={f.icon} size={13} />
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
                      <span style={{ font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                        {f.title}
                      </span>
                      <span
                        style={{
                          font: `400 11.5px/1.45 ${FONT}`,
                          color: 'var(--ink-3)',
                          textWrap: 'pretty',
                        }}
                      >
                        {f.sub}
                      </span>
                    </span>
                    <span
                      style={{
                        flex: 'none',
                        alignSelf: 'flex-start',
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--line-2)',
                        color: 'var(--ink-3)',
                        font: '700 9px/1.4 Inter, sans-serif',
                        letterSpacing: '.08em',
                      }}
                    >
                      {f.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...card, overflow: 'auto' }}>
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
                Delivery log
              </span>
              <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                newest first, straight from the API
              </span>
            </div>
            {logs.length === 0 ? (
              <div
                style={{
                  padding: '40px 15px',
                  textAlign: 'center',
                  font: `400 12.5px/1.55 ${FONT}`,
                  color: 'var(--ink-3)',
                }}
              >
                No SMS has been logged yet. Order and delivery messages appear here once they fire.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Recipient</th>
                    <th style={th}>Message</th>
                    <th style={{ ...th, textAlign: 'right' }}>Segments</th>
                    <th style={th}>Status</th>
                    <th style={th}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => {
                    const tone = toneStyle(STATUS_TONE(l.status))
                    const s = segmentsOf(l.body ?? '')
                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          <a
                            href={telHref(l.recipient)}
                            style={{
                              font: `500 12.5px/1 ${MONO}`,
                              color: 'var(--ink)',
                              borderBottom: '1px solid var(--line-2)',
                            }}
                          >
                            {formatBdPhone(l.recipient)}
                          </a>
                        </td>
                        <td style={{ ...td, maxWidth: 380 }}>
                          {l.body ?? l.subject ?? '—'}
                        </td>
                        <td
                          style={{
                            ...td,
                            textAlign: 'right',
                            font: `500 12.5px/1 ${MONO}`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {s.segments} · ৳{s.cost.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 15px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
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
                            {l.status}
                          </span>
                        </td>
                        <td style={{ ...td, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                          {new Date(l.createdAt).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <DcModal
        open={confirmSend}
        title={`Send ${seg.segments} SMS to ${formatBdPhone(digits)}?`}
        subtitle={`This reaches a real phone and costs roughly ৳${seg.cost.toFixed(2)}. An SMS cannot be recalled.`}
        confirmLabel="Send it"
        busy={sending}
        onClose={() => setConfirmSend(false)}
        onConfirm={runSend}
      />
    </>
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

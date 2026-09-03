'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatCount, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastApiSaved, toastFail, toastIntegrationTestResult, toastWarn } from '@/lib/admin/feedback'
import { useMarketingOverview } from '@/lib/api/hooks'
import {
  useSmsIntegration,
  useTestSmsIntegration,
  useUpdateSmsIntegration,
} from '@/lib/api/integration-hooks'
import type { SmsGateway } from '@/lib/api/integrations'
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

/**
 * Stand-in for the store's own payment number. Kept as a token instead of a
 * literal number: a wrong number in this template sends the customer's advance
 * payment to a stranger, so the send is blocked until it is filled in.
 */
const PAYMENT_NUMBER_TOKEN = '[আপনার বিকাশ নম্বর]'

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
    body: `COD ঝুঁকির কারণে অর্ডারটি কনফার্ম করতে অগ্রিম পেমেন্ট লাগবে। বিকাশ: ${PAYMENT_NUMBER_TOKEN}`,
    why: `Used on flagged COD orders instead of cancelling them outright. Replace ${PAYMENT_NUMBER_TOKEN} with your own bKash number — sending is blocked until you do.`,
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
const GATEWAYS: Array<{ id: SmsGateway; title: string; hint: string; defaultUrl: string }> = [
  {
    id: 'bdbulksms',
    title: 'BDBulkSMS',
    hint: 'Most common BD gateway. Paste API key + sender ID.',
    defaultUrl: 'https://bulksmsbd.net/api/smsapi',
  },
  {
    id: 'elitbuzz',
    title: 'ElitBuzz',
    hint: 'Token + sender ID. POST JSON to the API URL.',
    defaultUrl: 'https://msg.elitbuzz-bd.com/smsapi',
  },
  {
    id: 'greenweb',
    title: 'GreenWeb',
    hint: 'Needs username + password, not an API key.',
    defaultUrl: 'https://api.greenweb.com.bd/api.php',
  },
  {
    id: 'custom',
    title: 'Custom URL',
    hint: 'Any BD SMS HTTP API — paste the full send link.',
    defaultUrl: '',
  },
]

function isMaskedValue(v: string) {
  return v === '••••••••' || /^•+$/.test(v) || v.includes('••••')
}

const FACTS: Array<{ icon: string; title: string; sub: string; tag: string }> = [
  {
    icon: 'icon-phone',
    title: 'Numbers are normalised to 880…',
    sub: '01905-010205 and +880 1905-010205 both become 8801905010205 before sending.',
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
  const smsCfg = useSmsIntegration()
  const saveSms = useUpdateSmsIntegration()
  const testSms = useTestSmsIntegration()
  const { api } = useAdminConnection(25_000)

  // Empty on purpose — a pre-filled number is a real value, and one click would
  // send a paid SMS to whoever it belongs to.
  const [phone, setPhone] = useState('')
  const [draft, setDraft] = useState(TEMPLATES[0]?.body ?? '')
  const [confirmSend, setConfirmSend] = useState(false)
  const [sending, setSending] = useState(false)
  /** Which gateway accepted the last send from this screen. */
  const [lastProvider, setLastProvider] = useState<string | null>(null)

  const [gateway, setGateway] = useState<SmsGateway>('bdbulksms')
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [senderId, setSenderId] = useState('SPLARO')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [method, setMethod] = useState<'GET' | 'POST'>('GET')
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    const cfg = smsCfg.data
    if (!cfg) return
    const gw = (GATEWAYS.find((g) => g.id === cfg.fields.gateway)?.id ?? 'bdbulksms') as SmsGateway
    setGateway(gw)
    setApiUrl(cfg.fields.apiUrl || GATEWAYS.find((g) => g.id === gw)?.defaultUrl || '')
    setApiKey(cfg.fields.apiKey || '')
    setSenderId(cfg.fields.senderId || 'SPLARO')
    setUsername(cfg.fields.username || '')
    setPassword(cfg.fields.password || '')
    setMethod(cfg.fields.method === 'POST' ? 'POST' : 'GET')
    setEnabled(cfg.enabled)
  }, [smsCfg.data])

  const logs = useMemo(() => overview.data?.smsLogs ?? [], [overview.data])
  const seg = useMemo(() => segmentsOf(draft), [draft])
  const pageStatus = dcPageStatus([overview, smsCfg], api.pulse)
  const configured = Boolean(smsCfg.data?.configured)
  const source = smsCfg.data?.source ?? 'none'

  const sent = logs.filter((l) => ['SENT', 'DELIVERED'].includes(l.status.toUpperCase()))
  const failed = logs.filter((l) =>
    ['FAILED', 'REJECTED', 'BOUNCED'].includes(l.status.toUpperCase()),
  )
  const deliveryRate = logs.length > 0 ? (sent.length / logs.length) * 100 : 0
  const digits = localBdNumber(phone)
  const phoneValid = digits.length === 11 && digits.startsWith('01')
  const operator = operatorOf(phone)
  /** An unfilled payment-number token would tell the customer to pay nobody. */
  const draftHasToken = draft.includes(PAYMENT_NUMBER_TOKEN)
  const canSend = phoneValid && seg.segments > 0 && !draftHasToken && configured && enabled

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

  const pickGateway = (next: SmsGateway) => {
    const prevDefault = GATEWAYS.find((g) => g.id === gateway)?.defaultUrl ?? ''
    setGateway(next)
    if (!apiUrl.trim() || apiUrl.trim() === prevDefault) {
      setApiUrl(GATEWAYS.find((g) => g.id === next)?.defaultUrl ?? '')
    }
    if (next === 'elitbuzz') setMethod('POST')
    else if (next !== 'custom') setMethod('GET')
  }

  const saveGateway = async () => {
    try {
      const res = await saveSms.mutateAsync({
        gateway,
        apiUrl,
        apiKey,
        senderId,
        username,
        password,
        method,
        enabled,
      })
      if ((res.saved?.length ?? 0) > 0 || (res.cleared?.length ?? 0) > 0) {
        toastApiSaved(
          res.configured
            ? `SMS gateway saved · ${gateway}`
            : 'SMS settings saved — still missing API key or URL',
        )
        return
      }
      toastWarn(res.skipped?.length ? 'Nothing new to save (masked keys unchanged).' : 'Nothing was saved.')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'SMS credentials were not saved.')
    }
  }

  const testGateway = async () => {
    try {
      const res = await testSms.mutateAsync()
      toastIntegrationTestResult(res, 'SMS gateway test')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'SMS gateway test failed.')
    }
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
        syncing={overview.isFetching || smsCfg.isFetching}
        onSync={() => {
          void overview.refetch()
          void smsCfg.refetch()
        }}
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
          <span style={{ flex: 1, minWidth: 140, font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
            Gateway credentials
          </span>
          <span style={{ font: `500 11.5px/1 ${FONT}`, color: configured ? 'var(--ok)' : 'var(--warn)' }}>
            {configured
              ? enabled
                ? `Live · ${gateway} · ${source === 'database' ? 'saved here' : 'from .env'}`
                : 'Keys saved · SMS is off'
              : 'No API key / link saved yet'}
          </span>
        </div>
        <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
              SMS sending on
            </span>
            <span style={{ font: `400 12px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>
              off = nothing sends, including order SMS
            </span>
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GATEWAYS.map((g) => {
              const on = gateway === g.id
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => pickGateway(g.id)}
                  style={{
                    height: 34,
                    padding: '0 12px',
                    borderRadius: 9,
                    border: `1px solid ${on ? 'var(--violet)' : 'var(--line)'}`,
                    background: on ? 'var(--violet-soft)' : 'var(--surface-2)',
                    color: on ? 'var(--violet)' : 'var(--ink-2)',
                    cursor: 'pointer',
                    font: `600 12px/1 ${FONT}`,
                  }}
                >
                  {g.title}
                </button>
              )
            })}
          </div>
          <p style={{ margin: 0, font: `400 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
            {GATEWAYS.find((g) => g.id === gateway)?.hint}
          </p>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={capsLabel}>API URL / link</span>
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://bulksmsbd.net/api/smsapi"
              style={{
                height: 40,
                padding: '0 12px',
                borderRadius: 9,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                outline: 'none',
                color: 'var(--ink)',
                font: `400 13px/1 ${MONO}`,
              }}
            />
          </label>

          {gateway === 'greenweb' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={capsLabel}>Username</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  style={{
                    height: 40,
                    padding: '0 12px',
                    borderRadius: 9,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    outline: 'none',
                    color: 'var(--ink)',
                    font: `400 13px/1 ${MONO}`,
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={capsLabel}>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isMaskedValue(password) ? undefined : '••••••••'}
                  autoComplete="new-password"
                  style={{
                    height: 40,
                    padding: '0 12px',
                    borderRadius: 9,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    outline: 'none',
                    color: 'var(--ink)',
                    font: `400 13px/1 ${MONO}`,
                  }}
                />
              </label>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={capsLabel}>API key / token</span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste key from the SMS panel"
                  autoComplete="new-password"
                  style={{
                    height: 40,
                    padding: '0 12px',
                    borderRadius: 9,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    outline: 'none',
                    color: 'var(--ink)',
                    font: `400 13px/1 ${MONO}`,
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={capsLabel}>Sender ID</span>
                <input
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  placeholder="SPLARO"
                  style={{
                    height: 40,
                    padding: '0 12px',
                    borderRadius: 9,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    outline: 'none',
                    color: 'var(--ink)',
                    font: `400 13px/1 ${MONO}`,
                  }}
                />
              </label>
            </div>
          )}

          {gateway === 'custom' ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={capsLabel}>HTTP method</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value === 'POST' ? 'POST' : 'GET')}
                style={{
                  height: 40,
                  padding: '0 12px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink)',
                  font: `500 13px/1 ${FONT}`,
                }}
              >
                <option value="GET">GET (query string — BDBulkSMS style)</option>
                <option value="POST">POST JSON</option>
              </select>
            </label>
          ) : null}

          {smsCfg.data?.lastTestMessage ? (
            <p style={{ margin: 0, font: `400 12px/1.45 ${FONT}`, color: smsCfg.data.lastTestStatus === 'success' ? 'var(--ok)' : 'var(--ink-3)' }}>
              Last test: {smsCfg.data.lastTestMessage}
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={saveSms.isPending}
              onClick={() => void saveGateway()}
              style={{
                height: 34,
                padding: '0 14px',
                borderRadius: 9,
                border: '1px solid var(--violet-solid)',
                background: 'var(--violet-solid)',
                color: 'var(--on-violet)',
                cursor: saveSms.isPending ? 'not-allowed' : 'pointer',
                opacity: saveSms.isPending ? 0.6 : 1,
                font: `600 12.5px/1 ${FONT}`,
              }}
            >
              {saveSms.isPending ? 'Saving…' : 'Save credentials'}
            </button>
            <button
              type="button"
              disabled={testSms.isPending || !configured}
              onClick={() => void testGateway()}
              style={{
                height: 34,
                padding: '0 14px',
                borderRadius: 9,
                border: '1px solid var(--line-2)',
                background: 'var(--surface)',
                color: 'var(--ink-2)',
                cursor: testSms.isPending || !configured ? 'not-allowed' : 'pointer',
                opacity: testSms.isPending || !configured ? 0.55 : 1,
                font: `600 12.5px/1 ${FONT}`,
              }}
            >
              {testSms.isPending ? 'Testing…' : 'Test connection'}
            </button>
          </div>
        </div>
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
            <Kpi label="Messages logged" value={formatCount(logs.length)} sub="in the window the API returns" />
            <Kpi
              label="Delivered"
              value={`${deliveryRate.toFixed(0)}%`}
              sub={`${sent.length} of ${logs.length}`}
              color={logs.length > 0 && deliveryRate < 90 ? 'var(--warn)' : 'var(--ok)'}
            />
            <Kpi
              label="Failed"
              value={formatCount(failed.length)}
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
                      placeholder="01905-010205"
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

                  {draftHasToken ? (
                    <p
                      style={{
                        margin: 0,
                        padding: '9px 12px',
                        borderRadius: 9,
                        border: '1px solid var(--warn-bd)',
                        background: 'var(--warn-soft)',
                        color: 'var(--warn)',
                        font: `600 12px/1.5 ${FONT}`,
                      }}
                    >
                      This template still says {PAYMENT_NUMBER_TOKEN}. Put your own bKash number in
                      before sending — otherwise the customer pays a number that is not yours.
                    </p>
                  ) : null}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={sending || !canSend}
                      onClick={() => setConfirmSend(true)}
                      title={
                        !configured
                          ? 'Save API key and URL first'
                          : !enabled
                            ? 'Turn SMS sending on first'
                            : draftHasToken
                              ? `Replace ${PAYMENT_NUMBER_TOKEN} with your own bKash number first`
                              : undefined
                      }
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
                          sending || !canSend ? 'not-allowed' : 'pointer',
                        opacity: sending || !canSend ? 0.55 : 1,
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
                    Active gateway
                  </span>
                  <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    {configured ? (enabled ? 'will send' : 'keys saved · off') : 'not configured'}
                  </span>
                </div>
                {GATEWAYS.map((p) => {
                  const active = gateway === p.id
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
                          border: `1px solid ${active ? 'var(--ok-bd)' : 'var(--line)'}`,
                          background: active ? 'var(--ok-soft)' : 'var(--surface-2)',
                          color: active ? 'var(--ok)' : 'var(--ink-3)',
                          font: `600 11px/1 ${MONO}`,
                        }}
                      >
                        {active ? '●' : '○'}
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
                          {p.defaultUrl || 'paste any HTTPS send URL'}
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
                            font: `700 9px/1.4 ${FONT}`,
                            letterSpacing: '.08em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          LAST SEND
                        </span>
                      ) : active ? (
                        <span
                          style={{
                            flex: 'none',
                            alignSelf: 'flex-start',
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--violet-bd)',
                            background: 'var(--violet-soft)',
                            color: 'var(--violet)',
                            font: `700 9px/1.4 ${FONT}`,
                            letterSpacing: '.08em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          SELECTED
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
                  Keys are encrypted on the server. Save above, then send a test SMS — green only
                  when the provider actually accepts it.
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
                        font: `700 9px/1.4 ${FONT}`,
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
                          <span style={{ display: 'block' }}>{l.body ?? '—'}</span>
                          {l.subject || l.errorMsg ? (
                            <span style={{ font: `500 11px/1.4 ${MONO}`, color: 'var(--ink-3)' }}>
                              {[l.subject, l.errorMsg].filter(Boolean).join(' · ')}
                            </span>
                          ) : null}
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

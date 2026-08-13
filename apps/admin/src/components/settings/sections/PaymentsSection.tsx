'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, CreditCard, Loader2 } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastApiSaved, toastFail, toastOk, toastIntegrationTestResult } from '@/lib/admin/feedback'
import {
  usePaymentIntegrations,
  useTestPaymentIntegration,
  useUpdatePaymentIntegration,
} from '@/lib/api/integration-hooks'
import { SectionPageHeader, Toggle, SaveBar, type SectionProps } from './shared'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 12,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const caps = {
  font: `700 10.5px/1 ${FONT}`,
  letterSpacing: '0.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

function isMaskedValue(v: string) {
  return v === '••••••••' || /^•+$/.test(v)
}

function isDraftComplete(draft: Record<string, string>, fieldDefs: { key: string }[]) {
  return fieldDefs.every((f) => {
    const v = (draft[f.key] ?? '').trim()
    return v.length > 0
  })
}

function draftHasUnsavedKeys(
  draft: Record<string, string>,
  fields: Record<string, string | boolean>,
  fieldDefs: { key: string }[],
) {
  return fieldDefs.some((f) => {
    const v = (draft[f.key] ?? '').trim()
    if (!v || isMaskedValue(v)) return false
    const server = String(fields[f.key] ?? '').trim()
    if (isMaskedValue(server)) return true
    return v !== server
  })
}

/**
 * One sentence per state instead of the old "Step 1 / Step 2" scaffolding —
 * the card should say what is true, not number the instructions.
 */
function providerStatus(
  enabled: boolean,
  configured: boolean,
): { label: string; tone: DcTone } {
  if (enabled && configured) return { label: 'Live at checkout', tone: 'ok' }
  if (enabled && !configured) return { label: 'On without keys', tone: 'bad' }
  if (configured) return { label: 'Keys saved · off', tone: 'info' }
  return { label: 'Not set up', tone: 'mute' }
}

function keySourceNote(source: string, adminManaged?: boolean): string {
  if (source === 'database' || adminManaged) return 'Encrypted on the server — .env is ignored'
  if (source === 'env') return 'Loaded from .env — save once to manage them here'
  return 'No keys stored yet'
}

function DcChip({ label, tone }: { label: string; tone: DcTone }) {
  const t = toneStyle(tone)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 9px',
        borderRadius: 99,
        border: `1px solid ${t.bd}`,
        background: t.bg,
        color: t.fg,
        font: `700 10.5px/1 ${FONT}`,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function ConfigField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const secret = /secret|password|private/i.test(label)
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={caps}>{label}</span>
      <input
        className="settings-input w-full"
        style={{ fontFamily: MONO }}
        type={secret ? 'password' : 'text'}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </label>
  )
}

function PaymentProviderCard({
  title,
  desc,
  enabled,
  onToggle,
  fields,
  fieldDefs,
  source,
  adminManaged,
  configured,
  saving,
  testing,
  onSaveCredentials,
  onTest,
}: {
  title: string
  desc: string
  enabled: boolean
  onToggle: (force?: boolean) => void
  fields: Record<string, string | boolean>
  fieldDefs: { key: string; label: string; placeholder?: string }[]
  source: string
  adminManaged?: boolean
  configured: boolean
  saving: boolean
  testing: boolean
  onSaveCredentials: (body: Record<string, string | boolean>) => Promise<{ configured: boolean } | undefined>
  onTest: () => void | Promise<void>
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [enabling, setEnabling] = useState(false)
  // Ten inputs across three gateways is a wall. A configured provider keeps its
  // keys folded away; one that still needs setting up opens on its own.
  const [open, setOpen] = useState(!configured)

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const f of fieldDefs) {
      const v = fields[f.key]
      next[f.key] = typeof v === 'boolean' ? String(v) : String(v ?? '')
    }
    setDraft(next)
  }, [fields, fieldDefs])

  const status = providerStatus(enabled, configured)

  const handleEnableToggle = async () => {
    if (enabled || configured) {
      onToggle()
      return
    }
    if (!isDraftComplete(draft, fieldDefs)) {
      setOpen(true)
      toastFail(`Fill every ${title} API field, then Save keys.`, 'pay-keys-required')
      return
    }
    setEnabling(true)
    try {
      const saved = await onSaveCredentials(draft)
      if (!saved?.configured) {
        toastFail('Keys saved but still incomplete — check every field.', 'pay-keys-incomplete')
        return
      }
      onToggle(true)
      toastOk(`${title} keys saved — now Save at the bottom.`, `pay-enable-${title}`)
    } finally {
      setEnabling(false)
    }
  }

  const handleTest = async () => {
    if (!configured && !isDraftComplete(draft, fieldDefs)) {
      setOpen(true)
      toastFail('Fill every API field before testing.', 'pay-test-empty')
      return
    }
    if (!configured || draftHasUnsavedKeys(draft, fields, fieldDefs)) {
      const saved = await onSaveCredentials(draft)
      if (!saved?.configured) return
    }
    await onTest()
  }

  return (
    <section style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, font: `700 13px/1.2 ${FONT}`, color: 'var(--ink)' }}>{title}</h3>
            <DcChip label={status.label} tone={status.tone} />
          </div>
          <p style={{ margin: '6px 0 0', font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-3)' }}>
            {desc}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 30,
            padding: '0 11px',
            borderRadius: 8,
            border: '1px solid var(--line-2)',
            background: 'var(--surface-2)',
            color: 'var(--ink-2)',
            font: `600 11.5px/1 ${FONT}`,
            cursor: 'pointer',
          }}
        >
          {configured ? 'Edit keys' : 'Set up keys'}
          <ChevronDown
            style={{
              width: 13,
              height: 13,
              transition: 'transform 160ms ease',
              transform: open ? 'rotate(180deg)' : 'none',
            }}
          />
        </button>
      </div>

      {open ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 14,
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: 'var(--surface-2)',
          }}
        >
          <p style={{ margin: 0, font: `400 11.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
            {keySourceNote(source, adminManaged)}
          </p>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))',
            }}
          >
            {fieldDefs.map((f) => (
              <ConfigField
                key={f.key}
                label={f.label}
                {...(f.placeholder ? { placeholder: f.placeholder } : {})}
                value={draft[f.key] ?? ''}
                onChange={(v) => setDraft((p) => ({ ...p, [f.key]: v }))}
              />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <AdminButton
              variant="accent"
              size="sm"
              loading={saving}
              onClick={() => void onSaveCredentials(draft)}
            >
              Save keys
            </AdminButton>
            <AdminButton variant="ghost" size="sm" loading={testing} onClick={() => void handleTest()}>
              Test API
            </AdminButton>
          </div>
        </div>
      ) : null}

      <Toggle
        label={`Show ${title} at checkout`}
        desc={
          configured
            ? `Customers can pay with ${title}.`
            : 'Save the API keys above before this can be turned on.'
        }
        checked={enabled}
        onChange={() => void handleEnableToggle()}
        disabled={enabling}
      />

      {enabled && !configured ? (
        <p
          style={{
            margin: 0,
            padding: '9px 12px',
            borderRadius: 9,
            border: '1px solid var(--bad-bd)',
            background: 'var(--bad-soft)',
            color: 'var(--bad)',
            font: `600 11.5px/1.5 ${FONT}`,
          }}
        >
          {title} is switched on but its keys are not verified — checkout will fail. Save and test
          the keys above.
        </p>
      ) : null}
    </section>
  )
}

export function PaymentsSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  const { data, isLoading, refetch } = usePaymentIntegrations()
  const updatePay = useUpdatePaymentIntegration()
  const testPay = useTestPaymentIntegration()
  const [busy, setBusy] = useState<string | null>(null)

  const toggle = (key: keyof typeof draft.payments, configured?: boolean, force?: boolean) => {
    const next = !draft.payments[key]
    if (next && !force && configured === false) {
      toastFail('Save the API keys first, then turn on checkout.', `pay-enable-${key}`)
      return
    }
    setDraft((p) => ({ ...p, payments: { ...p.payments, [key]: next } }))
  }

  const byProvider = useMemo(
    () => new Map((data?.items ?? []).map((i) => [i.provider, i])),
    [data],
  )

  const saveCredentials = async (provider: string, body: Record<string, string | boolean>) => {
    setBusy(provider)
    try {
      await updatePay.mutateAsync({ provider, body })
      const fresh = await refetch()
      const item = fresh.data?.items?.find((i) => i.provider === provider)
      if (!item?.configured) {
        toastFail('Keys saved but provider still not configured — check every field.', `pay-${provider}`)
        return undefined
      }
      toastApiSaved(`${provider} keys`)
      return item
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Save failed', `pay-${provider}`)
      return undefined
    } finally {
      setBusy(null)
    }
  }

  const testProvider = async (provider: string) => {
    setBusy(provider)
    try {
      const r = await testPay.mutateAsync(provider)
      if (!toastIntegrationTestResult(r, provider, `pay-test-${provider}`)) return
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Test failed', `pay-test-${provider}-fail`)
    } finally {
      setBusy(null)
    }
  }

  const saveAll = async () => {
    const blocked = (['bkash', 'nagad', 'sslcommerz'] as const).filter(
      (k) => draft.payments[k] && !byProvider.get(k)?.configured,
    )
    if (blocked.length) {
      toastFail(`Cannot enable ${blocked.join(', ')} without saved API keys.`, 'pay-save-blocked')
      return
    }
    save({ payments: draft.payments }, 'Payment toggles')
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--admin-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payment credentials…
      </div>
    )
  }

  const providers = [
    {
      key: 'bkash' as const,
      title: 'bKash',
      desc: 'Tokenized checkout for bKash wallets.',
      fieldDefs: [
        { key: 'appKey', label: 'App Key' },
        { key: 'appSecret', label: 'App Secret' },
        { key: 'username', label: 'Username' },
        { key: 'password', label: 'Password' },
      ],
    },
    {
      key: 'nagad' as const,
      title: 'Nagad',
      desc: 'Nagad merchant API.',
      fieldDefs: [
        { key: 'merchantId', label: 'Merchant ID' },
        { key: 'merchantNumber', label: 'Merchant Number' },
        { key: 'publicKey', label: 'Public Key' },
        { key: 'privateKey', label: 'Private Key' },
      ],
    },
    {
      key: 'sslcommerz' as const,
      title: 'SSLCommerz',
      desc: 'Cards and net banking.',
      fieldDefs: [
        { key: 'storeId', label: 'Store ID' },
        { key: 'storePassword', label: 'Store Password' },
      ],
    },
  ]

  const liveCount =
    (draft.payments.cod ? 1 : 0) +
    providers.filter((p) => draft.payments[p.key] && byProvider.get(p.key)?.configured).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionPageHeader
        icon={<CreditCard size={22} />}
        title="Payments"
        subtitle="Choose what a customer can pay with, and store each gateway's keys encrypted on the server."
        badge="Live sync"
      />

      {/* What a customer sees at checkout right now — the answer this screen exists for. */}
      <section style={{ ...card, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
          <span style={caps}>At checkout now</span>
          <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
            {liveCount === 0
              ? 'nothing is available — customers cannot pay'
              : `${liveCount} method${liveCount === 1 ? '' : 's'} available`}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <DcChip
            label={draft.payments.cod ? 'Cash on delivery · on' : 'Cash on delivery · off'}
            tone={draft.payments.cod ? 'ok' : 'mute'}
          />
          {providers.map((p) => {
            const status = providerStatus(
              Boolean(draft.payments[p.key]),
              Boolean(byProvider.get(p.key)?.configured),
            )
            return <DcChip key={p.key} label={`${p.title} · ${status.label}`} tone={status.tone} />
          })}
        </div>
      </section>

      <section style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, font: `700 13px/1.2 ${FONT}`, color: 'var(--ink)' }}>
            Cash on delivery
          </h3>
          <p style={{ margin: '6px 0 0', font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-3)' }}>
            No gateway, no API keys — the rider collects on handover.
          </p>
        </div>
        <Toggle
          label="Show cash on delivery at checkout"
          desc="Works without any credentials."
          checked={draft.payments.cod}
          onChange={() => toggle('cod')}
        />
      </section>

      {providers.map((p) => {
        const item = byProvider.get(p.key)
        return (
          <PaymentProviderCard
            key={p.key}
            title={p.title}
            desc={p.desc}
            enabled={Boolean(draft.payments[p.key])}
            onToggle={(force) => toggle(p.key, item?.configured, force)}
            fields={item?.fields ?? {}}
            source={item?.source ?? 'none'}
            {...(item?.adminManaged ? { adminManaged: true } : {})}
            configured={Boolean(item?.configured)}
            saving={busy === p.key && updatePay.isPending}
            testing={busy === p.key && testPay.isPending}
            fieldDefs={p.fieldDefs}
            onSaveCredentials={(body) => saveCredentials(p.key, body)}
            onTest={() => testProvider(p.key)}
          />
        )
      })}

      <SaveBar label="Save checkout toggles" saving={saving} disabled={!apiOnline} onClick={saveAll} />
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { toastApiSaved, toastFail, toastOk } from '@/lib/admin/feedback'
import {
  usePaymentIntegrations,
  useTestPaymentIntegration,
  useUpdatePaymentIntegration,
} from '@/lib/api/integration-hooks'
import { SectionCard, SectionPageHeader, Toggle, SaveBar, type SectionProps } from './shared'

function ConfigField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  const secret = type === 'password' || /secret|password|private/i.test(label)
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--admin-text-muted)]">
        {label}
      </span>
      <input
        className="settings-input w-full"
        type={secret ? 'password' : 'text'}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </label>
  )
}

function PaymentProviderBlock({
  title,
  desc,
  enabled,
  onToggle,
  fields,
  fieldDefs,
  source,
  configured,
  saving,
  testing,
  onSaveCredentials,
  onTest,
  onToggleAttempt,
}: {
  title: string
  desc: string
  enabled: boolean
  onToggle: () => void
  onToggleAttempt?: () => boolean
  fields: Record<string, string | boolean>
  fieldDefs: { key: string; label: string; placeholder?: string }[]
  source: string
  configured: boolean
  saving: boolean
  testing: boolean
  onSaveCredentials: (body: Record<string, string | boolean>) => void
  onTest: () => void
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const f of fieldDefs) {
      const v = fields[f.key]
      next[f.key] = typeof v === 'boolean' ? String(v) : String(v ?? '')
    }
    setDraft(next)
  }, [fields, fieldDefs])

  return (
    <SectionCard title={title} subtitle={desc} accent={enabled && configured}>
      <Toggle
        label={`Enable ${title}`}
        desc={desc}
        checked={enabled}
        onChange={() => {
          if (!enabled && onToggleAttempt && !onToggleAttempt()) return
          onToggle()
        }}
      />
      {enabled && !configured ? (
        <p className="mt-2 text-[11px] font-bold text-red-600 dark:text-red-400">
          Save API keys before checkout can use {title}. Toggle will not go live until keys are verified on server.
        </p>
      ) : null}
      {enabled ? (
        <div className="mt-4 space-y-3 border-t border-[var(--admin-glass-border-subtle)] pt-4">
          <p className="text-[11px] font-semibold text-[var(--admin-text-muted)]">
            API credentials
            {source === 'database' ? ' · encrypted on server' : source === 'env' ? ' · from .env' : ''}
            {configured ? (
              <span className="ml-1 text-emerald-600">Ready</span>
            ) : (
              <span className="ml-1 text-amber-600">Keys required</span>
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="flex flex-wrap gap-2 pt-1">
            <AdminButton variant="gold" loading={saving} onClick={() => onSaveCredentials(draft)}>
              Save keys
            </AdminButton>
            <AdminButton variant="ghost" loading={testing} onClick={onTest}>
              Test
            </AdminButton>
          </div>
        </div>
      ) : null}
    </SectionCard>
  )
}

export function PaymentsSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  const { data, isLoading } = usePaymentIntegrations()
  const updatePay = useUpdatePaymentIntegration()
  const testPay = useTestPaymentIntegration()
  const [busy, setBusy] = useState<string | null>(null)

  const toggle = (key: keyof typeof draft.payments, configured?: boolean) => {
    const next = !draft.payments[key]
    if (next && configured === false) {
      toastFail('Save and test API keys first — cannot enable without credentials.', `pay-enable-${key}`)
      return
    }
    setDraft((p) => ({ ...p, payments: { ...p.payments, [key]: next } }))
  }

  const guardEnable = (configured: boolean) => {
    if (!configured) {
      toastFail('API keys required — save credentials below first.', 'pay-keys-required')
      return false
    }
    return true
  }

  const byProvider = new Map((data?.items ?? []).map((i) => [i.provider, i]))

  const saveCredentials = async (provider: string, body: Record<string, string | boolean>) => {
    setBusy(provider)
    try {
      await updatePay.mutateAsync({ provider, body })
      toastApiSaved(`${provider} keys`)
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Save failed', `pay-${provider}`)
    } finally {
      setBusy(null)
    }
  }

  const testProvider = async (provider: string) => {
    setBusy(provider)
    try {
      const r = await testPay.mutateAsync(provider)
      toastOk(r.message, `pay-test-${provider}`)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<CreditCard size={22} />}
        title="Payments"
        subtitle="Toggle checkout methods and save gateway API keys to the server (encrypted)."
        badge="Live sync"
      />

      <SectionCard title="Cash on delivery">
        <Toggle
          label="COD"
          desc="No API keys required."
          checked={draft.payments.cod}
          onChange={() => toggle('cod')}
        />
      </SectionCard>

      <PaymentProviderBlock
        title="bKash"
        desc="bKash tokenized checkout."
        enabled={Boolean(draft.payments.bkash)}
        onToggle={() => toggle('bkash', byProvider.get('bkash')?.configured)}
        onToggleAttempt={() => guardEnable(Boolean(byProvider.get('bkash')?.configured))}
        fields={byProvider.get('bkash')?.fields ?? {}}
        source={byProvider.get('bkash')?.source ?? 'none'}
        configured={Boolean(byProvider.get('bkash')?.configured)}
        saving={busy === 'bkash' && updatePay.isPending}
        testing={busy === 'bkash' && testPay.isPending}
        fieldDefs={[
          { key: 'appKey', label: 'App Key' },
          { key: 'appSecret', label: 'App Secret' },
          { key: 'username', label: 'Username' },
          { key: 'password', label: 'Password' },
        ]}
        onSaveCredentials={(body) => void saveCredentials('bkash', body)}
        onTest={() => void testProvider('bkash')}
      />

      <PaymentProviderBlock
        title="Nagad"
        desc="Nagad merchant API."
        enabled={Boolean(draft.payments.nagad)}
        onToggle={() => toggle('nagad', byProvider.get('nagad')?.configured)}
        onToggleAttempt={() => guardEnable(Boolean(byProvider.get('nagad')?.configured))}
        fields={byProvider.get('nagad')?.fields ?? {}}
        source={byProvider.get('nagad')?.source ?? 'none'}
        configured={Boolean(byProvider.get('nagad')?.configured)}
        saving={busy === 'nagad' && updatePay.isPending}
        testing={busy === 'nagad' && testPay.isPending}
        fieldDefs={[
          { key: 'merchantId', label: 'Merchant ID' },
          { key: 'merchantNumber', label: 'Merchant Number' },
          { key: 'publicKey', label: 'Public Key' },
          { key: 'privateKey', label: 'Private Key' },
        ]}
        onSaveCredentials={(body) => void saveCredentials('nagad', body)}
        onTest={() => void testProvider('nagad')}
      />

      <PaymentProviderBlock
        title="SSLCommerz"
        desc="Cards and net banking."
        enabled={Boolean(draft.payments.sslcommerz)}
        onToggle={() => toggle('sslcommerz', byProvider.get('sslcommerz')?.configured)}
        onToggleAttempt={() => guardEnable(Boolean(byProvider.get('sslcommerz')?.configured))}
        fields={byProvider.get('sslcommerz')?.fields ?? {}}
        source={byProvider.get('sslcommerz')?.source ?? 'none'}
        configured={Boolean(byProvider.get('sslcommerz')?.configured)}
        saving={busy === 'sslcommerz' && updatePay.isPending}
        testing={busy === 'sslcommerz' && testPay.isPending}
        fieldDefs={[
          { key: 'storeId', label: 'Store ID' },
          { key: 'storePassword', label: 'Store Password' },
        ]}
        onSaveCredentials={(body) => void saveCredentials('sslcommerz', body)}
        onTest={() => void testProvider('sslcommerz')}
      />

      <SaveBar label="Save checkout toggles" saving={saving} disabled={!apiOnline} onClick={saveAll} />
    </div>
  )
}

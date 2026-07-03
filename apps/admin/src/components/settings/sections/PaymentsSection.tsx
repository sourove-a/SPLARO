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
}: {
  title: string
  desc: string
  enabled: boolean
  onToggle: (force?: boolean) => void
  fields: Record<string, string | boolean>
  fieldDefs: { key: string; label: string; placeholder?: string }[]
  source: string
  configured: boolean
  saving: boolean
  testing: boolean
  onSaveCredentials: (body: Record<string, string | boolean>) => Promise<{ configured: boolean } | undefined>
  onTest: () => void | Promise<void>
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [enabling, setEnabling] = useState(false)
  const showCredentials = true

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const f of fieldDefs) {
      const v = fields[f.key]
      next[f.key] = typeof v === 'boolean' ? String(v) : String(v ?? '')
    }
    setDraft(next)
  }, [fields, fieldDefs])

  const handleEnableToggle = async () => {
    if (enabled) {
      onToggle()
      return
    }
    if (configured) {
      onToggle()
      return
    }
    if (!isDraftComplete(draft, fieldDefs)) {
      toastFail(`Fill all ${title} API fields below, then Save keys.`, 'pay-keys-required')
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
      toastOk(`${title} keys saved — enable checkout, then Save at bottom.`, `pay-enable-${title}`)
    } finally {
      setEnabling(false)
    }
  }

  const handleTest = async () => {
    if (!configured && !isDraftComplete(draft, fieldDefs)) {
      toastFail('Fill all API fields below before testing.', 'pay-test-empty')
      return
    }
    if (!configured || draftHasUnsavedKeys(draft, fields, fieldDefs)) {
      const saved = await onSaveCredentials(draft)
      if (!saved?.configured) return
    }
    await onTest()
  }

  return (
    <SectionCard title={title} subtitle={desc} accent={enabled && configured}>
      {showCredentials ? (
        <div className="mb-4 space-y-3 rounded-xl border border-[var(--admin-glass-border-subtle)] bg-[var(--admin-accent-muted)]/40 p-4">
          <p className="text-[11px] font-semibold text-[var(--admin-text-muted)]">
            Step 1 — API credentials
            {source === 'database' ? ' · encrypted on server' : source === 'env' ? ' · from .env' : ''}
            {configured ? (
              <span className="ml-1 text-emerald-600 dark:text-emerald-400">Ready</span>
            ) : (
              <span className="ml-1 text-amber-600 dark:text-amber-400">Fill & save keys first</span>
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
            <AdminButton variant="gold" loading={saving} onClick={() => void onSaveCredentials(draft)}>
              Save keys
            </AdminButton>
            <AdminButton variant="ghost" loading={testing} onClick={() => void handleTest()}>
              Test API
            </AdminButton>
          </div>
        </div>
      ) : null}

      <Toggle
        label={`Step 2 — Enable ${title} at checkout`}
        desc={configured ? desc : 'Save keys above first, then turn on checkout.'}
        checked={enabled}
        onChange={() => void handleEnableToggle()}
        disabled={enabling}
      />
      {enabled && !configured ? (
        <p className="mt-2 text-[11px] font-bold text-red-600 dark:text-red-400">
          Checkout toggle is on but keys are not verified — save & test API keys above.
        </p>
      ) : null}
    </SectionCard>
  )
}

export function PaymentsSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  const { data, isLoading } = usePaymentIntegrations()
  const updatePay = useUpdatePaymentIntegration()
  const testPay = useTestPaymentIntegration()
  const [busy, setBusy] = useState<string | null>(null)

  const toggle = (key: keyof typeof draft.payments, configured?: boolean, force?: boolean) => {
    const next = !draft.payments[key]
    if (next && !force && configured === false) {
      toastFail('Save API keys in Step 1 first, then enable checkout.', `pay-enable-${key}`)
      return
    }
    setDraft((p) => ({ ...p, payments: { ...p.payments, [key]: next } }))
  }

  const byProvider = new Map((data?.items ?? []).map((i) => [i.provider, i]))

  const saveCredentials = async (provider: string, body: Record<string, string | boolean>) => {
    setBusy(provider)
    try {
      const saved = await updatePay.mutateAsync({ provider, body })
      toastApiSaved(`${provider} keys`)
      return saved
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
        onToggle={(force) => toggle('bkash', byProvider.get('bkash')?.configured, force)}
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
        onSaveCredentials={(body) => saveCredentials('bkash', body)}
        onTest={() => testProvider('bkash')}
      />

      <PaymentProviderBlock
        title="Nagad"
        desc="Nagad merchant API."
        enabled={Boolean(draft.payments.nagad)}
        onToggle={(force) => toggle('nagad', byProvider.get('nagad')?.configured, force)}
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
        onSaveCredentials={(body) => saveCredentials('nagad', body)}
        onTest={() => testProvider('nagad')}
      />

      <PaymentProviderBlock
        title="SSLCommerz"
        desc="Cards and net banking."
        enabled={Boolean(draft.payments.sslcommerz)}
        onToggle={(force) => toggle('sslcommerz', byProvider.get('sslcommerz')?.configured, force)}
        fields={byProvider.get('sslcommerz')?.fields ?? {}}
        source={byProvider.get('sslcommerz')?.source ?? 'none'}
        configured={Boolean(byProvider.get('sslcommerz')?.configured)}
        saving={busy === 'sslcommerz' && updatePay.isPending}
        testing={busy === 'sslcommerz' && testPay.isPending}
        fieldDefs={[
          { key: 'storeId', label: 'Store ID' },
          { key: 'storePassword', label: 'Store Password' },
        ]}
        onSaveCredentials={(body) => saveCredentials('sslcommerz', body)}
        onTest={() => testProvider('sslcommerz')}
      />

      <SaveBar label="Save checkout toggles" saving={saving} disabled={!apiOnline} onClick={saveAll} />
    </div>
  )
}

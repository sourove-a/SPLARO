'use client'

import { useEffect, useState } from 'react'
import { Cloud, Loader2 } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { toastApiSaved, toastFail, toastOk } from '@/lib/admin/feedback'
import {
  useInfrastructureConfig,
  useTestInfrastructureIntegration,
  useUpdateInfrastructureConfig,
} from '@/lib/api/integration-hooks'
import { SectionCard, SectionPageHeader, type SectionProps } from './shared'

function Field({
  label,
  value,
  onChange,
  secret,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  secret?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--admin-text-muted)]">
        {label}
      </span>
      <input
        className="settings-input w-full"
        type={secret ? 'password' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </label>
  )
}

function ConfigStatus({
  configured,
  source,
  adminManaged,
  lastTestStatus,
}: {
  configured: boolean | undefined
  source: string | undefined
  adminManaged?: boolean | undefined
  lastTestStatus?: string | null | undefined
}) {
  const activeFromAdmin = adminManaged || source === 'database'
  return (
    <p className="mb-3 text-[11px] font-semibold leading-relaxed text-[var(--admin-text-muted)]">
      {configured ? 'Configured' : 'Not configured'}
      {activeFromAdmin ? (
        <span className="text-emerald-700 dark:text-emerald-400">
          {' '}
          · Live from admin (encrypted DB) — .env ignored for this provider
        </span>
      ) : source === 'env' ? (
        <span className="text-amber-700 dark:text-amber-400">
          {' '}
          · Using .env fallback — save here once to manage from admin only
        </span>
      ) : null}
      {lastTestStatus === 'success' ? ' · last test OK' : lastTestStatus === 'failed' ? ' · last test failed' : ''}
    </p>
  )
}

export function InfrastructureSection({ apiOnline }: Pick<SectionProps, 'apiOnline'>) {
  const r2 = useInfrastructureConfig('cloudflare_r2')
  const steadfast = useInfrastructureConfig('steadfast')
  const pathao = useInfrastructureConfig('pathao')
  const redx = useInfrastructureConfig('redx')
  const update = useUpdateInfrastructureConfig()
  const testInfra = useTestInfrastructureIntegration()
  const [r2Draft, setR2Draft] = useState<Record<string, string>>({})
  const [sfDraft, setSfDraft] = useState<Record<string, string>>({})
  const [pathaoDraft, setPathaoDraft] = useState<Record<string, string>>({})
  const [redxDraft, setRedxDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (r2.data?.fields) setR2Draft({ ...r2.data.fields })
  }, [r2.data])

  useEffect(() => {
    if (steadfast.data?.fields) setSfDraft({ ...steadfast.data.fields })
  }, [steadfast.data])

  useEffect(() => {
    if (pathao.data?.fields) setPathaoDraft({ ...pathao.data.fields })
  }, [pathao.data])

  useEffect(() => {
    if (redx.data?.fields) setRedxDraft({ ...redx.data.fields })
  }, [redx.data])

  const save = async (provider: 'cloudflare_r2' | 'steadfast' | 'pathao' | 'redx', body: Record<string, string>) => {
    setBusy(`save-${provider}`)
    try {
      await update.mutateAsync({ provider, body })
      const labels: Record<string, string> = {
        cloudflare_r2: 'R2 storage',
        steadfast: 'Steadfast courier',
        pathao: 'Pathao courier',
        redx: 'RedX courier',
      }
      toastApiSaved(labels[provider] ?? provider)
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Save failed', `infra-${provider}`)
    } finally {
      setBusy(null)
    }
  }

  const runTest = async (provider: 'steadfast' | 'pathao' | 'redx') => {
    setBusy(`test-${provider}`)
    try {
      const res = await testInfra.mutateAsync(provider)
      toastOk(res.message, `infra-test-${provider}`)
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Connection test failed', `infra-test-${provider}`)
    } finally {
      setBusy(null)
    }
  }

  if (r2.isLoading || steadfast.isLoading || pathao.isLoading || redx.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--admin-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading infrastructure credentials…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<Cloud size={22} />}
        title="Infrastructure"
        subtitle="Storage and courier API keys — save here once; backend reads encrypted DB (not mixed with .env)."
        badge="Integrations"
      />

      <SectionCard title="Health probes" subtitle="Required for API Health dashboard and invoice checks in admin.">
        <p className="text-[12px] font-semibold leading-relaxed text-amber-800 dark:text-amber-300">
          Set <code className="rounded bg-black/5 px-1 py-0.5 text-[11px]">INTERNAL_HEALTH_SECRET</code> in{' '}
          <code className="rounded bg-black/5 px-1 py-0.5 text-[11px]">apps/admin/.env.local</code> and root{' '}
          <code className="rounded bg-black/5 px-1 py-0.5 text-[11px]">.env</code> (same value). Without it, database
          and invoice probes on <strong>API Health</strong> may show degraded.
        </p>
      </SectionCard>

      <SectionCard
        title="Cloudflare R2"
        subtitle="Product images and media CDN."
        accent={Boolean(r2.data?.configured)}
      >
        <ConfigStatus configured={r2.data?.configured} source={r2.data?.source} adminManaged={r2.data?.adminManaged} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Access Key" value={r2Draft.accessKey ?? ''} onChange={(v) => setR2Draft((p) => ({ ...p, accessKey: v }))} secret />
          <Field label="Secret Key" value={r2Draft.secretKey ?? ''} onChange={(v) => setR2Draft((p) => ({ ...p, secretKey: v }))} secret />
          <Field label="Bucket" value={r2Draft.bucket ?? ''} onChange={(v) => setR2Draft((p) => ({ ...p, bucket: v }))} />
          <Field label="Endpoint" value={r2Draft.endpoint ?? ''} onChange={(v) => setR2Draft((p) => ({ ...p, endpoint: v }))} />
          <Field label="Public URL" value={r2Draft.publicUrl ?? ''} onChange={(v) => setR2Draft((p) => ({ ...p, publicUrl: v }))} />
        </div>
        <AdminButton
          className="mt-4"
          variant="gold"
          disabled={!apiOnline}
          loading={busy === 'save-cloudflare_r2'}
          onClick={() => void save('cloudflare_r2', r2Draft)}
        >
          Save R2
        </AdminButton>
      </SectionCard>

      <SectionCard title="Steadfast Courier" subtitle="Keys from steadfast.com.bd → Merchant → API. Save here (encrypted) or set STEADFAST_* in .env." accent={Boolean(steadfast.data?.configured)}>
        <ConfigStatus
          configured={steadfast.data?.configured}
          source={steadfast.data?.source}
          adminManaged={steadfast.data?.adminManaged}
          lastTestStatus={steadfast.data?.lastTestStatus}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="API Key" value={sfDraft.apiKey ?? ''} onChange={(v) => setSfDraft((p) => ({ ...p, apiKey: v }))} secret />
          <Field label="Secret Key" value={sfDraft.secretKey ?? ''} onChange={(v) => setSfDraft((p) => ({ ...p, secretKey: v }))} secret />
          <Field label="Base URL" value={sfDraft.baseUrl ?? ''} onChange={(v) => setSfDraft((p) => ({ ...p, baseUrl: v }))} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <AdminButton
            variant="gold"
            disabled={!apiOnline}
            loading={busy === 'save-steadfast'}
            onClick={() => void save('steadfast', sfDraft)}
          >
            Save Steadfast
          </AdminButton>
          <AdminButton
            variant="ghost"
            disabled={!apiOnline || !steadfast.data?.configured}
            loading={busy === 'test-steadfast'}
            onClick={() => void runTest('steadfast')}
          >
            Test connection
          </AdminButton>
        </div>
      </SectionCard>

      <SectionCard title="Pathao Courier" subtitle="Alternative courier — token + store booking." accent={Boolean(pathao.data?.configured)}>
        <ConfigStatus
          configured={pathao.data?.configured}
          source={pathao.data?.source}
          adminManaged={pathao.data?.adminManaged}
          lastTestStatus={pathao.data?.lastTestStatus}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Client ID" value={pathaoDraft.clientId ?? ''} onChange={(v) => setPathaoDraft((p) => ({ ...p, clientId: v }))} />
          <Field label="Client Secret" value={pathaoDraft.clientSecret ?? ''} onChange={(v) => setPathaoDraft((p) => ({ ...p, clientSecret: v }))} secret />
          <Field label="Username" value={pathaoDraft.username ?? ''} onChange={(v) => setPathaoDraft((p) => ({ ...p, username: v }))} />
          <Field label="Password" value={pathaoDraft.password ?? ''} onChange={(v) => setPathaoDraft((p) => ({ ...p, password: v }))} secret />
          <Field label="Store ID" value={pathaoDraft.storeId ?? ''} onChange={(v) => setPathaoDraft((p) => ({ ...p, storeId: v }))} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <AdminButton
            variant="gold"
            disabled={!apiOnline}
            loading={busy === 'save-pathao'}
            onClick={() => void save('pathao', pathaoDraft)}
          >
            Save Pathao
          </AdminButton>
          <AdminButton
            variant="ghost"
            disabled={!apiOnline || !pathao.data?.configured}
            loading={busy === 'test-pathao'}
            onClick={() => void runTest('pathao')}
          >
            Test connection
          </AdminButton>
        </div>
      </SectionCard>

      <SectionCard title="RedX Courier" subtitle="Alternative courier — API key booking." accent={Boolean(redx.data?.configured)}>
        <ConfigStatus
          configured={redx.data?.configured}
          source={redx.data?.source}
          adminManaged={redx.data?.adminManaged}
          lastTestStatus={redx.data?.lastTestStatus}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="API Key" value={redxDraft.apiKey ?? ''} onChange={(v) => setRedxDraft((p) => ({ ...p, apiKey: v }))} secret />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <AdminButton
            variant="gold"
            disabled={!apiOnline}
            loading={busy === 'save-redx'}
            onClick={() => void save('redx', redxDraft)}
          >
            Save RedX
          </AdminButton>
          <AdminButton
            variant="ghost"
            disabled={!apiOnline || !redx.data?.configured}
            loading={busy === 'test-redx'}
            onClick={() => void runTest('redx')}
          >
            Test connection
          </AdminButton>
        </div>
      </SectionCard>
    </div>
  )
}

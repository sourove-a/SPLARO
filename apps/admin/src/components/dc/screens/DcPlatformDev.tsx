'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcField, DcModal } from '@/components/dc/DcModal'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { FONT, MONO } from '@/components/dc/tokens'
import { toastApiSaved, toastFail, toastOk } from '@/lib/admin/feedback'
import { useCreateApiKey, useDeveloper, useObservability, useRevokeApiKey } from '@/lib/api/hooks'

export type PlatformDevTab = 'developer' | 'observability'

const SCOPE_OPTIONS = [
  { id: 'orders:read', label: 'Orders (Read)', desc: 'View orders and fulfillments' },
  { id: 'orders:write', label: 'Orders (Write)', desc: 'Create and update orders' },
  { id: 'products:read', label: 'Products (Read)', desc: 'Read product catalog and stock' },
  { id: 'products:write', label: 'Products (Write)', desc: 'Update products and inventory' },
  { id: 'customers:read', label: 'Customers (Read)', desc: 'Read customer profiles' },
  { id: 'full_access', label: 'Full Access (Admin)', desc: 'Full administrative API access' },
]

export function DcPlatformDev({ tab = 'developer' }: { tab?: PlatformDevTab }) {
  const router = useRouter()
  return (
    <DcScreenProvider screen="platform-dev" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPlatformDevBody initial={tab} />
    </DcScreenProvider>
  )
}

function DcPlatformDevBody({ initial }: { initial: PlatformDevTab }) {
  const router = useRouter()
  const [tab, setTab] = useState<PlatformDevTab>(initial)

  const developer = useDeveloper()
  const observability = useObservability()
  const createKeyMutation = useCreateApiKey()
  const revokeKeyMutation = useRevokeApiKey()

  const [createOpen, setCreateOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['orders:read', 'products:read'])
  const [newRawKey, setNewRawKey] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const active = tab === 'developer' ? developer : observability

  const handleToggleScope = (scopeId: string) => {
    if (scopeId === 'full_access') {
      setSelectedScopes((prev) => (prev.includes('full_access') ? [] : ['full_access']))
      return
    }
    setSelectedScopes((prev) => {
      const filtered = prev.filter((s) => s !== 'full_access')
      return filtered.includes(scopeId)
        ? filtered.filter((s) => s !== scopeId)
        : [...filtered, scopeId]
    })
  }

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      toastFail('API key name is required')
      return
    }

    try {
      const res = await createKeyMutation.mutateAsync({
        name: keyName.trim(),
        scopes: selectedScopes.length > 0 ? selectedScopes : ['read'],
      })
      toastApiSaved('API key generated')
      setNewRawKey(res.rawKey)
      setKeyName('')
      void developer.refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Failed to create API key')
    }
  }

  const handleRevokeKey = async () => {
    if (!revokingId) return
    try {
      await revokeKeyMutation.mutateAsync(revokingId)
      toastOk('API key revoked and deleted')
      setRevokingId(null)
      void developer.refetch()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Failed to revoke API key')
    }
  }

  const rows = useMemo(() => {
    if (tab === 'developer') {
      return (developer.data?.apiKeys ?? []).map((k) => [
        k.name,
        k.prefix,
        <span
          key={k.id}
          style={{
            display: 'inline-flex',
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: k.status === 'active' ? 'var(--ok-soft)' : 'var(--bad-soft)',
            color: k.status === 'active' ? 'var(--ok)' : 'var(--bad)',
          }}
        >
          {k.status}
        </span>,
        k.scopes,
        k.lastUsed,
        <button
          key={`revoke-${k.id}`}
          type="button"
          onClick={() => setRevokingId(k.id)}
          style={{
            border: '1px solid var(--line)',
            borderRadius: 6,
            padding: '4px 8px',
            background: 'var(--surface)',
            color: 'var(--bad)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Revoke
        </button>,
      ])
    }
    return (observability.data?.services ?? []).map((s) => [
      s.name,
      <span
        key={s.id}
        style={{
          display: 'inline-flex',
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          background: s.status === 'healthy' ? 'var(--ok-soft)' : 'var(--warn-soft)',
          color: s.status === 'healthy' ? 'var(--ok)' : 'var(--warn)',
        }}
      >
        {s.status}
      </span>,
      s.latency,
      s.updated,
    ])
  }, [tab, developer.data, observability.data])

  return (
    <>
      <DcHubFrame
        crumbGroup="Developer"
        title={tab === 'developer' ? 'API Developer Center' : 'Observability'}
        queries={[active]}
        empty={rows.length === 0}
        emptyState={{
          icon: 'icon-terminal',
          title: tab === 'developer' ? 'No API keys yet' : 'No platform activity recorded',
          body:
            tab === 'developer'
              ? 'Generate API keys to authenticate external apps, integrations, and mobile apps with the SPLARO REST API.'
              : 'Deploys, migrations and background job runs are logged here. Nothing has run since the last reset.',
        }}
        actions={
          tab === 'developer'
            ? [
                {
                  label: 'Generate API key',
                  icon: 'icon-plus',
                  variant: 'primary',
                  onClick: () => {
                    setNewRawKey(null)
                    setCreateOpen(true)
                  },
                },
              ]
            : [
                {
                  label: 'Ping services',
                  icon: 'icon-refresh-cw',
                  variant: 'ghost',
                  onClick: () => {
                    void observability.refetch()
                    toastOk('Health check probes refreshed')
                  },
                },
              ]
        }
      >
        <HubTabs
          tabs={[
            { id: 'developer', label: 'API center' },
            { id: 'observability', label: 'Observability' },
          ]}
          active={tab}
          onChange={(id) => {
            const next = id as PlatformDevTab
            setTab(next)
            router.replace(
              next === 'developer' ? '/dashboard/developer/api-center' : '/dashboard/observability/center',
            )
          }}
        />
        <HubKpis
          items={
            tab === 'developer'
              ? [
                  { label: 'API keys', value: developer.data?.kpis.apiKeys ?? 0 },
                  { label: 'Webhooks', value: developer.data?.kpis.webhooks ?? 0 },
                  { label: 'Sandbox', value: developer.data?.kpis.sandbox ? 'On' : 'Off' },
                ]
              : [
                  { label: 'Uptime', value: observability.data?.kpis.uptime ?? '—' },
                  { label: 'API p95', value: observability.data?.kpis.apiP95 ?? '—' },
                  { label: 'Errors / hr', value: observability.data?.kpis.errorsPerHour ?? '—' },
                ]
          }
        />
        <HubTable
          columns={
            tab === 'developer'
              ? ['Name', 'Prefix', 'Status', 'Scopes', 'Last used', '']
              : ['Service', 'Status', 'Latency', 'Updated']
          }
          rows={rows}
        />
      </DcHubFrame>

      {/* GENERATE API KEY MODAL */}
      <DcModal
        open={createOpen}
        title={newRawKey ? 'API Key Generated' : 'Generate API Key'}
        subtitle={
          newRawKey
            ? 'Copy your secret key now. It will not be shown again.'
            : 'Create a new REST API key for custom applications or integrations.'
        }
        confirmLabel={newRawKey ? 'Done' : 'Generate Key'}
        busy={createKeyMutation.isPending}
        onClose={() => {
          setCreateOpen(false)
          setNewRawKey(null)
        }}
        onConfirm={() => {
          if (newRawKey) {
            setCreateOpen(false)
            setNewRawKey(null)
          } else {
            void handleCreateKey()
          }
        }}
        width="min(520px, 100%)"
      >
        {newRawKey ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '6px 0' }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                background: 'var(--violet-soft)',
                border: '1px solid var(--violet-bd)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <code style={{ font: `600 13px/1.3 ${MONO}`, color: 'var(--ink)', wordBreak: 'break-all' }}>
                {newRawKey}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(newRawKey)
                  toastOk('API key copied to clipboard')
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'var(--primary)',
                  color: 'var(--on-violet)',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Copy
              </button>
            </div>
            <p style={{ font: `400 12px/1.4 ${FONT}`, color: 'var(--ink-3)', margin: 0 }}>
              Make sure to save this key in your environment variables. It has been hashed and cannot be retrieved later.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
            <DcField
              label="Key Name"
              value={keyName}
              onChange={setKeyName}
              placeholder="e.g. Mobile App, ERP Integration"
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                style={{
                  font: `600 11px/1.4 ${FONT}`,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                Permission Scopes
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {SCOPE_OPTIONS.map((opt) => {
                  const isChecked = selectedScopes.includes(opt.id)
                  return (
                    <label
                      key={opt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--line)',
                        background: isChecked ? 'var(--violet-soft)' : 'var(--surface)',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ font: `600 12px/1.2 ${FONT}`, color: 'var(--ink)' }}>{opt.label}</div>
                        <div style={{ font: `400 11px/1.2 ${FONT}`, color: 'var(--ink-3)' }}>{opt.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleScope(opt.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </DcModal>

      {/* REVOKE API KEY MODAL */}
      <DcModal
        open={Boolean(revokingId)}
        title="Revoke API Key"
        subtitle="This will immediately invalidate the API key. Connected applications using this key will lose access."
        confirmLabel="Revoke Key"
        danger
        busy={revokeKeyMutation.isPending}
        onClose={() => setRevokingId(null)}
        onConfirm={() => void handleRevokeKey()}
      >
        <p style={{ font: `400 13px/1.4 ${FONT}`, color: 'var(--ink-3)', margin: 0 }}>
          The key will be deactivated. The secret cannot be shown again. MCP link tokens are managed separately
          and will not appear here.
        </p>
      </DcModal>
    </>
  )
}

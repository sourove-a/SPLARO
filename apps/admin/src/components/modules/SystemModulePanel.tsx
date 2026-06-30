'use client'

import Link from 'next/link'
import { toastNotImplemented } from '@/lib/admin/feedback'
import { Database, FileText, HeartPulse, Download, RefreshCw } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { useObservability, useSystemLogs } from '@/lib/api/hooks'
import { runAllHealthChecks } from '@/lib/api/health'
import React, { useCallback, useEffect, useState } from 'react'

function ErrorBanner({ msg }: { msg?: string }) {
  return <div className="settings-card admin-panel-glass-subtle" style={{ padding: '12px 16px', borderLeft: '3px solid #EF4444', color: '#B91C1C', fontSize: 13, fontWeight: 700 }}>{msg ?? 'API offline — start pnpm dev:api'}</div>
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="settings-card admin-panel-glass-subtle admin-module-kpi">
      <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{value}</p>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, marginBottom: 0 }}>{label}</p>
    </div>
  )
}

function StatusPill({ value }: { value: string }) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    healthy:  { bg: 'rgba(22,163,74,0.10)',   text: '#15803D', border: 'rgba(22,163,74,0.30)' },
    degraded: { bg: 'rgba(245,158,11,0.10)',  text: '#B45309', border: 'rgba(245,158,11,0.30)' },
    offline:  { bg: 'rgba(239,68,68,0.10)',   text: '#B91C1C', border: 'rgba(239,68,68,0.30)' },
    info:     { bg: 'rgba(59,130,246,0.10)',  text: '#1D4ED8', border: 'rgba(59,130,246,0.30)' },
    warn:     { bg: 'rgba(245,158,11,0.10)',  text: '#B45309', border: 'rgba(245,158,11,0.30)' },
    error:    { bg: 'rgba(239,68,68,0.10)',   text: '#B91C1C', border: 'rgba(239,68,68,0.30)' },
  }
  const fallback = { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' }
  const s = map[value.toLowerCase()] ?? fallback
  return <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>{value}</span>
}

// ─── Backups ──────────────────────────────────────────────────────────────────
function BackupsView() {
  const { data, isError } = useObservability()
  if (isError) return <ErrorBanner />

  const backups = data?.backups ?? []
  const latest = backups[0]

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KpiCard label="Backups" value={backups.length} />
        <KpiCard label="Latest" value={latest?.updated ?? '—'} />
        <KpiCard label="Status" value={latest?.status ?? 'healthy'} />
        <KpiCard label="Size" value={latest?.metric ?? '—'} />
      </div>
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div className="admin-module-icon-ring">
            <Database style={{ width: 15, height: 15 }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>Backup schedule</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {backups.map((b) => (
            <div key={b.id} className="settings-card admin-panel-glass-subtle" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-secondary)' }}>{b.name}</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--admin-text-primary)' }}>{b.metric}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <AdminButton variant="gold" onClick={() => toastNotImplemented('Database backup')}>
            <Download style={{ width: 16, height: 16 }} /> Run backup now
          </AdminButton>
          <Link href="/dashboard/observability/disaster-recovery" className="admin-catalog-action inline-flex items-center">
            Disaster recovery
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
function LogsView() {
  const { data, isError, isLoading, refetch } = useSystemLogs()
  if (isError) return <ErrorBanner />

  const logs = data?.logs ?? []

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <AdminButton onClick={() => void refetch()}><RefreshCw style={{ width: 16, height: 16 }} /> Refresh</AdminButton>
      </div>
      {isLoading ? (
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Loading logs…</p>
      ) : logs.length === 0 ? (
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>No system logs yet. Activity will appear from audit, cron, and notifications.</p>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="settings-card admin-panel-glass admin-module-row">
            <FileText style={{ width: 16, height: 16, color: 'var(--admin-text-secondary)', marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>{log.msg}</p>
              <p style={{ fontSize: 11, color: 'var(--admin-text-muted)', margin: '2px 0 0' }}>{log.time}</p>
            </div>
            <StatusPill value={log.level} />
          </div>
        ))
      )}
    </div>
  )
}

// ─── Health ───────────────────────────────────────────────────────────────────
function SystemHealthView() {
  const [checks, setChecks] = useState<Awaited<ReturnType<typeof runAllHealthChecks>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try { setChecks(await runAllHealthChecks()) } catch { setError(true) }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  if (error) return <ErrorBanner />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Link href="/dashboard/api-health" className="admin-catalog-action inline-flex items-center">
          Full health dashboard
        </Link>
        <AdminButton onClick={() => void load()} loading={loading}>
          <RefreshCw style={{ width: 16, height: 16 }} /> Refresh
        </AdminButton>
      </div>
      {checks.map((svc) => (
        <div key={svc.id} className="settings-card admin-panel-glass admin-module-row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="admin-module-icon-ring">
              <HeartPulse style={{ width: 15, height: 15 }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{svc.name}</p>
              <p style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--admin-text-muted)', margin: 0 }}>{svc.group}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)' }}>{svc.latencyMs !== null ? `${svc.latencyMs}ms` : '—'}</span>
            <StatusPill value={svc.status} />
          </div>
        </div>
      ))}
    </div>
  )
}

const VIEWS: Record<string, () => React.ReactElement> = {
  '/dashboard/backups': BackupsView,
  '/dashboard/logs': LogsView,
  '/dashboard/system-health': SystemHealthView,
}

export function SystemModulePanel({ moduleHref }: ModuleContextProps) {
  const View = VIEWS[moduleHref] ?? SystemHealthView
  return <View />
}

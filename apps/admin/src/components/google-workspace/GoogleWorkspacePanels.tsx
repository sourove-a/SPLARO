'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart2,
  Calendar,
  ChevronDown,
  Cloud,
  FileText,
  FolderOpen,
  Globe,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Sheet,
  ShoppingCart,
  Unplug,
  Users,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { ModuleLiveStrip } from '@/components/ui/connection/ModuleLiveStrip'
import { cn } from '@/lib/utils/cn'
import {
  createDefaultSpreadsheet,
  activateGoogleServiceAccount,
  linkGoogleSpreadsheet,
  createDriveFolders,
  fetchGmailConfig,
  fetchGoogleSheetsConfig,
  fetchGoogleStatus,
  fetchGoogleSyncLogs,
  revokeGoogleAccess,
  syncGoogleNow,
  testGmail,
  testGoogleConnection,
  toggleGoogleAutoSync,
  updateGmailConfig,
  updateGoogleOAuthSettings,
} from '@/lib/api/google-workspace'
import { CEO_EMAIL } from '@/lib/auth/role-label'
import { useClientMounted } from '@/lib/hooks/use-client-mounted'
import type { ModuleContextProps } from '@/lib/modules/module-data'

function formatOAuthError(raw: string) {
  const lower = raw.toLowerCase()
  if (lower.includes('invalid_client')) {
    return {
      title: 'Google Client ID / Secret ঠিক নেই',
      body: 'Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client এ Client ID ও Secret মিলিয়ে দিন।',
      hint: 'http://localhost:4000/api/v1/admin/google/callback',
    }
  }
  if (lower.includes('redirect_uri_mismatch')) {
    return {
      title: 'Redirect URI মিলছে না',
      body: 'Google Console-এ exact redirect URI add করুন (নিচে Copy করুন)।',
      hint: 'http://localhost:4000/api/v1/admin/google/callback',
    }
  }
  if (lower.includes('refresh token')) {
    return {
      title: 'Refresh token পাওয়া যায়নি',
      body: 'Google Account → Security → Third-party access থেকে SPLARO revoke করে আবার Connect চাপুন।',
    }
  }
  return { title: 'Connect ব্যর্থ হয়েছে', body: raw }
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toastOk(`${label} copied`, 'gw-copy')
  } catch {
    toastFail('Copy failed — manually select the text', 'gw-copy-fail')
  }
}

function Collapsible({ title, summary, defaultOpen = false, children }: {
  title: string
  summary?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="ai-command-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 text-left">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black">{title}</h3>
          {!open && summary ? <p className="mt-0.5 truncate text-[11px] text-[var(--admin-text-muted)]">{summary}</p> : null}
        </div>
        <ChevronDown className={cn('h-4 w-4 text-[var(--admin-text-muted)] transition-transform', open && 'rotate-180')} />
      </button>
      {open ? <div className="mt-4 border-t border-[var(--admin-glass-border)] pt-4">{children}</div> : null}
    </div>
  )
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn('ai-command-pill', ok ? 'ai-command-pill--ok' : 'ai-command-pill--warn')}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label}
    </span>
  )
}

function useGoogleStatus() {
  return useQuery({
    queryKey: ['google-status'],
    queryFn: fetchGoogleStatus,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    retry: 2,
  })
}

function OverviewPanel() {
  const { data, isLoading, refetch } = useGoogleStatus()
  const testMut = useMutation({ mutationFn: () => testGoogleConnection('auto') })

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-[#5E7CFF]" /></div>
  }

  const cards = [
    { key: 'sheets', label: 'Sheets Sync', icon: Sheet, href: '/dashboard/google-workspace/sheets-sync' },
    { key: 'gmail', label: 'Gmail', icon: Mail, href: '/dashboard/google-workspace/gmail' },
    { key: 'drive', label: 'Drive Backup', icon: FolderOpen, href: '/dashboard/google-workspace/drive' },
    { key: 'analytics', label: 'Analytics', icon: BarChart2, href: '/dashboard/google-workspace/analytics' },
    { key: 'searchConsole', label: 'Search Console', icon: Search, href: '/dashboard/google-workspace/search-console' },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-8">
      <section className="ai-command-hero">
        <p className="ai-command-eyebrow">Google Workspace</p>
        <h1 className="ai-command-title">Integration Center</h1>
        <p className="ai-command-sub">OAuth 2.0 · encrypted tokens in PostgreSQL · BullMQ sync queue</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusPill
            ok={Boolean(data?.services.sheets?.connected)}
            label={data?.services.sheets?.connected ? `Sheets · ${data.serviceAccountEmail ?? 'linked'}` : 'Sheets not linked'}
          />
          <StatusPill
            ok={Boolean(data?.oauthConnected)}
            label={data?.oauthConnected ? `Gmail OAuth · ${data.oauthEmail ?? data.googleEmail}` : 'Gmail OAuth not connected'}
          />
          {data?.lastSyncAt ? <span className="ai-command-pill">Last sync: {new Date(data.lastSyncAt).toLocaleString()}</span> : null}
        </div>
        {data?.lastError ? <p className="mt-2 text-xs font-semibold text-red-600">{data.lastError}</p> : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ key, label, icon: Icon, href }) => {
          const svc = data?.services[key]
          return (
            <Link key={key} href={href} className="ai-command-card block transition hover:border-[#5E7CFF]/40">
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 text-[#5E7CFF]" />
                <div className="min-w-0 flex-1">
                  <p className="font-black">{label}</p>
                  <p className="mt-1 text-[11px] text-[var(--admin-text-muted)]">
                    {svc?.connected ? 'Connected' : 'Not connected'}
                    {svc?.lastSyncAt ? ` · ${new Date(svc.lastSyncAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <AdminButton variant="gold" loading={testMut.isPending} disabled={!data?.connected} onClick={() => void testMut.mutateAsync().then((r) => toastOk(r.message, 'gw-test')).catch((e) => toastFail(e.message, 'gw-test-fail'))}>
          Test Google API
        </AdminButton>
        <AdminButton onClick={() => void refetch()}><RefreshCw className="h-4 w-4" /> Refresh</AdminButton>
        <Link href="/dashboard/google-workspace/connect" className="admin-btn px-4 py-2 text-xs font-black">Connect account</Link>
      </div>
    </div>
  )
}

function googleConnectHref() {
  return '/api/google/connect'
}

function GoogleConnectionBanner({ action = 'use this feature' }: { action?: string }) {
  const { data: status } = useGoogleStatus()

  if (status?.oauthConnected) return null

  return (
    <div className="gw-connect-cta">
      <div>
        <p className="gw-connect-cta__title">
          {status?.tokenHealth === 'missing' || !status?.oauthConnected
            ? 'Google account connect করুন'
            : 'Google reconnect প্রয়োজন'}
        </p>
        <p className="gw-connect-cta__body">
          Gmail পাঠাতে আপনার Gmail/Google account দিয়ে OAuth connect করতে হবে। Service account শুধু Sheets sync-এর জন্য — Gmail এর জন্য নয়।
          {' '}Connect করলে {action} কাজ করবে।
          {status?.lastError ? <> Error: {status.lastError}</> : null}
        </p>
      </div>
      <div className="flex flex-shrink-0 flex-wrap gap-2">
        <a href={googleConnectHref()} className="admin-btn admin-btn--gold px-4 py-2 text-xs font-black inline-flex items-center gap-2">
          <Cloud className="h-4 w-4" /> Connect Gmail
        </a>
        <Link href="/dashboard/google-workspace/connect" className="admin-btn px-4 py-2 text-xs font-black">
          Setup guide
        </Link>
      </div>
    </div>
  )
}

function ClientIsoDate({ iso, fallback = '—' }: { iso: string; fallback?: string }) {
  const mounted = useClientMounted()
  const [label, setLabel] = useState(fallback)

  useEffect(() => {
    if (!mounted) return
    setLabel(new Date(iso).toLocaleString())
  }, [iso, mounted])

  return <span suppressHydrationWarning>{label}</span>
}

function ConnectPanelSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10" aria-busy="true" aria-label="Loading Gmail connect">
      <section className="gw-connect-hero">
        <div className="gw-connect-hero__icon">
          <Mail className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="ai-command-eyebrow">Google Workspace</p>
          <h1 className="ai-command-title">Gmail Connect</h1>
          <p className="ai-command-sub">Loading connection status…</p>
        </div>
      </section>
      <div className="flex justify-center py-8">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--admin-text-muted)]" />
      </div>
    </div>
  )
}

function ConnectPanelInner() {
  const searchParams = useSearchParams()
  const mounted = useClientMounted()
  const qc = useQueryClient()
  const { data: status, refetch } = useGoogleStatus()
  const revokeMut = useMutation({ mutationFn: revokeGoogleAccess })
  const testMut = useMutation({ mutationFn: () => testGoogleConnection('gmail') })
  const saMut = useMutation({ mutationFn: activateGoogleServiceAccount })

  const oauthReady = Boolean(status?.oauthConnected)
  const configReady = status?.oauthConfigReady !== false
  const loginHint = status?.oauthLoginHint ?? CEO_EMAIL
  const redirectUri = status?.oauth.redirectUri ?? 'http://localhost:4000/api/v1/admin/google/callback'
  const urlError = mounted ? searchParams.get('error') : null

  useEffect(() => {
    if (!mounted) return
    if (searchParams.get('connected') === '1') {
      const email = searchParams.get('email')
      toastOk(email ? `Gmail connected: ${email}` : 'Gmail account connected', 'gw-oauth-ok')
      void qc.invalidateQueries({ queryKey: ['google-status'] })
      void refetch()
    }
  }, [searchParams, qc, refetch, mounted])

  const handleConnect = () => {
    if (!configReady) {
      toastFail('OAuth Client ID / Secret missing — check .env or OAuth Settings', 'gw-oauth-config')
      return
    }
    window.location.href = googleConnectHref()
  }

  const errorInfo = urlError ? formatOAuthError(urlError) : null

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <section className="gw-connect-hero">
        <div className="gw-connect-hero__icon">
          <Mail className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="ai-command-eyebrow">Google Workspace</p>
          <h1 className="ai-command-title">Gmail Connect</h1>
          <p className="ai-command-sub">
            Order emails, notifications ও Gmail API — আপনার personal Gmail দিয়ে OAuth connect করুন।
          </p>
        </div>
      </section>

      {errorInfo ? (
        <div className="gw-connect-error">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="gw-connect-error__title">{errorInfo.title}</p>
            <p className="gw-connect-error__body">{errorInfo.body}</p>
            {errorInfo.hint ? (
              <button type="button" className="gw-connect-error__hint" onClick={() => void copyText(errorInfo.hint!, 'Redirect URI')}>
                {errorInfo.hint} · Copy
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="gw-status-grid">
        <div className={cn('gw-status-card', oauthReady && 'gw-status-card--ok')}>
          <div className="gw-status-card__head">
            <Mail className="h-4 w-4" />
            <span>Gmail OAuth</span>
          </div>
          <p className="gw-status-card__value">{oauthReady ? (status?.oauthEmail ?? 'Connected') : 'Not connected'}</p>
          <p className="gw-status-card__meta">
            {oauthReady
              ? `Token · ${status?.tokenHealth ?? 'healthy'}`
              : configReady
                ? `Login hint · ${loginHint}`
                : 'Client ID / Secret missing'}
          </p>
        </div>
        <div className={cn('gw-status-card', status?.serviceAccountConfigured && 'gw-status-card--ok')}>
          <div className="gw-status-card__head">
            <Sheet className="h-4 w-4" />
            <span>Sheets Sync</span>
          </div>
          <p className="gw-status-card__value">{status?.serviceAccountConfigured ? 'Service account ready' : 'Not configured'}</p>
          <p className="gw-status-card__meta">{status?.serviceAccountEmail ?? '—'}</p>
        </div>
      </div>

      {oauthReady ? (
        <div className="gw-connected-banner">
          <CheckCircle2 className="h-6 w-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="gw-connected-banner__title">Gmail connected</p>
            <p className="gw-connected-banner__email">{status?.oauthEmail}</p>
            <p className="gw-connected-banner__meta">
              Expires{' '}
              {status?.tokenExpiry ? (
                <ClientIsoDate iso={status.tokenExpiry} fallback="auto-refresh" />
              ) : (
                'auto-refresh'
              )}
            </p>
          </div>
          <Link href="/dashboard/google-workspace/gmail" className="admin-btn px-4 py-2 text-xs font-black">
            Open Gmail panel
          </Link>
        </div>
      ) : (
        <div className="gw-connect-wizard">
          <p className="gw-connect-wizard__title">৩ ধাপে connect করুন</p>
          <ol className="gw-connect-steps">
            <li className="gw-connect-step">
              <span className="gw-connect-step__num">১</span>
              <div>
                <strong>Connect Gmail চাপুন</strong>
                <p>Google login page খুলবে — <code>{loginHint}</code> account বেছে নিন।</p>
              </div>
            </li>
            <li className="gw-connect-step">
              <span className="gw-connect-step__num">২</span>
              <div>
                <strong>সব permission Allow দিন</strong>
                <p>Gmail send, Drive, Sheets access দরকার।</p>
              </div>
            </li>
            <li className="gw-connect-step">
              <span className="gw-connect-step__num">৩</span>
              <div>
                <strong>ফিরে এলে Test connection</strong>
                <p>Connected দেখলে Gmail panel থেকে test email পাঠান।</p>
              </div>
            </li>
          </ol>
          <AdminButton
            className="gw-connect-wizard__cta"
            variant="gold"
            disabled={!configReady}
            onClick={handleConnect}
          >
            <Cloud className="h-5 w-5" />
            Connect Gmail · {loginHint}
          </AdminButton>
          <p className="mt-2 text-center text-[11px] font-semibold text-[var(--admin-text-muted)]">
            Long link copy করবেন না — উপরের বাটনই ব্যবহার করুন।
          </p>
        </div>
      )}

      <Collapsible
        title="Connection details"
        defaultOpen={!oauthReady}
        summary={oauthReady ? (status?.oauthEmail ?? 'Connected') : 'OAuth pending'}
      >
        <div className="space-y-2 text-sm text-[var(--admin-text-secondary)]">
          <p><strong className="text-[var(--admin-text-strong)]">OAuth email:</strong> {status?.oauthEmail ?? '—'}</p>
          <p><strong className="text-[var(--admin-text-strong)]">Client ID:</strong> {status?.oauth.clientId ? `${status.oauth.clientId.slice(0, 20)}…` : '—'}</p>
          <p><strong className="text-[var(--admin-text-strong)]">Redirect URI:</strong>{' '}
            <button type="button" className="gw-inline-copy" onClick={() => void copyText(redirectUri, 'Redirect URI')}>
              {redirectUri} · Copy
            </button>
          </p>
          <p><strong className="text-[var(--admin-text-strong)]">Sheets SA:</strong> {status?.serviceAccountEmail ?? '—'}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <AdminButton variant="gold" disabled={!configReady} onClick={handleConnect}>
            <Cloud className="h-4 w-4" /> {oauthReady ? 'Reconnect Gmail' : 'Connect Gmail'}
          </AdminButton>
          <AdminButton
            loading={revokeMut.isPending}
            disabled={!oauthReady}
            onClick={() =>
              void revokeMut
                .mutateAsync()
                .then(() => { toastOk('Gmail access revoked', 'gw-revoke'); void refetch() })
                .catch((e) => toastFail(e.message, 'gw-revoke-fail'))
            }
          >
            <Unplug className="h-4 w-4" /> Revoke Gmail
          </AdminButton>
          <AdminButton
            loading={testMut.isPending}
            disabled={!oauthReady}
            onClick={() =>
              void testMut
                .mutateAsync()
                .then((r) => toastOk(r.message, 'gw-test'))
                .catch((e) => toastFail(e.message, 'gw-test-fail'))
            }
          >
            Test Gmail OAuth
          </AdminButton>
          <Link href="/dashboard/google-workspace/oauth-settings" className="admin-btn px-4 py-2 text-xs font-black">
            OAuth Settings
          </Link>
        </div>
      </Collapsible>

      <Collapsible title="Sheets Service Account (আলাদা)" defaultOpen={false} summary={status?.serviceAccountEmail ?? 'Sheets only'}>
        <p className="gw-callout gw-callout--info">
          Service account শুধু Google Sheets sync-এর জন্য। Gmail পাঠাতে উপরের OAuth connect করতে হবে।
        </p>
        <p className="mt-3 gw-callout gw-callout--success">
          <code className="text-[11px]">{status?.serviceAccountEmail ?? 'splaro-sheets-sync@splaro.iam.gserviceaccount.com'}</code>
        </p>
        <div className="mt-4">
          <AdminButton
            variant="gold"
            loading={saMut.isPending}
            disabled={!status?.serviceAccountConfigured}
            onClick={() =>
              void saMut
                .mutateAsync()
                .then((r) => { toastOk(r.message, 'gw-sa'); void refetch() })
                .catch((e) => toastFail(e.message, 'gw-sa-fail'))
            }
          >
            Activate Service Account
          </AdminButton>
        </div>
      </Collapsible>
    </div>
  )
}

function ConnectPanel() {
  return (
    <Suspense fallback={<ConnectPanelSkeleton />}>
      <ConnectPanelInner />
    </Suspense>
  )
}

function SheetsPanel() {
  const qc = useQueryClient()
  const { data: status } = useGoogleStatus()
  const { data: sheets, isLoading, refetch } = useQuery({ queryKey: ['google-sheets'], queryFn: fetchGoogleSheetsConfig })
  const createMut = useMutation({ mutationFn: createDefaultSpreadsheet })
  const syncMut = useMutation({ mutationFn: syncGoogleNow })
  const autoMut = useMutation({ mutationFn: toggleGoogleAutoSync })
  const saMut = useMutation({ mutationFn: activateGoogleServiceAccount })
  const linkMut = useMutation({ mutationFn: linkGoogleSpreadsheet })

  const sheetsReady = Boolean(status?.connected || status?.serviceAccountConfigured)
  const defaultSheetUrl = 'https://docs.google.com/spreadsheets/d/1sOehorwCZ6Qoa7rU4T-sKXcXMzNm5x3NbWQ6LCqMEW0/edit'

  if (isLoading) return <Loader2 className="mx-auto my-16 h-7 w-7 animate-spin text-[#5E7CFF]" />

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <section className="ai-command-hero">
        <h1 className="ai-command-title">Google Sheets Sync</h1>
        <p className="ai-command-sub">Premium live dashboard · charts · bright status badges · auto-refresh every 3 min</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusPill ok={sheetsReady} label={sheetsReady ? `Live · ${status?.googleEmail ?? status?.serviceAccountEmail}` : 'Activate service account'} />
          {sheets?.autoSyncEnabled ? <span className="ai-command-pill ai-command-pill--ok">🟢 Auto-sync ON</span> : <span className="ai-command-pill">Auto-sync OFF</span>}
        </div>
        {sheets?.spreadsheetUrl ? (
          <a href={sheets.spreadsheetUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-black text-[#9a7b52] hover:underline">
            Open spreadsheet <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </section>

      <Collapsible title="Service Account" defaultOpen summary={status?.serviceAccountEmail ?? 'splaro-sheets-sync@...'}>
        <p className="mb-2 text-xs text-[var(--admin-text-secondary)]">
          Sheet-এ Share করুন: <strong className="text-[var(--admin-text-strong)]">{status?.serviceAccountEmail}</strong> → Editor
        </p>
        <AdminButton variant="gold" loading={saMut.isPending} disabled={!status?.serviceAccountConfigured} onClick={() => void saMut.mutateAsync().then((r) => { toastOk(r.message, 'gw-sa'); void qc.invalidateQueries({ queryKey: ['google-status'] }); void refetch() }).catch((e) => toastFail(e.message, 'gw-sa-fail'))}>
          Activate Service Account
        </AdminButton>
        <AdminButton loading={linkMut.isPending} disabled={!sheetsReady} onClick={() => void linkMut.mutateAsync({ spreadsheetUrl: defaultSheetUrl }).then((r) => { toastOk(`Linked — ${r.orders ?? 0} orders synced`, 'gw-link'); void refetch(); void qc.invalidateQueries({ queryKey: ['google-status'] }) }).catch((e) => toastFail(e.message, 'gw-link-fail'))}>
          Link your spreadsheet & sync
        </AdminButton>
      </Collapsible>

      <Collapsible title="Spreadsheet" defaultOpen summary={sheets?.spreadsheetId ? 'Configured' : 'Not created'}>
        {!sheetsReady ? (
          <p className="mb-3 gw-callout gw-callout--warn">
            আগে <Link href="/dashboard/google-workspace/connect" className="underline">Connect Google Account</Link> করুন।
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <AdminButton variant="gold" loading={createMut.isPending} disabled={!sheetsReady} onClick={() => void createMut.mutateAsync().then((r) => { toastOk(`Business hub ready — ${r.orders ?? 0} orders, ${r.customers ?? 0} customers`, 'gw-sheet-create'); void refetch(); void qc.invalidateQueries({ queryKey: ['google-status'] }) }).catch((e) => toastFail(e.message, 'gw-sheet-fail'))}>
            Create SPLARO Business Spreadsheet
          </AdminButton>
          <AdminButton loading={syncMut.isPending} disabled={!sheets?.spreadsheetId} onClick={() => void syncMut.mutateAsync({ jobType: 'google.sync.full-backup' }).then(() => toastOk('Full sync queued', 'gw-sync')).catch((e) => toastFail(e.message, 'gw-sync-fail'))}>
            <RefreshCw className="h-4 w-4" /> Manual full sync
          </AdminButton>
          <AdminButton loading={autoMut.isPending} onClick={() => void autoMut.mutateAsync(!sheets?.autoSyncEnabled).then(() => { toastOk('Auto sync updated', 'gw-auto'); void refetch() }).catch((e) => toastFail(e.message, 'gw-auto-fail'))}>
            Auto sync: {sheets?.autoSyncEnabled ? 'ON' : 'OFF'}
          </AdminButton>
        </div>
      </Collapsible>

      <Collapsible title="Sheet tabs" summary={`${sheets?.tabs.length ?? 0} configured`}>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {(sheets?.allTabs ?? []).map((tab) => {
            const cfg = sheets?.tabs.find((t) => t.sheetTab === tab)
            return (
              <div key={tab} className="gw-list-row">
                <span className="font-bold">{tab}</span>
                <span className={cn('font-black', cfg?.enabled ? 'text-emerald-600' : 'text-[#9B9B9B]')}>
                  {cfg ? 'ready' : 'pending'}
                </span>
              </div>
            )
          })}
        </div>
      </Collapsible>
    </div>
  )
}

function GmailPanel() {
  const [senderName, setSenderName] = useState('SPLARO')
  const [testTo, setTestTo] = useState('')
  const { data: status } = useGoogleStatus()
  const { data: gmail, refetch } = useQuery({ queryKey: ['google-gmail'], queryFn: fetchGmailConfig })
  const testMut = useMutation({ mutationFn: testGmail })
  const saveMut = useMutation({ mutationFn: updateGmailConfig })

  useEffect(() => {
    if (gmail?.senderName) setSenderName(gmail.senderName)
  }, [gmail])

  const oauthReady = Boolean(status?.oauthConnected)

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <section className="ai-command-hero">
        <h1 className="ai-command-title">Gmail</h1>
        <p className="ai-command-sub">Send via Gmail API · real delivery confirmation</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusPill
            ok={oauthReady}
            label={oauthReady ? `OAuth · ${status?.oauthEmail ?? gmail?.senderEmail ?? 'connected'}` : 'OAuth not connected'}
          />
          {status?.serviceAccountEmail ? (
            <span className="ai-command-pill">Sheets only: {status.serviceAccountEmail}</span>
          ) : null}
        </div>
      </section>

      <GoogleConnectionBanner action="send test email" />

      <Collapsible title="Sender settings" defaultOpen>
        <label className="block space-y-1">
          <span className="text-[11px] font-black uppercase text-[var(--admin-text-muted)]">Sender name</span>
          <input className="admin-input w-full" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
        </label>
        {gmail?.senderEmail ? (
          <p className="mt-2 text-[11px] text-[var(--admin-text-muted)]">Send as: {gmail.senderEmail}</p>
        ) : null}
        <AdminButton
          className="mt-3"
          loading={saveMut.isPending}
          disabled={!oauthReady}
          onClick={() => void saveMut.mutateAsync({ senderName }).then(() => { toastOk('Gmail settings saved', 'gw-gmail-save'); void refetch() }).catch((e) => toastFail(e.message, 'gw-gmail-save-fail'))}
        >
          Save sender
        </AdminButton>
      </Collapsible>

      <Collapsible title="Test email" defaultOpen>
        <input className="admin-input w-full" placeholder="test@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
        {!oauthReady ? (
          <p className="mt-2 text-[11px] font-semibold text-amber-400">Connect Gmail first — OAuth refresh token missing.</p>
        ) : null}
        <AdminButton
          className="mt-3"
          variant="gold"
          loading={testMut.isPending}
          disabled={!oauthReady || !testTo}
          onClick={() => void testMut.mutateAsync(testTo).then((r) => toastOk(`Sent · ${r.messageId}`, 'gw-gmail-test')).catch((e) => toastFail(e.message, 'gw-gmail-test-fail'))}
        >
          Send test email
        </AdminButton>
      </Collapsible>
    </div>
  )
}

function DrivePanel() {
  const qc = useQueryClient()
  const folderMut = useMutation({
    mutationFn: createDriveFolders,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['google-status'] }),
  })
  const { data: status } = useGoogleStatus()
  const driveReady = Boolean(status?.connected)
  const foldersCreated = Boolean(status?.driveRootFolderId)

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <section className="ai-command-hero">
        <h1 className="ai-command-title">Google Drive</h1>
        <p className="ai-command-sub">SPLARO folder structure for invoices, reports, backups</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusPill ok={driveReady} label={driveReady ? `Ready · ${status?.googleEmail ?? 'connected'}` : 'Connect Google account first'} />
          <StatusPill ok={foldersCreated} label={foldersCreated ? 'Folders created' : 'Folders not created yet'} />
        </div>
      </section>
      <Collapsible title="Folders" defaultOpen summary={foldersCreated ? 'Created' : 'Not created'}>
        <p className="mb-3 text-[11px] font-medium text-[var(--admin-text-muted)]">
          Requires Google Drive API enabled in your Google Cloud project (same project as OAuth client).
        </p>
        <ul className="space-y-1 text-[11px] font-semibold text-[#6B6B6B]">
          {['SPLARO', 'SPLARO/Invoices', 'SPLARO/Reports', 'SPLARO/Product Media', 'SPLARO/Backups', 'SPLARO/Finance', 'SPLARO/Suppliers'].map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        {!driveReady ? (
          <p className="mt-3 text-[11px] font-semibold text-amber-400">
            Connect Google account or activate service account in Google Workspace first.
          </p>
        ) : null}
        <AdminButton
          className="mt-3"
          variant="gold"
          loading={folderMut.isPending}
          disabled={!driveReady}
          onClick={() =>
            void folderMut
              .mutateAsync()
              .then(() => toastOk('Drive folders created', 'gw-drive'))
              .catch((e: Error) => toastFail(e.message, 'gw-drive-fail'))
          }
        >
          Create folder structure
        </AdminButton>
      </Collapsible>
    </div>
  )
}

function ServicePlaceholder({ title, desc, icon: Icon }: { title: string; desc: string; icon: React.ElementType }) {
  const { data: status } = useGoogleStatus()
  const oauthReady = Boolean(status?.oauthConnected)
  const sheetsReady = Boolean(status?.spreadsheetId)
  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <section className="ai-command-hero">
        <Icon className="mb-2 h-6 w-6 text-[var(--admin-brand-gold)]" />
        <h1 className="ai-command-title">{title}</h1>
        <p className="ai-command-sub">{desc}</p>
        <StatusPill ok={oauthReady} label={oauthReady ? `OAuth ready · ${status?.oauthEmail ?? ''}` : 'Connect Gmail OAuth first'} />
      </section>

      <ModuleLiveStrip
        items={[
          {
            label: 'Google OAuth',
            value: oauthReady ? 'Connected' : 'Not connected',
            ok: oauthReady,
            ...(!oauthReady ? { href: '/dashboard/google-workspace/connect' } : {}),
          },
          {
            label: 'Spreadsheet',
            value: sheetsReady ? 'Linked' : 'Not linked',
            ok: sheetsReady,
            href: '/dashboard/google-workspace/sheets-sync',
          },
          {
            label: title,
            value: oauthReady ? 'API ready' : 'Needs OAuth',
            ok: oauthReady,
          },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        <AdminNavLink href="/dashboard/google-workspace/connect" className="admin-btn admin-btn--gold px-4 py-2 text-xs">
          {oauthReady ? 'Manage connection' : 'Connect Google account'}
        </AdminNavLink>
        <AdminNavLink href="/dashboard/google-workspace/sheets-sync" className="admin-btn admin-btn--ghost px-4 py-2 text-xs">
          Sheets sync
        </AdminNavLink>
        <AdminNavLink href="/dashboard/google-workspace/sync-logs" className="admin-btn admin-btn--ghost px-4 py-2 text-xs">
          Sync logs
        </AdminNavLink>
      </div>

      <p className="text-sm text-[var(--admin-text-muted)]">
        {oauthReady
          ? `${title} uses the same Google OAuth token as Sheets and Gmail. Service-specific dashboards will expand here — use Sheets Sync and Sync Logs for live data today.`
          : 'Connect your Google account first. Service account alone is not enough for Gmail, Calendar, or Docs APIs.'}
      </p>
    </div>
  )
}

function SyncLogsPanel() {
  const { data, isLoading } = useQuery({ queryKey: ['google-sync-logs'], queryFn: () => fetchGoogleSyncLogs(1) })
  if (isLoading) return <Loader2 className="mx-auto my-16 h-7 w-7 animate-spin" />
  const items = (data?.items ?? []) as Array<{ id: string; jobType: string; sheetTab?: string; status: string; errorMsg?: string; createdAt: string }>
  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <section className="ai-command-hero">
        <h1 className="ai-command-title">Sync Logs</h1>
        <p className="ai-command-sub">{data?.total ?? 0} total events</p>
      </section>
      <div className="space-y-1">
        {items.length === 0 ? <p className="text-sm text-[#6B6B6B]">No sync logs yet.</p> : items.map((log) => (
          <div key={log.id} className="gw-list-row">
            <span className="font-bold">{log.jobType}{log.sheetTab ? ` · ${log.sheetTab}` : ''}</span>
            <span className={cn('font-black', log.status === 'success' ? 'text-emerald-600' : 'text-red-500')}>
              {log.status} · {new Date(log.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function OAuthSettingsPanel() {
  const qc = useQueryClient()
  const { data: status, isLoading, isError, refetch } = useGoogleStatus()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [redirectUri, setRedirectUri] = useState('')
  const [dirty, setDirty] = useState(false)
  const saveMut = useMutation({ mutationFn: updateGoogleOAuthSettings })

  const secretSaved = Boolean(status?.oauth.clientSecret)
  const defaultRedirect = 'http://localhost:4000/api/v1/admin/google/callback'

  useEffect(() => {
    if (!status || dirty) return
    setClientId(status.oauth.clientId ?? '')
    setRedirectUri(status.oauth.redirectUri ?? defaultRedirect)
    setClientSecret('')
  }, [status, dirty])

  const markDirty = () => setDirty(true)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--admin-text-muted)]" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-8">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
          API offline — run <code className="rounded bg-black/20 px-1">pnpm dev:stack</code>, refresh, then try again.
        </div>
        <AdminButton variant="ghost" onClick={() => void refetch()}>Retry</AdminButton>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <section className="ai-command-hero">
        <h1 className="ai-command-title">OAuth Settings</h1>
        <p className="ai-command-sub">Credentials are encrypted in the database. Client Secret field is always empty after save — that is normal.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusPill ok={Boolean(clientId.trim())} label={clientId.trim() ? 'Client ID set' : 'Client ID missing'} />
          <StatusPill ok={secretSaved} label={secretSaved ? 'Client secret saved' : 'Client secret required'} />
          <StatusPill ok={Boolean(redirectUri.trim())} label={redirectUri.trim() ? 'Redirect URI set' : 'Redirect URI missing'} />
        </div>
      </section>

      {status?.oauth.secretSource === 'env' ? (
        <p className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200">
          Client secret loaded from <code className="rounded bg-black/20 px-1">.env</code> (takes priority over any saved DB value).
          Save here only to store encrypted in the database when <code className="rounded bg-black/20 px-1">GOOGLE_CLIENT_SECRET</code> is not in env.
        </p>
      ) : null}

      <Collapsible title="Credentials" defaultOpen>
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[11px] font-black uppercase text-[var(--admin-text-muted)]">Client ID</span>
            <input
              className="admin-input w-full font-mono text-sm"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); markDirty() }}
              placeholder="xxxx.apps.googleusercontent.com"
            />
          </label>
          <label className="block space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase text-[var(--admin-text-muted)]">Client Secret</span>
              {secretSaved ? (
                <span className="text-[10px] font-bold text-emerald-400">Saved — enter again only to replace</span>
              ) : (
                <span className="text-[10px] font-bold text-amber-400">Required — paste GOCSPX-… from Google Cloud</span>
              )}
            </div>
            <input
              type="password"
              className="admin-input w-full font-mono text-sm"
              placeholder={secretSaved ? 'Leave blank to keep saved secret' : 'Paste full GOCSPX secret here'}
              value={clientSecret}
              onChange={(e) => { setClientSecret(e.target.value); markDirty() }}
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-black uppercase text-[var(--admin-text-muted)]">Redirect URI</span>
            <input
              className="admin-input w-full font-mono text-sm"
              value={redirectUri}
              onChange={(e) => { setRedirectUri(e.target.value); markDirty() }}
              placeholder={defaultRedirect}
            />
            <p className="text-[10px] font-medium text-[var(--admin-text-muted)]">
              Add this exact URI in Google Cloud Console → OAuth client → Authorized redirect URIs
            </p>
          </label>
        </div>
        <AdminButton
          className="mt-3"
          variant="gold"
          loading={saveMut.isPending}
          onClick={() => {
            const id = clientId.trim()
            const uri = redirectUri.trim()
            if (!id) {
              toastFail('Client ID is required', 'gw-oauth-missing-id')
              return
            }
            if (!uri) {
              toastFail('Redirect URI is required', 'gw-oauth-missing-uri')
              return
            }
            if (!secretSaved && !clientSecret.trim()) {
              toastFail('Client Secret is required — paste your GOCSPX value from Google Cloud Console', 'gw-oauth-missing-secret')
              return
            }
            const body: { clientId: string; redirectUri: string; clientSecret?: string } = {
              clientId: id,
              redirectUri: uri,
            }
            if (clientSecret.trim()) body.clientSecret = clientSecret.trim()

            void saveMut
              .mutateAsync(body)
              .then(async (saved) => {
                setClientId(saved.clientId ?? id)
                setRedirectUri(saved.redirectUri ?? uri)
                setClientSecret('')
                setDirty(false)
                await qc.invalidateQueries({ queryKey: ['google-status'] })
                toastOk('OAuth credentials saved', 'gw-oauth-save')
              })
              .catch((e: Error) => toastFail(e.message || 'Save failed — check API is running', 'gw-oauth-save-fail'))
          }}
        >
          Save OAuth settings
        </AdminButton>
      </Collapsible>
    </div>
  )
}

const ROUTE_PANELS: Record<string, React.ComponentType> = {
  '/dashboard/google-workspace': OverviewPanel,
  '/dashboard/google-workspace/connect': ConnectPanel,
  '/dashboard/google-workspace/sheets-sync': SheetsPanel,
  '/dashboard/google-workspace/gmail': GmailPanel,
  '/dashboard/google-workspace/drive': DrivePanel,
  '/dashboard/google-workspace/docs': () => <ServicePlaceholder title="Google Docs" desc="Auto reports & document templates" icon={FileText} />,
  '/dashboard/google-workspace/calendar': () => <ServicePlaceholder title="Calendar" desc="Campaign & reminder scheduling" icon={Calendar} />,
  '/dashboard/google-workspace/contacts': () => <ServicePlaceholder title="Contacts" desc="Optional customer sync — disabled by default" icon={Users} />,
  '/dashboard/google-workspace/analytics': () => <ServicePlaceholder title="Analytics" desc="Visitors, conversion, top pages" icon={BarChart2} />,
  '/dashboard/google-workspace/search-console': () => <ServicePlaceholder title="Search Console" desc="Keywords, indexing, CTR" icon={Globe} />,
  '/dashboard/google-workspace/merchant-center': () => <ServicePlaceholder title="Merchant Center" desc="Product feed sync" icon={ShoppingCart} />,
  '/dashboard/google-workspace/sync-logs': SyncLogsPanel,
  '/dashboard/google-workspace/oauth-settings': OAuthSettingsPanel,
}

export function GoogleWorkspaceModulePanel({ moduleHref }: ModuleContextProps) {
  const Panel = ROUTE_PANELS[moduleHref] ?? OverviewPanel
  return <Panel />
}

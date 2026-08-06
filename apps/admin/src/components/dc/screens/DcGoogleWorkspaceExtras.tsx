'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { ApiError } from '@/lib/api/client'
import {
  createDriveFolders,
  fetchGmailConfig,
  fetchGoogleOAuthUrl,
  fetchGoogleStatus,
  fetchGoogleSyncLogs,
  revokeGoogleAccess,
  testGmail,
  updateGoogleOAuthSettings,
} from '@/lib/api/google-workspace'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DcField, DcModal } from '@/components/dc/DcModal'

export type GoogleExtrasTab = 'connect' | 'gmail' | 'drive' | 'oauth' | 'logs'

const TAB_PATH: Record<GoogleExtrasTab, string> = {
  connect: '/dashboard/google-workspace/connect',
  gmail: '/dashboard/google-workspace/gmail',
  drive: '/dashboard/google-workspace/drive',
  oauth: '/dashboard/google-workspace/oauth-settings',
  logs: '/dashboard/google-workspace/sync-logs',
}

export function DcGoogleWorkspaceExtras({ tab = 'connect' }: { tab?: GoogleExtrasTab }) {
  const router = useRouter()
  return (
    <DcScreenProvider screen="google-extras" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcGoogleWorkspaceExtrasBody initial={tab} />
    </DcScreenProvider>
  )
}

function DcGoogleWorkspaceExtrasBody({ initial }: { initial: GoogleExtrasTab }) {
  const router = useRouter()
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const [tab, setTab] = useState<GoogleExtrasTab>(initial)
  const [oauthOpen, setOauthOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [testTo, setTestTo] = useState('')

  const status = useQuery({ queryKey: ['google-status'], queryFn: fetchGoogleStatus, staleTime: 15_000, retry: 1 })
  const gmail = useQuery({ queryKey: ['gmail-config'], queryFn: fetchGmailConfig, staleTime: 30_000, retry: 1 })
  const logs = useQuery({
    queryKey: ['google-sync-logs'],
    queryFn: () => fetchGoogleSyncLogs(1),
    staleTime: 15_000,
    retry: 1,
  })

  const connect = useMutation({
    mutationFn: fetchGoogleOAuthUrl,
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url
      else toast('bad', 'Connect failed', 'No OAuth URL returned')
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Connect failed'
      toast('bad', 'Connect failed', msg)
    },
  })

  const revoke = useMutation({
    mutationFn: revokeGoogleAccess,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['google-status'] })
      toast('ok', 'Google disconnected', 'OAuth tokens revoked on the API.')
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Revoke failed'
      toast('bad', 'Disconnect failed', msg)
    },
  })

  const saveOauth = useMutation({
    mutationFn: () => updateGoogleOAuthSettings({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['google-status'] })
      toast('ok', 'OAuth settings saved', 'Credentials stored on the API.')
      setOauthOpen(false)
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Save failed'
      toast('bad', 'OAuth not saved', msg)
    },
  })

  const drive = useMutation({
    mutationFn: createDriveFolders,
    onSuccess: () => toast('ok', 'Drive folders ready', 'Default backup folders created.'),
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Drive failed'
      toast('bad', 'Drive folders failed', msg)
    },
  })

  const gmailTest = useMutation({
    mutationFn: () => testGmail(testTo.trim()),
    onSuccess: () => toast('ok', 'Test email queued', testTo.trim()),
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Test failed'
      toast('bad', 'Gmail test failed', msg)
    },
  })

  const logRows = useMemo(() => {
    const items = logs.data?.items ?? []
    return items.slice(0, 40).map((row) => [
      row.jobType ?? 'sync',
      row.status ?? '—',
      row.errorMsg ?? '—',
      row.createdAt ?? '—',
    ])
  }, [logs.data])

  const connected = Boolean(status.data?.connected)

  return (
    <>
      <DcHubFrame
        crumbGroup="Google Workspace"
        title="Google Workspace"
        queries={[status, ...(tab === 'gmail' ? [gmail] : []), ...(tab === 'logs' ? [logs] : [])]}
        // Every tab except Connect is meaningless until OAuth is linked — show
        // the reason and the way out instead of empty tables.
        empty={!connected && tab !== 'connect'}
        emptyState={{
          icon: 'icon-cloud',
          title: 'Google Workspace is not connected',
          body: 'Drive, Gmail and sync logs stay empty until the Workspace OAuth account is linked. Connect it once and this tab fills in.',
          cta: 'Go to Connect',
          onCta: () => setTab('connect'),
        }}
        {...(tab === 'connect'
          ? {
              actions: [
                {
                  label: connected ? 'Disconnect' : 'Connect Google',
                  icon: connected ? 'icon-unlink' : 'icon-link',
                  variant: 'primary' as const,
                  onClick: () => {
                    if (connected) void revoke.mutateAsync()
                    else void connect.mutateAsync()
                  },
                },
                {
                  label: 'OAuth settings',
                  icon: 'icon-key',
                  onClick: () => setOauthOpen(true),
                },
              ],
            }
          : tab === 'drive'
            ? {
                actions: [
                  {
                    label: 'Create folders',
                    icon: 'icon-folder',
                    variant: 'primary' as const,
                    onClick: () => void drive.mutateAsync(),
                  },
                ],
              }
            : tab === 'gmail'
              ? {
                  actions: [
                    {
                      label: 'Send test',
                      icon: 'icon-mail',
                      variant: 'primary' as const,
                      onClick: () => {
                        if (!testTo.trim()) {
                          toast('warn', 'Enter a recipient', 'Use the test email field first.')
                          return
                        }
                        void gmailTest.mutateAsync()
                      },
                    },
                  ],
                }
              : tab === 'oauth'
                ? {
                    actions: [
                      {
                        label: 'Edit OAuth',
                        icon: 'icon-key',
                        variant: 'primary' as const,
                        onClick: () => setOauthOpen(true),
                      },
                    ],
                  }
                : {})}
      >
        <HubTabs
          tabs={[
            { id: 'connect', label: 'Connect' },
            { id: 'gmail', label: 'Gmail' },
            { id: 'drive', label: 'Drive' },
            { id: 'oauth', label: 'OAuth' },
            { id: 'logs', label: 'Sync logs' },
          ]}
          active={tab}
          onChange={(id) => {
            const next = id as GoogleExtrasTab
            setTab(next)
            router.replace(TAB_PATH[next])
          }}
        />
        <HubKpis
          items={[
            { label: 'Connection', value: connected ? 'Linked' : 'Off', tone: connected ? 'ok' : 'warn' },
            {
              label: 'Gmail sender',
              value: gmail.data?.senderName ?? '—',
            },
          ]}
        />
        {tab === 'gmail' ? (
          <DcField label="Test recipient" value={testTo} onChange={setTestTo} placeholder="you@example.com" />
        ) : null}
        {tab === 'logs' ? (
          <HubTable columns={['Job', 'Status', 'Message', 'When']} rows={logRows} />
        ) : (
          <div style={{ font: '400 13px/1.5 var(--font-ui, inherit)', color: 'var(--ink-2)' }}>
            {tab === 'connect'
              ? connected
                ? 'Google account is linked. Sheets sync lives under Integrations → Google Sheets.'
                : 'Connect OAuth to enable Gmail, Drive, and Sheets sync.'
              : tab === 'drive'
                ? 'Creates the default SPLARO backup folder tree in the connected Drive.'
                : tab === 'oauth'
                  ? 'Client ID / secret are stored encrypted on the API. Use Edit OAuth to update.'
                  : 'Gmail transactional sender config from the Google Workspace API.'}
          </div>
        )}
      </DcHubFrame>

      <DcModal
        open={oauthOpen}
        title="OAuth settings"
        confirmLabel="Save"
        busy={saveOauth.isPending}
        onClose={() => setOauthOpen(false)}
        onConfirm={() => void saveOauth.mutateAsync()}
      >
        <DcField label="Client ID" value={clientId} onChange={setClientId} mono />
        <DcField label="Client secret" value={clientSecret} onChange={setClientSecret} mono />
      </DcModal>
    </>
  )
}

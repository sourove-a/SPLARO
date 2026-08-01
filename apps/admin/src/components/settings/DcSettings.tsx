'use client'

import { useRouter } from 'next/navigation'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO } from '@/components/dc/tokens'
import { useSettings } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

import { SettingsShell } from './SettingsShell'

/**
 * Settings in the design's chrome.
 *
 * The 11 section forms underneath are the existing, API-wired ones — they own
 * the real PATCH flow, so only the surrounding chrome and the section rail were
 * restyled. Rebuilding the forms would have meant re-implementing verified
 * saves for no visual gain.
 */
export function DcSettings() {
  const router = useRouter()
  const { api } = useAdminConnection(30_000)
  const settings = useSettings()
  const pageStatus = dcPageStatus([settings], api.pulse)
  const online = api.pulse === 'online'

  return (
    <DcScreenProvider screen="settings" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPageHead
        crumbGroup="System"
        title="Settings"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          settings.isFetching
            ? 'syncing…'
            : api.latencyMs != null
              ? `GET /admin/settings · ${api.latencyMs}ms`
              : 'GET /admin/settings'
        }
        syncing={settings.isFetching}
        onSync={() => void settings.refetch()}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          padding: '9px 14px',
          borderRadius: 11,
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          backgroundImage: 'var(--card-sheen)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            font: `600 10.5px/1 ${FONT}`,
            letterSpacing: '.08em',
            color:
              pageStatus.label === 'LIVE'
                ? 'var(--ok)'
                : pageStatus.label === 'DEGRADED'
                  ? 'var(--warn)'
                  : 'var(--bad)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              background: 'currentColor',
              animation: 'dc-pulse 2.4s ease-in-out infinite',
            }}
          />
          {pageStatus.label}
        </span>
        <span style={{ width: 1, height: 16, background: 'var(--line)' }} />
        <span style={{ font: `400 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>/admin/settings</span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            font: `500 11.5px/1 ${FONT}`,
            color: 'var(--ink-3)',
          }}
        >
          <DcIcon name="icon-shield-check" size={13} color={online ? 'var(--ok)' : 'var(--warn)'} />
          Writes are verified PATCH only
        </span>
      </div>

      <div className="dc-settings-host">
        <SettingsShell />
      </div>
    </DcScreenProvider>
  )
}

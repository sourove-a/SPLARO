'use client'

import { useRouter } from 'next/navigation'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { dcConnectionChip } from '@/components/dc/page-status'
import { FONT, MONO } from '@/components/dc/tokens'
import { ExportCenterPanelLive } from '@/components/modules/EnterpriseLivePanels'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

/** Export Center — DC chrome + live CSV export (not mock SCREENS rows). */
export function DcExports() {
  const router = useRouter()
  const { api } = useAdminConnection(30_000)
  const pageStatus = dcConnectionChip(api.pulse) ?? { label: 'LIVE' as const, tone: 'ok' as const }

  return (
    <DcScreenProvider screen="exports" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcPageHead
        crumbGroup="System"
        title="Export Center"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          api.latencyMs != null
            ? `GET datasets · ${api.latencyMs}ms`
            : 'GET orders / customers / products'
        }
        onSync={() => router.refresh()}
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
          marginBottom: 4,
        }}
      >
        <span style={{ font: `600 10.5px/1 ${FONT}`, letterSpacing: '.08em', color: 'var(--ink-3)' }}>
          LIVE EXPORT
        </span>
        <span style={{ width: 1, height: 16, background: 'var(--line)' }} />
        <span style={{ font: `400 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
          CSV · max 500 rows · verified API only
        </span>
      </div>
      <div className="dc-detail-host dc-exports-host">
        <ExportCenterPanelLive />
      </div>
    </DcScreenProvider>
  )
}

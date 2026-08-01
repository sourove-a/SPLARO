'use client'

import { useRouter } from 'next/navigation'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { dcConnectionChip } from '@/components/dc/page-status'
import { DcExportCenterBody } from '@/components/dc/screens/DcExportCenterBody'
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
      <div className="dc-detail-host dc-exports-host">
        <DcExportCenterBody />
      </div>
    </DcScreenProvider>
  )
}

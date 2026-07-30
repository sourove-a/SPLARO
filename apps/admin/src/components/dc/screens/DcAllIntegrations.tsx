'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcPageHead, type DcModuleState } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { AllIntegrationsPanel } from '@/components/modules/IntegrationPanels'
import { useIntegrationsCatalog } from '@/lib/api/integration-hooks'
import { integrationSetupPath } from '@/lib/integrations/routes'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

function relativeHealth(value: string | null) {
  if (!value) return 'no health check yet'
  const minutes = Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 60_000)
  if (minutes < 1) return 'health checked now'
  if (minutes < 60) return `health checked ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `health checked ${hours}h ago`
  return `health checked ${Math.floor(hours / 24)}d ago`
}

export function DcAllIntegrations() {
  const router = useRouter()

  return (
    <DcScreenProvider screen="integrations" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcAllIntegrationsBody />
    </DcScreenProvider>
  )
}

function DcAllIntegrationsBody() {
  const router = useRouter()
  const catalog = useIntegrationsCatalog()
  const { api } = useAdminConnection(25_000)
  const integrations = useMemo(() => catalog.data?.integrations ?? [], [catalog.data])
  const firstSetup = integrations.find((item) => !item.connected) ?? integrations[0]
  const lastHealthAt =
    integrations
      .map((item) => item.lastTestedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null
  const pageStatus = dcPageStatus([catalog], api.pulse)
  const [previewState, setPreviewState] = useState<DcModuleState>('live')

  return (
    <>
      <DcPageHead
        crumbGroup="Integrations"
        title="All Integrations"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          catalog.isFetching
            ? 'checking every connection…'
            : relativeHealth(lastHealthAt)
        }
        syncing={catalog.isFetching}
        onSync={() => void catalog.refetch()}
        state={previewState}
        onStateChange={setPreviewState}
        actions={[
          {
            label: 'Add integration',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () =>
              router.push(
                firstSetup
                  ? integrationSetupPath(firstSetup.provider, firstSetup.connected)
                  : '/dashboard/settings',
              ),
          },
        ]}
      />
      <AllIntegrationsPanel embedded previewState={previewState} />
    </>
  )
}

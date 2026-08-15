'use client'

import { useRouter } from 'next/navigation'

import { AiCommandCenterPanel } from '@/components/agent/AiCommandCenterPanel'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcConnectionChip } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

import { useAdminUiStore } from '@/store/uiStore'

export function DcAiCommandBrain() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="ai" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcAiCommandBrainBody />
    </DcScreenProvider>
  )
}

function DcAiCommandBrainBody() {
  const openAgentChat = useAdminUiStore((s) => s.openAgentChat)
  const { api } = useAdminConnection(25_000)
  const connection = dcConnectionChip(api.pulse)

  return (
    <>
      <DcPageHead
        crumbGroup="Intelligence"
        title="AI Command Brain"
        statusLabel={connection?.label ?? 'BETA'}
        statusTone={connection?.tone ?? 'vio'}
        syncLabel="model controls · confirmation gated"
        actions={[
          {
            label: 'Open Chat',
            icon: 'icon-message-square',
            variant: 'primary',
            onClick: () => openAgentChat(),
          },
          {
            label: 'Models & Keys',
            icon: 'icon-cpu',
            onClick: () =>
              document.getElementById('ai-models')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          },
          {
            label: 'Guardrails',
            icon: 'icon-shield',
            onClick: () =>
              document.getElementById('ai-guardrails')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          },
          {
            label: 'MCP link',
            icon: 'icon-key-round',
            onClick: () =>
              document.getElementById('mcp-link-token')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          },
        ]}
      />
      <AiCommandCenterPanel embedded />
    </>
  )
}

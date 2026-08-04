'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAdminUiStore } from '@/store/uiStore'
import { fetchAgentStatus } from '@/lib/api/agent'
import { useFeatureEnabled } from '@/lib/feature-flags'

const AgentChatPanel = dynamic(
  () => import('@/components/agent/AgentChatPanel').then((m) => m.AgentChatPanel),
  { ssr: false },
)

const AgentChatFab = dynamic(
  () => import('@/components/agent/AgentChatPanel').then((m) => m.AgentChatFab),
  { ssr: false },
)

/**
 * @param hideFab - suppress the built-in launcher when the surrounding shell
 *   already renders one (the DC shell's "Ask SPLARO" button).
 */
export function AgentShell({ hideFab = false }: { hideFab?: boolean } = {}) {
  const aiEnabled = useFeatureEnabled('ai')
  const pathname = usePathname()
  const onAiSetupPage = pathname === '/dashboard/ai-agent'
  const open = useAdminUiStore((s) => s.agentChatOpen)
  const seed = useAdminUiStore((s) => s.agentChatSeed)
  const context = useAdminUiStore((s) => s.agentChatContext)
  const setOpen = useAdminUiStore((s) => s.setAgentChatOpen)
  const setSeed = useAdminUiStore((s) => s.setAgentChatSeed)
  const [online, setOnline] = useState(false)

  const handleClose = useCallback(() => setOpen(false), [setOpen])
  const handleSeedConsumed = useCallback(() => setSeed(null), [setSeed])

  useEffect(() => {
    if (!aiEnabled) {
      setOpen(false)
      return
    }
    const probe = () =>
      fetchAgentStatus()
        .then((s) => setOnline(s.activeModelReady))
        .catch(() => setOnline(false))

    probe()
    // Each status call runs ensureAgentConfigRow + SELECT 1 + a cost aggregate,
    // so only keep the 30s poll alive while the panel is actually open.
    if (!open) return
    const timer = setInterval(probe, 30_000)
    return () => clearInterval(timer)
  }, [aiEnabled, open, setOpen])

  if (!aiEnabled) return null

  return (
    <>
      {!hideFab && !open && !onAiSetupPage ? (
        <AgentChatFab onClick={() => setOpen(true)} online={online} />
      ) : null}
      <AgentChatPanel
        open={open}
        onClose={handleClose}
        seedMessage={seed}
        {...(context ? { context } : {})}
        onSeedConsumed={handleSeedConsumed}
        setupPage={onAiSetupPage}
      />
    </>
  )
}

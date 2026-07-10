'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { useAdminUiStore } from '@/store/uiStore'
import { fetchAgentStatus } from '@/lib/api/agent'

const AgentChatPanel = dynamic(
  () => import('@/components/agent/AgentChatPanel').then((m) => m.AgentChatPanel),
  { ssr: false },
)

const AgentChatFab = dynamic(
  () => import('@/components/agent/AgentChatPanel').then((m) => m.AgentChatFab),
  { ssr: false },
)

export function AgentShell() {
  const open = useAdminUiStore((s) => s.agentChatOpen)
  const seed = useAdminUiStore((s) => s.agentChatSeed)
  const context = useAdminUiStore((s) => s.agentChatContext)
  const setOpen = useAdminUiStore((s) => s.setAgentChatOpen)
  const setSeed = useAdminUiStore((s) => s.setAgentChatSeed)
  const [online, setOnline] = useState(false)

  const handleClose = useCallback(() => setOpen(false), [setOpen])
  const handleSeedConsumed = useCallback(() => setSeed(null), [setSeed])

  useEffect(() => {
    fetchAgentStatus()
      .then((s) => setOnline(s.activeModelReady))
      .catch(() => setOnline(false))
    const timer = setInterval(() => {
      fetchAgentStatus()
        .then((s) => setOnline(s.activeModelReady))
        .catch(() => setOnline(false))
    }, 30_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      {!open ? <AgentChatFab onClick={() => setOpen(true)} online={online} /> : null}
      <AgentChatPanel
        open={open}
        onClose={handleClose}
        seedMessage={seed}
        {...(context ? { context } : {})}
        onSeedConsumed={handleSeedConsumed}
      />
    </>
  )
}

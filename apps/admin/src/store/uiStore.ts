'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminUiStore {
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  commandPaletteOpen: boolean
  intelligencePanelOpen: boolean
  agentChatOpen: boolean
  agentChatSeed: string | null
  agentChatContext: string | null
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void
  setMobileSidebarOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setIntelligencePanelOpen: (open: boolean) => void
  setAgentChatOpen: (open: boolean) => void
  openAgentChat: (seed?: string, context?: string) => void
  setAgentChatSeed: (seed: string | null) => void
}

export const useAdminUiStore = create<AdminUiStore>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      commandPaletteOpen: false,
      intelligencePanelOpen: true,
      agentChatOpen: false,
      agentChatSeed: null,
      agentChatContext: null,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebarCollapsed: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setIntelligencePanelOpen: (open) => set({ intelligencePanelOpen: open }),
      setAgentChatOpen: (open) => set({ agentChatOpen: open }),
      setAgentChatSeed: (seed) => set({ agentChatSeed: seed }),
      openAgentChat: (seed, context) =>
        set({ agentChatOpen: true, agentChatSeed: seed ?? null, agentChatContext: context ?? null }),
    }),
    {
      name: 'splaro-admin-ui',
      skipHydration: true,
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        intelligencePanelOpen: state.intelligencePanelOpen,
      }),
    },
  ),
)

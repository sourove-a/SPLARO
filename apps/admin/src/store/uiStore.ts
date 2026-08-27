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
  notificationsOpen: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void
  setMobileSidebarOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setIntelligencePanelOpen: (open: boolean) => void
  setAgentChatOpen: (open: boolean) => void
  openAgentChat: (seed?: string, context?: string) => void
  setAgentChatSeed: (seed: string | null) => void
  setNotificationsOpen: (open: boolean) => void
  toggleNotifications: () => void
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
      notificationsOpen: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebarCollapsed: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setIntelligencePanelOpen: (open) => set({ intelligencePanelOpen: open }),
      // The assistant and the notification tray both float over the top-right
      // corner, so they must never be open together. Both are set here rather
      // than in the components: the chat opens from row actions and quick
      // commands too, and each of those would otherwise leave the tray behind.
      setAgentChatOpen: (open) =>
        set(open ? { agentChatOpen: true, notificationsOpen: false } : { agentChatOpen: false }),
      setAgentChatSeed: (seed) => set({ agentChatSeed: seed }),
      openAgentChat: (seed, context) =>
        set({
          agentChatOpen: true,
          notificationsOpen: false,
          agentChatSeed: seed ?? null,
          agentChatContext: context ?? null,
        }),
      setNotificationsOpen: (open) =>
        set(open ? { notificationsOpen: true, agentChatOpen: false } : { notificationsOpen: false }),
      toggleNotifications: () =>
        set(
          get().notificationsOpen
            ? { notificationsOpen: false }
            : { notificationsOpen: true, agentChatOpen: false },
        ),
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

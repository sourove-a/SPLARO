'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id?: string
  name: string
  email: string
  phone: string
}

interface AuthState {
  user: AuthUser | null
  _hydrated: boolean
  setHydrated: () => void
  setUser: (user: AuthUser | null) => void
  signIn: (user: AuthUser) => void
  signUp: (user: AuthUser) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      _hydrated: false,
      setHydrated: () => set({ _hydrated: true }),
      setUser: (user) => set({ user }),
      signIn: (user) => set({ user }),
      signUp: (user) => set({ user }),
      signOut: async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        set({ user: null })
      },
    }),
    {
      name: 'splaro-auth',
      skipHydration: true,
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated()
      },
    },
  ),
)

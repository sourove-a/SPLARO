'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'

export interface AuthUser {
  id?: string
  name: string
  email: string
  phone: string
  avatar?: string | null
  phoneVerified?: boolean
  emailVerified?: boolean
  loyaltyTier?: string
  needsPhone?: boolean
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
        // Clear this user's cart/wishlist and cart session so the next login
        // on this device can never merge the previous user's data into their
        // account.
        useCartStore.getState().clearCart()
        useWishlistStore.getState().clearWishlist()
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('splaro-cart-session')
        }
      },
    }),
    {
      name: 'splaro-auth',
      skipHydration: true,
      partialize: (state) => ({ user: state.user }),
    },
  ),
)

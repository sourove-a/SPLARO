import { create } from 'zustand'

interface UiStore {
  isMobileMenuOpen: boolean
  isSearchOpen: boolean
  isCartOpen: boolean
  /** Depth lock for modals/dialogs that must freeze Lenis + hide mobile dock. */
  scrollLockCount: number
  setMobileMenuOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  setCartOpen: (open: boolean) => void
  acquireScrollLock: () => void
  releaseScrollLock: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  isMobileMenuOpen: false,
  isSearchOpen: false,
  isCartOpen: false,
  scrollLockCount: 0,

  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  setCartOpen: (open) => set({ isCartOpen: open }),
  acquireScrollLock: () =>
    set((state) => ({ scrollLockCount: state.scrollLockCount + 1 })),
  releaseScrollLock: () =>
    set((state) => ({
      scrollLockCount: Math.max(0, state.scrollLockCount - 1),
    })),
}))

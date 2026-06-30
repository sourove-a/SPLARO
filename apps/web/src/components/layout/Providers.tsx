'use client'

import { type ReactNode } from 'react'
import { SessionHydrator } from '@/components/auth/SessionHydrator'
import { CartSyncHydrator } from '@/components/cart/CartSyncHydrator'
import { PersistHydrator } from '@/components/layout/PersistHydrator'
import { CssHealthGuard } from '@/components/layout/CssHealthGuard'
import { FooterEarthPreloader } from '@/components/earth/FooterEarthPreloader'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      <CssHealthGuard />
      <FooterEarthPreloader />
      <PersistHydrator />
      <SessionHydrator />
      <CartSyncHydrator />
      {children}
    </>
  )
}

'use client'

import { type ReactNode } from 'react'
import { MotionProvider } from '@/components/motion/MotionProvider'
import { SessionHydrator } from '@/components/auth/SessionHydrator'
import { CartSyncHydrator } from '@/components/cart/CartSyncHydrator'
import { PersistHydrator } from '@/components/layout/PersistHydrator'
import { CssHealthGuard } from '@/components/layout/CssHealthGuard'
import { ChunkReloadGuard } from '@/components/layout/ChunkReloadGuard'
import { FooterEarthPreloader } from '@/components/earth/FooterEarthPreloader'
import { GlobalHorizontalWheelScroll, GlobalPointerSafety } from '@/components/layout/GlobalDeviceUx'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <GlobalPointerSafety />
      <GlobalHorizontalWheelScroll />
      <CssHealthGuard />
      <ChunkReloadGuard />
      <FooterEarthPreloader />
      <PersistHydrator />
      <SessionHydrator />
      <CartSyncHydrator />
      {children}
    </MotionProvider>
  )
}

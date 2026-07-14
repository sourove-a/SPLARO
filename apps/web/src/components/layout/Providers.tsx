'use client'

import { type ReactNode } from 'react'
import { MotionProvider } from '@/components/motion/MotionProvider'
import { SessionHydrator } from '@/components/auth/SessionHydrator'
import { CartSyncHydrator } from '@/components/cart/CartSyncHydrator'
import { PersistHydrator } from '@/components/layout/PersistHydrator'
import { CssHealthGuard } from '@/components/layout/CssHealthGuard'
import { ChunkReloadGuard } from '@/components/layout/ChunkReloadGuard'
import { GlobalHorizontalWheelScroll, GlobalPointerSafety, DesktopPerfParity, OverlayScrollLockAttr } from '@/components/layout/GlobalDeviceUx'
import { MotionNavClickGate } from '@/hooks/useMotionReady'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <MotionNavClickGate />
      <DesktopPerfParity />
      <OverlayScrollLockAttr />
      <GlobalPointerSafety />
      <GlobalHorizontalWheelScroll />
      <CssHealthGuard />
      <ChunkReloadGuard />
      <PersistHydrator />
      <SessionHydrator />
      <CartSyncHydrator />
      {children}
    </MotionProvider>
  )
}

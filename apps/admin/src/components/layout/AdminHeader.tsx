'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  ChevronDown,
  LogOut,
  Moon,
  Settings,
  Sun,
  UserRound,
  Zap,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { AdminHeaderSearch } from '@/components/layout/AdminHeaderSearch'
import { AdminApiStatus } from '@/components/layout/AdminApiStatus'
import { NotificationDropdown } from '@/components/layout/NotificationDropdown'
import { MessagesDropdown } from '@/components/layout/MessagesDropdown'
import { markAdminLinkNavigation } from '@/lib/navigation/client-nav'
import { clearAdminApiToken } from '@/lib/auth/api-token'
import { useAdminSession } from '@/lib/api/hooks'
import { SplaroAdminLogo } from '@/components/brand/SplaroAdminLogo'

export function AdminHeader() {
  const [quickOpen, setQuickOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { setTheme, resolvedTheme } = useTheme()
  const { data: sessionUser } = useAdminSession()
  const user = sessionUser
    ? { name: sessionUser.name, email: sessionUser.email, role: sessionUser.role }
    : { name: 'Super Admin', email: 'splaro.bd@gmail.com', role: 'admin' }

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      <header className="admin-header admin-glass-panel admin-glass-panel--header mx-4 mb-0 flex items-center gap-3 px-4">
        <span className="admin-glass-panel__surface" aria-hidden="true" />
        <span className="admin-glass-panel__sheen" aria-hidden="true" />
        <div className="admin-glass-panel__body relative z-[1] flex w-full min-w-0 items-center gap-3">
        <Link href="/dashboard" className="shrink-0 lg:hidden" aria-label="SPLARO Admin home">
          <SplaroAdminLogo variant="mark" className="h-8 w-8" />
        </Link>
        <AdminHeaderSearch />

        <div className="flex items-center gap-2">
          <AdminApiStatus />

          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="admin-header-chip"
            aria-label="Toggle theme"
            title="Toggle light / dark"
            suppressHydrationWarning
          >
            <span suppressHydrationWarning>
              {mounted && resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={2} />
              )}
            </span>
          </button>

          <NotificationDropdown />
          <MessagesDropdown />

          <div className="relative">
            <button
              type="button"
              onClick={() => setQuickOpen((open) => !open)}
              className="admin-header-chip"
              aria-label="Quick Actions"
              title="Quick Actions"
              aria-expanded={quickOpen}
            >
              <Zap className="h-4 w-4" strokeWidth={2} />
            </button>
            <AnimatePresence>
              {quickOpen ? (
                <>
                  <button
                    type="button"
                    aria-label="Close quick actions"
                    className="fixed inset-0 z-[240] cursor-default"
                    onClick={() => setQuickOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="admin-header-popover absolute right-0 top-[calc(100%+0.5rem)] z-[250] w-56 overflow-hidden rounded-[20px] p-2 backdrop-blur-xl"
                  >
                    {(
                      [
                        ['New Order', '/dashboard/orders/new'],
                        ['Add Product', '/dashboard/products/new'],
                        ['Daily Closing', '/dashboard/finance/daily-closing'],
                        ['AI Generator', '/dashboard/ai-product-generator'],
                      ] as const
                    ).map(([label, href]) => (
                      <Link
                        key={href}
                        href={href}
                        className="block rounded-2xl px-3 py-2.5 text-sm font-semibold text-[var(--admin-text)] hover:bg-[var(--admin-surface-hover)]"
                        onClick={() => {
                          setQuickOpen(false)
                          markAdminLinkNavigation(href)
                        }}
                      >
                        {label}
                      </Link>
                    ))}
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              className="admin-profile-pill"
            >
              <div className="admin-profile-pill__avatar admin-profile-pill__logo">
                <SplaroAdminLogo variant="avatar" />
              </div>
              <div className="hidden text-left md:block">
                <p className="text-xs font-black text-[var(--admin-text)]">{user.name}</p>
                <p className="text-[10px] font-semibold text-[var(--admin-text-secondary)]">{user.email}</p>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 text-[var(--admin-text-secondary)] md:block" />
            </button>

            <AnimatePresence>
              {profileOpen ? (
                <>
                  <button
                    type="button"
                    aria-label="Close profile menu"
                    className="fixed inset-0 z-[250] cursor-default bg-black/5 backdrop-blur-[1px]"
                    onClick={() => setProfileOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="admin-header-popover fixed right-4 top-[5.25rem] z-[300] w-56 overflow-hidden rounded-[20px] p-2 backdrop-blur-xl sm:right-6"
                  >
                  <Link
                    href="/dashboard/admin-users"
                    scroll={false}
                    prefetch
                    className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-[var(--admin-text)] hover:bg-[var(--admin-surface-hover)] active:scale-[0.99]"
                    onClick={() => {
                      setProfileOpen(false)
                      markAdminLinkNavigation('/dashboard/admin-users')
                    }}
                  >
                    <UserRound className="h-4 w-4" />
                    Profile
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    scroll={false}
                    prefetch
                    className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-[var(--admin-text)] hover:bg-[var(--admin-surface-hover)] active:scale-[0.99]"
                    onClick={() => {
                      setProfileOpen(false)
                      markAdminLinkNavigation('/dashboard/settings')
                    }}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold text-[var(--admin-danger)] hover:bg-red-500/10"
                    onClick={async () => {
                      setProfileOpen(false)
                      await fetch('/api/auth/logout', { method: 'POST' })
                      clearAdminApiToken()
                      window.location.href = '/login'
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </motion.div>
                </>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
        </div>
      </header>
    </>
  )
}

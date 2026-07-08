'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Package,
  ShoppingBag,
  Sparkles,
  Upload,
  Wallet,
  Zap,
} from 'lucide-react'
import { markAdminLinkNavigation } from '@/lib/navigation/client-nav'
import { BACKEND_NOT_CONNECTED_TITLE } from '@/lib/admin/feedback'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { cn } from '@/lib/utils/cn'

const STORAGE_KEY = 'splaro-admin-intel-collapsed'

const QUICK_ACTIONS = [
  { label: 'New Order', short: 'Order', href: '/dashboard/orders/new', icon: ShoppingBag },
  { label: 'Add Product', short: 'Product', href: '/dashboard/products/new', icon: Package },
  {
    label: 'Upload CSV',
    short: 'CSV',
    icon: Upload,
    disabled: true,
    disabledTitle: `${BACKEND_NOT_CONNECTED_TITLE} Product CSV import API is not wired yet.`,
  },
  { label: 'Partner Tx', short: 'Partner', href: '/dashboard/finance/partner-accounts', icon: Wallet },
  { label: 'Daily Close', short: 'Close', href: '/dashboard/finance/daily-closing', icon: FileSpreadsheet },
  { label: 'AI Generator', short: 'AI', href: '/dashboard/ai-product-generator', icon: Bot },
] as const

export function IntelligencePanel() {
  const [collapsed, setCollapsed] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      if (next) setActivityOpen(false)
      return next
    })
  }

  return (
    <aside
      className={cn(
        'admin-intel admin-intel-rail relative m-4 ml-2 hidden h-[calc(100vh-2rem)] min-h-0 shrink-0 lg:flex lg:flex-col',
        'transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        collapsed
          ? 'admin-intel--collapsed w-[var(--admin-intel-collapsed)]'
          : 'admin-intel--expanded w-[var(--admin-intel)]',
      )}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expand quick actions' : 'Collapse quick actions'}
        className="admin-intel__toggle"
      >
        {collapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      <div className="admin-intel__surface flex h-full min-h-0 flex-col overflow-hidden">
        <div className={cn('admin-intel__head', collapsed && 'admin-intel__head--compact')}>
          <span className="admin-intel__icon-ring">
            <Zap className="h-3.5 w-3.5 text-[var(--admin-text-secondary)]" strokeWidth={2} />
          </span>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black tracking-tight text-[var(--admin-text)]">Quick Actions</p>
              <p className="truncate text-[9px] font-semibold text-[var(--admin-text-muted)]">Ops shortcuts</p>
            </div>
          ) : null}
        </div>

        <div className={cn('admin-intel__actions', collapsed && 'admin-intel__actions--rail')}>
          {QUICK_ACTIONS.map((action, index) => {
            const Icon = action.icon
            const key = 'href' in action && action.href ? action.href : action.label
            if ('disabled' in action && action.disabled) {
              return (
                <motion.div
                  key={key}
                  initial={false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: collapsed ? 0 : index * 0.03, duration: 0.22 }}
                >
                  <div
                    title={'disabledTitle' in action ? action.disabledTitle : BACKEND_NOT_CONNECTED_TITLE}
                    className={cn(
                      'admin-intel__action group cursor-not-allowed opacity-45',
                      collapsed && 'admin-intel__action--icon',
                    )}
                    aria-disabled
                  >
                    <span className="admin-intel__action-icon">
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                    {!collapsed ? (
                      <span className="truncate text-[10px] font-bold leading-tight text-[var(--admin-text-muted)]">
                        {action.label}
                      </span>
                    ) : null}
                  </div>
                </motion.div>
              )
            }

            const href = 'href' in action ? action.href! : '/dashboard'
            return (
              <motion.div
                key={key}
                initial={false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: collapsed ? 0 : index * 0.03, duration: 0.22 }}
              >
                <Link
                  href={href}
                  scroll={false}
                  prefetch
                  title={action.label}
                  onClick={() => markAdminLinkNavigation(href)}
                  className={cn(
                    'admin-intel__action group',
                    collapsed && 'admin-intel__action--icon',
                  )}
                >
                  <span className="admin-intel__action-icon">
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  {!collapsed ? (
                    <span className="truncate text-[10px] font-bold leading-tight text-[var(--admin-text)]">
                      {action.label}
                    </span>
                  ) : null}
                </Link>
              </motion.div>
            )
          })}
        </div>

        {!collapsed ? (
          <div className="admin-intel__activity mt-auto min-h-0 flex-1 overflow-hidden">
            <div className="admin-intel__activity-head">
              <Sparkles className="h-3 w-3 text-[var(--admin-text-secondary)]" />
              <p className="text-[10px] font-black text-[var(--admin-text)]">Recent Activity</p>
            </div>
            <div className="max-h-[min(280px,36vh)] overflow-y-auto overscroll-y-contain">
              <RecentActivities period="7 Days" embedded />
            </div>
          </div>
        ) : (
          <div className="mt-auto border-t border-white/40 p-1.5">
            <button
              type="button"
              title="Recent activity"
              onClick={() => setActivityOpen((open) => !open)}
              className={cn(
                'admin-intel__action admin-intel__action--icon w-full',
                activityOpen && 'admin-intel__action--active',
              )}
            >
              <span className="admin-intel__action-icon">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
              </span>
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {collapsed && activityOpen ? (
          <motion.div
            initial={{ opacity: 0, x: 12, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="admin-intel__flyout"
          >
            <div className="admin-intel__activity-head border-b border-[rgba(17,17,17,0.06)] px-3 py-2.5">
              <Sparkles className="h-3 w-3 text-[var(--admin-text-secondary)]" />
              <p className="text-[10px] font-black text-[var(--admin-text)]">Recent Activity</p>
              <button
                type="button"
                onClick={() => setActivityOpen(false)}
                className="ml-auto rounded-md px-1.5 py-0.5 text-[9px] font-bold text-[var(--admin-text-muted)] hover:bg-black/5"
              >
                Close
              </button>
            </div>
            <div className="max-h-[min(360px,50vh)] overflow-y-auto">
              <RecentActivities period="7 Days" embedded />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </aside>
  )
}

'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Bot,
  FileSpreadsheet,
  Package,
  ShoppingBag,
  Upload,
  Wallet,
} from 'lucide-react'
import { markAdminLinkNavigation } from '@/lib/navigation/client-nav'
import { BACKEND_NOT_CONNECTED_TITLE } from '@/lib/admin/feedback'
import { cn } from '@/lib/utils/cn'

type QuickTone = 'violet' | 'violet-soft' | 'slate' | 'ink'

type QuickAction = {
  label: string
  href?: string
  icon: typeof ShoppingBag
  tone: QuickTone
  disabled?: boolean
  disabledTitle?: string
}

const ACTIONS: QuickAction[] = [
  { label: 'Create New Order', href: '/dashboard/orders/new', icon: ShoppingBag, tone: 'violet' },
  { label: 'Add New Product', href: '/dashboard/products/new', icon: Package, tone: 'violet-soft' },
  { label: 'Upload Product CSV', href: '/dashboard/bulk', icon: Upload, tone: 'slate' },
  { label: 'Partner Transaction', href: '/dashboard/finance/partner-accounts', icon: Wallet, tone: 'ink' },
  { label: 'Daily Closing', href: '/dashboard/finance/daily-closing', icon: FileSpreadsheet, tone: 'slate' },
  { label: 'AI Product Generator', href: '/dashboard/ai-agent', icon: Bot, tone: 'violet' },
]

export function QuickActions({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <div className={embedded ? '' : 'admin-module-card'}>
      {embedded ? null : (
        <div className="mb-5">
          <h3 className="admin-module-card__title">Quick Actions</h3>
          <p className="admin-module-card__subtitle">Luxury commerce shortcuts — live routes only</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
        {ACTIONS.map((action) => {
          const Icon = action.icon
          if (action.disabled || !action.href) {
            return (
              <div
                key={action.label}
                title={action.disabledTitle ?? BACKEND_NOT_CONNECTED_TITLE}
                className={cn(
                  'admin-quick-tile cursor-not-allowed opacity-50',
                  'pointer-events-none select-none',
                )}
                aria-disabled
              >
                <div className={cn('admin-quick-tile__icon', `admin-quick-tile__icon--${action.tone}`)}>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <span className="text-[11px] font-semibold leading-tight text-[var(--admin-text-muted)]">
                  {action.label}
                </span>
              </div>
            )
          }

          return (
            <motion.div key={action.label} initial={false} animate={{ opacity: 1, scale: 1 }}>
              <Link
                href={action.href}
                scroll={false}
                prefetch
                onClick={() => markAdminLinkNavigation(action.href!)}
                className="admin-quick-tile active:scale-[0.98]"
              >
                <div className={cn('admin-quick-tile__icon', `admin-quick-tile__icon--${action.tone}`)}>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <span className="text-[11px] font-semibold leading-tight text-[var(--admin-text)]">
                  {action.label}
                </span>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

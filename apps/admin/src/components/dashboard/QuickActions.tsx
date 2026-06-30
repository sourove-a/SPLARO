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

const ACTIONS = [
  { label: 'Create New Order', href: '/dashboard/orders/new', icon: ShoppingBag },
  { label: 'Add New Product', href: '/dashboard/products/new', icon: Package },
  { label: 'Upload Product CSV', href: '/dashboard/products', icon: Upload },
  { label: 'Partner Transaction', href: '/dashboard/finance/partner-accounts', icon: Wallet },
  { label: 'Daily Closing', href: '/dashboard/finance/daily-closing', icon: FileSpreadsheet },
  { label: 'AI Product Generator', href: '/dashboard/ai-product-generator', icon: Bot },
]

export function QuickActions() {
  return (
    <div className="admin-module-card">
      <div className="mb-5">
        <h3 className="admin-module-card__title">Quick Actions</h3>
        <p className="admin-module-card__subtitle">Luxury commerce shortcuts</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <motion.div
              key={action.label}
              initial={false}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Link
                href={action.href}
                scroll={false}
                prefetch
                onClick={() => markAdminLinkNavigation(action.href)}
                className="admin-quick-tile active:scale-[0.98]"
              >
                <div className="admin-quick-tile__icon">
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <span className="text-[11px] font-semibold leading-tight text-[var(--admin-text)]">{action.label}</span>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

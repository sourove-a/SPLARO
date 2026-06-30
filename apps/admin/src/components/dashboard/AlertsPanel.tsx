'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, Package, CreditCard, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { useOrders, useProducts } from '@/lib/api/hooks'
import { productStock } from '@/lib/api/products'

interface AlertItem {
  id: string
  label: string
  count: number
  href: string
  icon: React.ElementType
  severity: 'warning' | 'danger' | 'info'
}

const SEVERITY_STYLES = {
  warning: 'border-amber-200/60 bg-amber-50/80 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300',
  danger: 'border-red-200/60 bg-red-50/80 text-red-600 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300',
  info: 'border-[rgba(17,17,17,0.08)] bg-[#111111]/[0.02] text-[#6B6B6B] dark:border-white/10 dark:bg-white/5 dark:text-white/60',
}

export function AlertsPanel({ codRisk, failedPayments }: { codRisk?: number; failedPayments?: number }) {
  const { data: ordersData } = useOrders({ limit: 100 })
  const { data: productsData } = useProducts({ limit: 100 })

  const pendingOrders = ordersData?.orders?.filter((o) => o.status === 'PENDING').length ?? 0
  const lowStock =
    productsData?.products?.filter((p) => {
      const stock = productStock(p)
      return stock > 0 && stock <= 5
    }).length ?? 0

  const alerts: AlertItem[] = [
    ...(codRisk && codRisk > 0
      ? [{ id: 'cod', label: 'COD risk orders', count: codRisk, href: '/dashboard/orders', icon: AlertTriangle, severity: 'warning' as const }]
      : []),
    ...(pendingOrders > 0
      ? [{ id: 'pending', label: 'Orders pending review', count: pendingOrders, href: '/dashboard/orders', icon: AlertTriangle, severity: 'warning' as const }]
      : []),
    ...(lowStock > 0
      ? [{ id: 'stock', label: 'Low stock items', count: lowStock, href: '/dashboard/inventory', icon: Package, severity: 'warning' as const }]
      : []),
    ...(failedPayments && failedPayments > 0
      ? [{ id: 'payments', label: 'Failed payments', count: failedPayments, href: '/dashboard/transactions', icon: CreditCard, severity: 'danger' as const }]
      : []),
  ]

  return (
    <div className="admin-module-card !p-0 overflow-hidden">
      <div className="border-b border-[rgba(17,17,17,0.06)] px-5 py-4">
        <h3 className="text-sm font-black text-[var(--admin-text)]">Alerts & Notifications</h3>
        <p className="mt-0.5 text-xs font-semibold text-[var(--admin-text-secondary)]">Live only — no fake 24/6 counts</p>
      </div>

      <div className="space-y-2 p-4">
        {alerts.length === 0 ? (
          <p className="py-6 text-center text-sm font-semibold text-[var(--admin-text-secondary)]">
            All clear — no alerts right now.
          </p>
        ) : (
          alerts.map((alert, index) => {
            const Icon = alert.icon
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, duration: 0.3 }}
              >
                <Link
                  href={alert.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg border px-4 py-3 transition-all hover:shadow-sm',
                    SEVERITY_STYLES[alert.severity],
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/60 dark:bg-white/10">
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{alert.label}</p>
                    <p className="text-lg font-semibold leading-tight">{alert.count}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:opacity-70" />
                </Link>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}

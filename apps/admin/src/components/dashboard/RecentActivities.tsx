'use client'

import { motion } from 'framer-motion'
import {
  ShoppingBag,
  UserPlus,
  CreditCard,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useDashboardInsights } from '@/lib/api/hooks'
import { RelativeTime } from '@/components/ui/RelativeTime'

const ICON_MAP = {
  order: ShoppingBag,
  customer: UserPlus,
  payment: CreditCard,
  shipping: Truck,
}

const COLOR_MAP = {
  order: 'bg-[#5E7CFF]/15 text-[#5E7CFF]',
  customer: 'bg-blue-500/10 text-blue-600',
  payment: 'bg-emerald-500/10 text-emerald-600',
  shipping: 'bg-cyan-500/10 text-cyan-600',
}

export function RecentActivities({
  period = '30 Days',
  embedded = false,
}: {
  period?: string
  embedded?: boolean
}) {
  const { data, isLoading, isError } = useDashboardInsights(period)
  const activities = data?.recentActivities ?? []

  return (
    <div className={embedded ? '' : 'admin-module-card !p-0 overflow-hidden'}>
      {!embedded ? (
        <div className="border-b border-[rgba(17,17,17,0.06)] px-5 py-4">
          <h3 className="text-[0.9375rem] font-black tracking-tight text-[var(--admin-text)]">Recent Activities</h3>
          <p className="mt-0.5 text-[0.78rem] font-semibold text-[var(--admin-text-secondary)]">Live orders, customers & status updates</p>
        </div>
      ) : null}

      <div className={cn('max-h-[320px] overflow-y-auto', embedded ? 'px-2 py-2' : 'px-3 py-2')}>
        {isLoading ? (
          <p className="py-8 text-center text-xs text-[#6B6B6B]">Loading activity…</p>
        ) : isError ? (
          <p className="py-8 text-center text-xs text-amber-700">API offline — start backend on :4000</p>
        ) : activities.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#6B6B6B]">No store activity yet.</p>
        ) : (
          activities.map((activity, index) => {
            const Icon = ICON_MAP[activity.type]
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-[#111111]/[0.02]"
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    COLOR_MAP[activity.type],
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-[#111111]">{activity.message}</p>
                  <p className="mt-0.5 text-[10px] text-[#6B6B6B]">
                    <RelativeTime iso={activity.at} />
                  </p>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}

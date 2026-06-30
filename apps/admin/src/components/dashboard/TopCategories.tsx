'use client'

import { motion } from 'framer-motion'
import { FolderOpen } from 'lucide-react'
import { formatBDT } from '@/lib/utils/currency'
import { useDashboardInsights } from '@/lib/api/hooks'

export function TopCategories({ period = '30 Days' }: { period?: string }) {
  const { data, isLoading, isError } = useDashboardInsights(period)
  const categories = data?.topCategories ?? []

  return (
    <div className="admin-module-card !p-0 overflow-hidden">
      <div className="border-b border-[rgba(17,17,17,0.06)] px-5 py-4">
        <h3 className="text-[0.9375rem] font-black tracking-tight text-[var(--admin-text)]">Top Categories</h3>
        <p className="mt-0.5 text-[0.78rem] font-semibold text-[var(--admin-text-secondary)]">Live revenue from order items</p>
      </div>

      {isLoading ? (
        <p className="px-5 py-8 text-center text-xs text-[#6B6B6B]">Loading categories…</p>
      ) : isError ? (
        <p className="px-5 py-8 text-center text-xs text-amber-700">API offline — start backend on :4000</p>
      ) : categories.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs text-[#6B6B6B]">
          No category sales in this period yet.
        </p>
      ) : (
        <div className="divide-y divide-[rgba(17,17,17,0.04)]">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#111111]/[0.02]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[rgba(17,17,17,0.06)] bg-[#111111]/[0.03]">
                {category.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                ) : (
                  <FolderOpen className="h-4 w-4 text-[#6B6B6B]" strokeWidth={1.5} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#111111]">{category.name}</p>
                <p className="text-[10px] text-[#6B6B6B]">
                  {category.orders} orders · {category.share}% share
                </p>
              </div>
              <p className="shrink-0 text-xs font-semibold text-[#111111]">
                {formatBDT(category.revenue)}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

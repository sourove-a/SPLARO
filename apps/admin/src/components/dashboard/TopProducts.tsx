'use client'

import { motion } from 'framer-motion'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { formatBDT } from '@/lib/utils/currency'
import { useDashboardInsights } from '@/lib/api/hooks'

export function TopProducts({ period = '30 Days' }: { period?: string }) {
  const { data, isLoading, isError } = useDashboardInsights(period)
  const products = data?.topProducts ?? []

  return (
    <div className="admin-module-card !p-0 overflow-hidden">
      <div className="border-b border-[rgba(17,17,17,0.06)] px-5 py-4">
        <h3 className="text-[0.9375rem] font-black tracking-tight text-[var(--admin-text)]">Top Selling Products</h3>
        <p className="mt-0.5 text-[0.78rem] font-semibold text-[var(--admin-text-secondary)]">Ranked by live order revenue</p>
      </div>

      {isLoading ? (
        <p className="px-5 py-8 text-center text-xs text-[#6B6B6B]">Loading products…</p>
      ) : isError ? (
        <p className="px-5 py-8 text-center text-xs text-amber-700">API offline — start backend on :4000</p>
      ) : products.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs text-[#6B6B6B]">
          No product sales in this period yet.
        </p>
      ) : (
        <div className="divide-y divide-[rgba(17,17,17,0.04)]">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#111111]/[0.02]"
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  product.rank === 1
                    ? 'bg-[#5E7CFF]/20 text-[#5E7CFF]'
                    : 'bg-[#111111]/[0.04] text-[#6B6B6B]'
                }`}
              >
                {product.rank}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#111111]">{product.name}</p>
                <p className="text-[10px] text-[#6B6B6B]">
                  {product.sku} · {product.sold} sold
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold text-[#111111]">{formatBDT(product.revenue)}</p>
                {product.trend !== 0 ? (
                  <div
                    className={`mt-0.5 flex items-center justify-end gap-0.5 text-[10px] ${
                      product.trend >= 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {product.trend >= 0 ? (
                      <TrendingUp className="h-2.5 w-2.5" />
                    ) : (
                      <TrendingDown className="h-2.5 w-2.5" />
                    )}
                    {product.trend >= 0 ? '+' : ''}
                    {product.trend}%
                  </div>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

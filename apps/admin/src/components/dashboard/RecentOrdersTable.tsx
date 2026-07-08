'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { displayOrderCode } from '@splaro/config'
import { formatBDT } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'
import { useOrders } from '@/lib/api/hooks'
import { type ApiOrder } from '@/lib/api/orders'
import { RelativeTime } from '@/components/ui/RelativeTime'

function mapRow(order: ApiOrder) {
  return {
    id: order.id,
    invoiceNumber: displayOrderCode(order.invoiceNumber, order.id),
    customer: order.shippingName,
    amount: Number(order.total),
    status: order.status,
    createdAt: order.createdAt,
  }
}

export function RecentOrdersTable() {
  const { data, isLoading, isError } = useOrders({ limit: 6 })
  const rows = data?.orders?.length && !isError ? data.orders.map(mapRow) : []

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="admin-module-table-wrap overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-[rgba(17,17,17,0.06)] px-5 py-4">
        <div>
          <h3 className="text-sm font-black text-[#111111]">Recent Orders</h3>
          <p className="mt-0.5 text-xs font-semibold text-[#6B6B6B]">
            {isError ? 'Connect API on port 4000 for live orders' : 'Latest transactions from your store'}
          </p>
        </div>
        <Link href="/dashboard/orders" className="flex items-center gap-1 text-[11px] font-bold text-[#5E7CFF] hover:underline">
          View all <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
              <th className="text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="!py-4">
                      <div className="mx-auto h-3 w-3/4 animate-pulse rounded bg-black/5" />
                    </td>
                  </tr>
                ))
              : rows.length === 0
                ? (
                    <tr>
                      <td colSpan={5} className="!py-8 text-center text-xs font-semibold text-[#6B6B6B]">
                        No orders yet.
                      </td>
                    </tr>
                  )
                : rows.map((order) => (
                  <tr key={order.id} className="admin-table-row--hover">
                    <td>
                      <Link href={`/dashboard/orders/${order.invoiceNumber}`} className="font-mono text-xs font-black text-[#5E7CFF] hover:underline">
                        {order.invoiceNumber}
                      </Link>
                    </td>
                    <td className="font-semibold">{order.customer}</td>
                    <td className="font-black">{formatBDT(order.amount)}</td>
                    <td>
                      <span className={cn('admin-status capitalize', `admin-status--${order.status === 'DELIVERED' ? 'delivered' : order.status === 'PENDING' ? 'pending' : 'processing'}`)}>
                        {order.status.toLowerCase().replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="muted text-right text-xs"><RelativeTime iso={order.createdAt} /></td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

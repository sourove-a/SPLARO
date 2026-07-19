'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatBDT } from '@/lib/utils/currency'
import { useDashboardInsights } from '@/lib/api/hooks'

const COLORS = ['#111216', '#C8A97E', '#62646B', '#A7A8AD', '#E3D4BD']

type MixRow = { name: string; value: number; revenue: number }

function ChannelTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: MixRow }[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]!.payload
  return (
    <div className="rounded-lg border border-[rgba(17,17,17,0.08)] bg-[rgba(255,255,255,0.95)] px-3 py-2 shadow-lg backdrop-blur-xl">
      <p className="text-xs font-semibold text-[#111111]">{item.name}</p>
      <p className="text-xs text-[#6B6B6B]">{item.value}% · {formatBDT(item.revenue)}</p>
    </div>
  )
}

export function ChannelDonutChart({ period = '30 Days' }: { period?: string }) {
  const { data, isLoading, isError } = useDashboardInsights(period)
  const mix = data?.paymentMix ?? []
  const total = data?.paymentMixTotal ?? 0

  return (
    <div className="admin-module-card flex h-full flex-col">
      <div className="mb-4">
        <h3 className="admin-module-card__title">Revenue by Payment</h3>
        <p className="admin-module-card__subtitle">Live split from confirmed orders</p>
      </div>

      {isLoading ? (
        <p className="flex flex-1 items-center justify-center text-xs text-[#6B6B6B]">Loading…</p>
      ) : isError ? (
        <p className="flex flex-1 items-center justify-center text-xs text-amber-700">API offline</p>
      ) : mix.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-xs text-[#6B6B6B]">
          No paid orders in this period yet.
        </p>
      ) : (
        <>
          <div className="relative flex-1">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={mix}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth={2}
                >
                  {mix.map((row, index) => (
                    <Cell key={row.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChannelTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[10px] uppercase tracking-wider text-[#6B6B6B]">Total</p>
              <p className="text-sm font-semibold text-[#111111]">{formatBDT(total)}</p>
            </div>
          </div>

          <div className="mt-2 space-y-2">
            {mix.map((channel, i) => (
              <div key={channel.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-[#6B6B6B]">{channel.name}</span>
                </div>
                <span className="font-medium text-[#111111]">{channel.value}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

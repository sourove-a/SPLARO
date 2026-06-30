'use client'

import { useState } from 'react'
import {
  TrendingUp,
  Users,
  Package,
  Warehouse,
  Sparkles,
  DollarSign,
} from 'lucide-react'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { useExecutiveDashboard } from '@/lib/api/hooks'
import { askExecutiveAI } from '@/lib/api/commerce-os'
import { formatBDT } from '@/lib/format/currency'

export function ExecutiveDashboard() {
  const { data, isError, isLoading, refetch } = useExecutiveDashboard()
  const [aiQuestion, setAiQuestion] = useState("Today's revenue?")
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)

  if (isError) return <ApiOfflineBanner message="Executive API offline — start pnpm dev:api." />

  const kpis = data?.kpis

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Revenue (MTD)', value: isLoading ? '…' : formatBDT(kpis?.revenue ?? 0), icon: DollarSign },
          { label: 'Net Profit', value: isLoading ? '…' : formatBDT(kpis?.netProfit ?? 0), icon: TrendingUp },
          { label: 'Orders', value: isLoading ? '…' : String(kpis?.orders ?? 0), icon: Package },
          { label: 'Customers', value: isLoading ? '…' : String(kpis?.customers ?? 0), icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-[22px] border border-black/5 bg-white/60 p-5 backdrop-blur-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#6B6B6B]">
                {label}
              </span>
              <Icon className="h-4 w-4 text-[#5E7CFF]" />
            </div>
            <p className="text-2xl font-black text-[#111111]">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[22px] border border-black/5 bg-white/55 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#6B6B6B]">
            <Sparkles className="h-4 w-4 text-[#5E7CFF]" />
            AI Executive Insights
          </h3>
          {(data?.aiInsights ?? []).length === 0 ? (
            <p className="text-sm font-semibold text-[#6B6B6B]">Insights appear as order data accumulates.</p>
          ) : (
            <ul className="space-y-2">
              {(data?.aiInsights ?? []).map((item, i) => (
                <li
                  key={item.id ?? i}
                  className="rounded-[14px] border border-[#5E7CFF]/20 bg-[#5E7CFF]/8 px-3 py-2 text-sm font-semibold text-[#111111]"
                >
                  {item.insight}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[22px] border border-black/5 bg-white/55 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#6B6B6B]">
            <Warehouse className="h-4 w-4 text-[#5E7CFF]" />
            Partner Profit Share
          </h3>
          {(data?.partners ?? []).length === 0 ? (
            <p className="text-sm font-semibold text-[#6B6B6B]">No partner accounts configured.</p>
          ) : (
            <div className="space-y-2">
              {(data?.partners ?? []).map((p) => (
                <div key={p.name} className="flex justify-between text-sm font-semibold">
                  <span>{p.name}</span>
                  <span className="font-black text-[#5E7CFF]">{formatBDT(p.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-[22px] border border-black/5 bg-white/55 p-5">
        <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-[#6B6B6B]">
          Executive AI Chat
        </h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            className="flex-1 rounded-[14px] border border-black/5 bg-white/70 px-3 py-2 text-sm font-semibold outline-none focus:border-[#5E7CFF]/50"
          />
          <button
            type="button"
            onClick={() =>
              askExecutiveAI(aiQuestion)
                .then((r) => setAiAnswer(r.answer))
                .catch(() => setAiAnswer('AI chat requires API — check /ai/executive/chat endpoint.'))
            }
            className="rounded-[14px] bg-[#111111] px-4 py-2 text-xs font-black uppercase tracking-wider text-white"
          >
            Ask AI
          </button>
        </div>
        {aiAnswer ? (
          <p className="mt-3 rounded-[14px] bg-black/5 px-3 py-2 text-sm font-semibold text-[#111111]">
            {aiAnswer}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 text-xs font-bold text-[#5E7CFF] hover:underline"
        >
          Refresh dashboard
        </button>
      </section>
    </div>
  )
}

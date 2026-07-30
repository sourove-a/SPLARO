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
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--admin-color-neutral-500)]">
                {label}
              </span>
              <Icon className="h-4 w-4 text-[var(--admin-color-accent-blue)]" />
            </div>
            <p className="text-2xl font-black text-[var(--admin-color-ink-near)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[22px] border border-black/5 bg-white/55 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--admin-color-neutral-500)]">
            <Sparkles className="h-4 w-4 text-[var(--admin-color-accent-blue)]" />
            AI Executive Insights
          </h3>
          {(data?.aiInsights ?? []).length === 0 ? (
            <p className="text-sm font-semibold text-[var(--admin-color-neutral-500)]">Insights appear as order data accumulates.</p>
          ) : (
            <ul className="space-y-2">
              {(data?.aiInsights ?? []).map((item, i) => (
                <li
                  key={item.id ?? i}
                  className="rounded-[14px] border border-[var(--admin-color-accent-blue)]/20 bg-[var(--admin-color-accent-blue)]/8 px-3 py-2 text-sm font-semibold text-[var(--admin-color-ink-near)]"
                >
                  {item.insight}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[22px] border border-black/5 bg-white/55 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--admin-color-neutral-500)]">
            <Warehouse className="h-4 w-4 text-[var(--admin-color-accent-blue)]" />
            Partner Profit Share
          </h3>
          {(data?.partners ?? []).length === 0 ? (
            <p className="text-sm font-semibold text-[var(--admin-color-neutral-500)]">No partner accounts configured.</p>
          ) : (
            <div className="space-y-2">
              {(data?.partners ?? []).map((p) => (
                <div key={p.name} className="flex justify-between text-sm font-semibold">
                  <span>{p.name}</span>
                  <span className="font-black text-[var(--admin-color-accent-blue)]">{formatBDT(p.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-[22px] border border-black/5 bg-white/55 p-5">
        <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-[var(--admin-color-neutral-500)]">
          Executive AI Chat
        </h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            className="flex-1 rounded-[14px] border border-black/5 bg-white/70 px-3 py-2 text-sm font-semibold outline-none focus:border-[var(--admin-color-accent-blue)]/50"
          />
          <button
            type="button"
            onClick={() =>
              askExecutiveAI(aiQuestion)
                .then((r) => setAiAnswer(r.answer))
                .catch(() => setAiAnswer('AI chat requires API — check /ai/executive/chat endpoint.'))
            }
            className="rounded-[14px] bg-[var(--admin-color-ink-near)] px-4 py-2 text-xs font-black uppercase tracking-wider text-white"
          >
            Ask AI
          </button>
        </div>
        {aiAnswer ? (
          <p className="mt-3 rounded-[14px] bg-black/5 px-3 py-2 text-sm font-semibold text-[var(--admin-color-ink-near)]">
            {aiAnswer}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 text-xs font-bold text-[var(--admin-color-accent-blue)] hover:underline"
        >
          Refresh dashboard
        </button>
      </section>
    </div>
  )
}

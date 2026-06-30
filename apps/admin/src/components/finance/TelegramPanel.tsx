'use client'

import { Send, Shield, Bot, RefreshCw } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { useTelegramLogs } from '@/lib/api/hooks'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'

const COMMANDS = [
  '/today_sales', '/today_orders', '/pending_orders', '/delivered_today',
  '/low_stock', '/profit_today', '/profit_month',
  '/sync_sheets', '/api_health', '/report_today',
]

const ROLES = ['Super Admin', 'Partner', 'Manager', 'Order Staff', 'Finance Staff']

export function TelegramPanel() {
  const { data, isError, isLoading, refetch } = useTelegramLogs()

  return (
    <div className="space-y-6">
      {isError ? <ApiOfflineBanner /> : null}

      <div className="rounded-[22px] border border-black/5 bg-white/60 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Bot className="h-5 w-5 text-[#5E7CFF]" />
          <h3 className="text-sm font-black text-[#111111]">Telegram Business Notifications</h3>
        </div>
        <p className="text-sm font-semibold text-[#6B6B6B]">
          Configure bot in{' '}
          <AdminNavLink href="/dashboard/telegram-bot" className="font-black text-[#5E7CFF] hover:underline">
            Integrations → Telegram Bot
          </AdminNavLink>
          . Live logs below from database.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[22px] border border-black/5 bg-white/55 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Send className="h-4 w-4 text-[#5E7CFF]" />
            <h4 className="text-xs font-black uppercase tracking-wider text-[#6B6B6B]">Bot Commands</h4>
          </div>
          <ul className="grid grid-cols-2 gap-1.5 text-[11px] font-semibold text-[#111111]">
            {COMMANDS.map((cmd) => (
              <li key={cmd} className="rounded-lg bg-white/70 px-2 py-1 font-mono">{cmd}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-[22px] border border-black/5 bg-white/55 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#5E7CFF]" />
            <h4 className="text-xs font-black uppercase tracking-wider text-[#6B6B6B]">Role Permissions</h4>
          </div>
          <ul className="space-y-2">
            {ROLES.map((role) => (
              <li key={role} className="flex items-center justify-between rounded-xl border border-black/5 bg-white/70 px-3 py-2 text-sm font-semibold">
                {role}
                <span className="text-[10px] font-black uppercase text-[#5E7CFF]">API</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="admin-module-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="admin-module-card__title">Activity log</h3>
          <AdminButton onClick={() => void refetch()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </AdminButton>
        </div>
        {isLoading ? (
          <p className="text-sm font-semibold text-[#6B6B6B]">Loading…</p>
        ) : (data?.logs.length ?? 0) === 0 ? (
          <p className="text-sm font-semibold text-[#6B6B6B]">No Telegram activity yet. Send a command to the bot after configuration.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {data!.logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 rounded-[12px] bg-white/70 px-3 py-2">
                <span className={`admin-status admin-status--${log.success ? 'delivered' : 'pending'}`}>{log.type}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#111111]">
                    {log.command ? `${log.command}: ` : ''}
                    {log.message.slice(0, 100)}
                  </p>
                  <p className="text-[10px] text-[#6B6B6B]">{log.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

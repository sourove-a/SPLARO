'use client'

import { useEffect, useState } from 'react'
import { fetchFinanceAuditLogs } from '@/lib/api/finance'

export function FinanceAuditLogsPanel() {
  const [logs, setLogs] = useState<Array<{
    id: string
    action: string
    resource: string
    resourceId?: string
    note?: string
    createdAt: string
  }>>([])

  useEffect(() => {
    fetchFinanceAuditLogs()
      .then((res) => setLogs(res.items as typeof logs))
      .catch(() => setLogs([]))
  }, [])

  return (
    <div className="overflow-hidden rounded-[22px] border border-black/5 bg-white/55">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-black/5 bg-white/40 text-[10px] font-black uppercase tracking-wider text-[#6B6B6B]">
          <tr>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Resource</th>
            <th className="px-4 py-3">Note</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-[#6B6B6B]">
                No finance audit logs yet.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="border-b border-black/[0.03]">
                <td className="px-4 py-3 text-[#6B6B6B]">
                  {new Date(log.createdAt).toLocaleString('en-BD')}
                </td>
                <td className="px-4 py-3 font-black">{log.action}</td>
                <td className="px-4 py-3 font-semibold">
                  {log.resource}
                  {log.resourceId ? ` · ${log.resourceId.slice(0, 8)}…` : ''}
                </td>
                <td className="px-4 py-3 text-[#6B6B6B]">{log.note ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { toastInfo } from '@/lib/admin/feedback'
import { copyWithToast } from '@/lib/admin/clipboard'
import {
  confirmCouponDeleted,
  confirmCouponSaved,
  confirmCouponToggled,
} from '@/lib/admin/catalog-save'
import { Copy, Tag } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { ModulePanelShell, formatBDT } from '@/components/modules/ModulePanelShell'
import { createCoupon, deleteCoupon, fetchCoupons, toggleCoupon, type ApiCoupon } from '@/lib/api/coupons'
import { cn } from '@/lib/utils/cn'

export function CouponsLivePanel() {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<ApiCoupon[]>([])
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [value, setValue] = useState('10')

  const load = () => {
    setLoading(true)
    fetchCoupons()
      .then((data) => setRows(data.coupons ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter((c) => !q || c.code.toLowerCase().includes(q))
  }, [query, rows])

  const create = async () => {
    const trimmed = code.trim()
    if (!trimmed) return
    const ok = await confirmCouponSaved(
      { code: trimmed.toUpperCase(), isActive: true },
      () => createCoupon({ code: trimmed, type: 'PERCENTAGE', value: Number(value) || 10, isActive: true }),
    )
    if (ok) {
      setCode('')
      load()
    }
  }

  return (
    <div className="space-y-5">
      <section className="admin-module-card admin-module-card--accent">
        <h3 className="admin-module-card__title mb-1">Create coupon</h3>
        <p className="admin-module-card__subtitle mb-3">
          Active coupons automatically enable the discount field on storefront checkout.
        </p>
        <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
          <input className="admin-input font-mono uppercase" placeholder="SPLARO10" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="admin-input" placeholder="%" value={value} onChange={(e) => setValue(e.target.value)} />
          <AdminButton variant="gold" onClick={create}>
            Add coupon
          </AdminButton>
        </div>
      </section>

      <ModulePanelShell
        kpis={[
          ['Live codes', String(rows.filter((c) => c.isActive).length), 'success'],
          ['Total', String(rows.length), 'default'],
          ['Redemptions', String(rows.reduce((s, c) => s + c.usedCount, 0)), 'gold'],
          ['Inactive', String(rows.filter((c) => !c.isActive).length), 'warning'],
        ]}
        pipeline={[['Active', rows.filter((c) => c.isActive).length], ['Used', rows.reduce((s, c) => s + c.usedCount, 0)]]}
        query={query}
        onQuery={setQuery}
        searchPlaceholder="Search coupon code..."
        onRefresh={load}
        createLabel="New coupon"
        onCreate={() => toastInfo('Use the form above to create a coupon.')}
        exportDisabled
        tableIcon={Tag}
        tableTitle={`Coupons · ${filtered.length} results`}
        footer={loading ? 'Loading…' : `Showing ${filtered.length} live coupons`}
      >
        {filtered.length === 0 && !loading ? (
          <p className="p-4 text-sm text-[#6B6B6B]">No coupons yet. Create one above — nothing fake is shown here.</p>
        ) : (
          <table className="admin-module-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Type</th>
                <th>Value</th>
                <th>Used</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button
                      type="button"
                      onClick={() => {
                        void copyWithToast(c.code, `Copied ${c.code}`)
                      }}
                      className="flex items-center gap-1 font-mono text-sm font-black hover:text-[#5E7CFF]"
                    >
                      {c.code}
                      <Copy className="h-3 w-3" />
                    </button>
                  </td>
                  <td className="text-xs">{c.type}</td>
                  <td className="font-bold text-[#5E7CFF]">{c.type === 'PERCENTAGE' ? `${Number(c.value)}%` : formatBDT(Number(c.value))}</td>
                  <td>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                  <td>
                    <span className={cn('admin-status', c.isActive ? 'admin-status--delivered' : 'admin-status--pending')}>
                      {c.isActive ? 'active' : 'off'}
                    </span>
                  </td>
                  <td className="space-x-2">
                    <AdminButton
                      variant="ghost"
                      onClick={async () => {
                        const next = !c.isActive
                        const ok = await confirmCouponToggled(c.id, next, () => toggleCoupon(c.id, next))
                        if (ok) load()
                      }}
                    >
                      {c.isActive ? 'Disable' : 'Enable'}
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      onClick={async () => {
                        const ok = await confirmCouponDeleted(c.id, () => deleteCoupon(c.id))
                        if (ok) load()
                      }}
                    >
                      Delete
                    </AdminButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ModulePanelShell>
    </div>
  )
}

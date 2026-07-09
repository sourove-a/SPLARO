'use client'

import React, { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Eye, Search, Trash2, ShieldOff, Shield, Users,
  ShoppingBag, AlertTriangle, Star, Phone, Mail, Filter, RefreshCw,
} from 'lucide-react'

import { CustomerQuickViewDialog } from '@/components/customers/CustomerQuickViewDialog'
import { AdminButton } from '@/components/ui/AdminButton'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { useCustomers, useDeleteCustomer, useBlockCustomer, usePermission } from '@/lib/api/hooks'

function TierBadge({ tier }: { tier: string }) {
  return <span className="admin-customers-tier">{tier}</span>
}

function KpiCard({
  label, value, icon: Icon, danger,
}: { label: string; value: string | number; icon: React.ElementType; danger?: boolean }) {
  return (
    <div className={`admin-customers-kpi${danger ? ' admin-customers-kpi--danger' : ''}`}>
      <div className="admin-customers-kpi__icon">
        <Icon size={15} strokeWidth={2.2} />
      </div>
      <p className="admin-customers-kpi__value">{value}</p>
      <p className="admin-customers-kpi__label">{label}</p>
    </div>
  )
}

function CustomerRow({
  customer, onView, onBlock, onDelete, canBlock, canDelete,
}: {
  customer: {
    id: string; firstName: string; lastName: string; phone: string; email?: string | null
    totalOrders: number; totalSpent: number | string; loyaltyTier: string
    codRiskScore?: number; isBlocked?: boolean; tags?: string[]
  }
  onView: () => void
  onBlock: () => void
  onDelete: () => void
  canBlock: boolean
  canDelete: boolean
}) {
  const name = `${customer.firstName} ${customer.lastName}`.trim()
  const initials = `${customer.firstName[0] ?? ''}${customer.lastName?.[0] ?? ''}`.toUpperCase()
  const isHighRisk = (customer.codRiskScore ?? 0) >= 70

  return (
    <div className={`admin-customers-row${isHighRisk ? ' admin-customers-row--risk' : ''}`}>
      <div className="admin-customers-avatar">{initials}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="admin-customers-name">{name}</span>
          <TierBadge tier={customer.loyaltyTier} />
          {isHighRisk ? (
            <span className="admin-status admin-status--failed">COD risk</span>
          ) : null}
          {customer.isBlocked ? (
            <span className="admin-status admin-status--pending">Blocked</span>
          ) : null}
        </div>
        <div className="admin-customers-meta">
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Phone size={11} />
            {customer.phone}
          </span>
          {customer.email ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Mail size={11} />
              {customer.email}
            </span>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexShrink: 0 }} className="hidden sm:flex">
        <div className="admin-customers-stat">
          <p className="admin-customers-stat__value">{customer.totalOrders}</p>
          <p className="admin-customers-stat__label">orders</p>
        </div>
        <div className="admin-customers-stat">
          <p className="admin-customers-stat__value">
            ৳{Number(customer.totalSpent).toLocaleString('en-BD')}
          </p>
          <p className="admin-customers-stat__label">spent</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button type="button" onClick={onView} className="admin-customers-icon-btn" title="Quick view">
          <Eye size={14} />
        </button>
        <a
          href={`/dashboard/customers/${customer.id}`}
          className="admin-customers-icon-btn sm:!inline-flex hidden"
          style={{ padding: '0 10px', width: 'auto', fontSize: 11, fontWeight: 800, textDecoration: 'none' }}
        >
          Profile
        </a>
        {canBlock && (
          <button type="button" onClick={onBlock} className="admin-customers-icon-btn" title={customer.isBlocked ? 'Unblock' : 'Block'}>
            {customer.isBlocked ? <Shield size={14} /> : <ShieldOff size={14} />}
          </button>
        )}
        {canDelete && (
          <button type="button" onClick={onDelete} className="admin-customers-icon-btn admin-customers-icon-btn--danger" title="Delete">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

function CustomersView() {
  const [query, setQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const { data, isLoading, refetch } = useCustomers({ limit: 100 })
  const deleteCustomer = useDeleteCustomer()
  const blockCustomerMutation = useBlockCustomer()
  const canBlockCustomers = usePermission('settings', 'edit')
  const canDeleteCustomers = usePermission('settings', 'delete')
  const rows = useMemo(() => data?.customers ?? [], [data])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter((r) => {
      const matchQ = !q
        || `${r.firstName} ${r.lastName}`.toLowerCase().includes(q)
        || r.phone.includes(q)
        || (r.email ?? '').toLowerCase().includes(q)
      const matchT = tierFilter === 'all' || r.loyaltyTier === tierFilter
      return matchQ && matchT
    })
  }, [query, tierFilter, rows])

  const handleBlock = async (id: string, currentlyBlocked: boolean) => {
    try {
      await blockCustomerMutation.mutateAsync({ id, blocked: !currentlyBlocked })
      toast.success(currentlyBlocked ? 'Customer unblocked.' : 'Customer blocked.')
      void refetch()
    } catch {
      toast.error('Could not update block status.')
    }
  }

  const handleDelete = async (id: string, name: string, orderCount: number) => {
    const force = orderCount > 0
    if (force) {
      if (!window.confirm(`Delete ${name} and all ${orderCount} order(s)? This cannot be undone.`)) return
    } else if (!window.confirm(`Delete ${name}? This removes the account permanently.`)) {
      return
    }
    try {
      await deleteCustomer.mutateAsync({ id, force })
      toast.success(force ? 'Customer and orders deleted permanently.' : 'Customer deleted permanently.')
      void refetch()
      if (previewId === id) setPreviewId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete customer.')
    }
  }

  const vipCount = rows.filter((r) => ['GOLD', 'PLATINUM', 'DIAMOND'].includes(r.loyaltyTier)).length
  const atRiskCount = rows.filter((r) => (r.codRiskScore ?? 0) >= 60).length

  return (
    <div className="admin-customers-panel settings-section-enter">
      <div className="admin-customers-kpi-grid">
        <KpiCard label="Total customers" value={isLoading ? '…' : rows.length} icon={Users} />
        <KpiCard label="VIP members" value={isLoading ? '…' : vipCount} icon={Star} />
        <KpiCard label="Total orders" value={isLoading ? '…' : rows.reduce((s, r) => s + r.totalOrders, 0)} icon={ShoppingBag} />
        <KpiCard label="At risk (COD)" value={isLoading ? '…' : atRiskCount} icon={AlertTriangle} danger={atRiskCount > 0} />
      </div>

      <div className="admin-customers-toolbar">
        <div className="admin-customers-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, email…"
          />
        </div>
        <div className="admin-customers-chips">
          <Filter size={12} />
          {['all', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTierFilter(t)}
              className={`admin-customers-chip${tierFilter === t ? ' admin-customers-chip--active' : ''}`}
            >
              {t === 'all' ? 'All tiers' : t}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-customers-head">
        <div>
          <p className="admin-customers-head__title">Customers</p>
          <p className="admin-customers-head__meta">{filtered.length} customers</p>
        </div>
        <AdminButton size="sm" onClick={() => void refetch()}>
          <RefreshCw size={14} />
          Refresh
        </AdminButton>
      </div>

      {isLoading ? (
        <div className="admin-customers-empty">Loading customers…</div>
      ) : filtered.length === 0 ? (
        <div className="admin-customers-empty">
          {query || tierFilter !== 'all' ? 'No customers match this filter.' : 'No customers yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((r) => (
            <CustomerRow
              key={r.id}
              customer={r}
              onView={() => setPreviewId(r.id)}
              onBlock={() => void handleBlock(r.id, r.isBlocked ?? false)}
              onDelete={() => void handleDelete(r.id, `${r.firstName} ${r.lastName}`, r.totalOrders)}
              canBlock={canBlockCustomers}
              canDelete={canDeleteCustomers}
            />
          ))}
        </div>
      )}

      <CustomerQuickViewDialog customerId={previewId} onClose={() => setPreviewId(null)} />
    </div>
  )
}

const VIEWS: Record<string, () => React.ReactElement> = {
  '/dashboard/customers': CustomersView,
}

export function CommerceModulePanel({ moduleHref }: ModuleContextProps) {
  const View = VIEWS[moduleHref] ?? CustomersView
  return <View />
}

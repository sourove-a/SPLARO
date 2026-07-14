'use client'

import { useState } from 'react'
import {
  User, Phone, Mail, MapPin, Calendar, ShoppingBag,
  DollarSign, Star, Clock, Bot, Plus, Ban, ShieldCheck,
} from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { formatBDT } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'

interface CustomerProfileData {
  id: string
  firstName: string
  lastName: string
  phone: string
  email?: string
  avatar?: string
  firstVisitDate?: string
  signupDate: string
  lastLogin?: string
  lastDevice?: string
  totalOrders: number
  totalSpent: number
  avgOrderValue: number
  lastOrderDate?: string
  loyaltyPoints: number
  loyaltyTier: string
  vipScore: number
  codRiskScore: number
  tags: string[]
  adminNotes?: string
  isBlocked?: boolean
  authProvider?: string
  googleLinked?: boolean
  emailVerified?: boolean
  addresses: { label?: string; city: string; district: string; division: string }[]
  orders?: Array<{
    id: string
    invoiceNumber: string
    total: number | string
    status: string
    paymentMethod?: string
    createdAt: string
  }>
  activityNotes?: Array<{ id: string; body: string; createdAt: string }>
}

interface Customer360ProfileProps {
  customer: CustomerProfileData
  onAddNote?: (note: string) => void | Promise<void | boolean>
  onAddTag?: (tag: string) => void | Promise<void | boolean>
  onToggleBlock?: (blocked: boolean) => void | Promise<void | boolean>
  /** @deprecated Theme follows admin shell light/dark — prop kept for API compat */
  variant?: 'light' | 'dark'
}

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'text-amber-600 bg-amber-600/10 border-amber-600/20',
  SILVER: 'text-slate-500 bg-slate-400/10 border-slate-400/20',
  GOLD: 'text-yellow-600 bg-yellow-400/10 border-yellow-400/20',
  PLATINUM: 'text-cyan-600 bg-cyan-400/10 border-cyan-400/20',
  DIAMOND: 'text-purple-600 bg-purple-400/10 border-purple-400/20',
}

const TABS = ['Overview', 'Orders', 'Activity', 'AI Summary', 'Notes', 'Tags'] as const

const SURFACE_CHIP =
  'rounded-full border border-[var(--admin-glass-border-subtle)] bg-[var(--admin-surface)] px-2.5 py-0.5 text-[11px] text-[var(--admin-text-secondary)]'
const SURFACE_PANEL =
  'rounded-lg border border-[var(--admin-glass-border-subtle)] bg-[var(--admin-surface)] p-3'
const INPUT_CLASS =
  'w-full rounded-lg border border-[var(--admin-glass-border)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus:border-gold/40 focus:outline-none'
const PRESET_CHIP =
  'rounded-full border border-[var(--admin-glass-border-subtle)] bg-[var(--admin-surface)] px-3 py-1 text-xs text-[var(--admin-text-secondary)] transition-colors hover:border-gold/30 hover:text-gold'

export function Customer360Profile({ customer, onAddNote, onAddTag, onToggleBlock }: Customer360ProfileProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Overview')
  const [newNote, setNewNote] = useState('')
  const [newTag, setNewTag] = useState('')

  const riskColor = customer.codRiskScore >= 70
    ? 'text-red-500'
    : customer.codRiskScore >= 40
      ? 'text-amber-500'
      : 'text-emerald-600'

  return (
    <div className="space-y-6">
      <div className="admin-module-card">
        <div className="flex items-start gap-5">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/20 text-2xl font-serif font-light text-gold">
              {customer.firstName[0]}{customer.lastName[0]}
            </div>
            <span
              className={cn(
                'absolute -bottom-1 -right-1 rounded-full border-2 border-[var(--admin-bg)] px-1.5 py-0.5 text-[9px] font-semibold',
                TIER_COLORS[customer.loyaltyTier] ?? TIER_COLORS['BRONZE']!,
              )}
            >
              {customer.loyaltyTier}
            </span>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-[var(--admin-text)]">
                {customer.firstName} {customer.lastName}
              </h2>
              {customer.vipScore >= 80 && (
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
                  VIP
                </span>
              )}
              {customer.googleLinked ? (
                <span className="rounded-full border border-sky-300/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-600">
                  Google
                </span>
              ) : null}
              {customer.isBlocked ? (
                <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  Blocked
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[var(--admin-text-secondary)]">
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </span>
              {customer.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {customer.email}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Joined {customer.signupDate}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-muted)]">COD Risk</p>
              <p className={cn('text-2xl font-bold', riskColor)}>
                {customer.codRiskScore}
              </p>
              <p className="text-[10px] text-[var(--admin-text-muted)]">/100</p>
            </div>
            {onToggleBlock ? (
              <AdminButton
                size="sm"
                variant={customer.isBlocked ? 'gold' : 'ghost'}
                onClick={() => void onToggleBlock(!customer.isBlocked)}
              >
                {customer.isBlocked ? (
                  <><ShieldCheck className="h-3.5 w-3.5" /> Unblock</>
                ) : (
                  <><Ban className="h-3.5 w-3.5" /> Block</>
                )}
              </AdminButton>
            ) : null}
          </div>
        </div>

        {customer.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {customer.tags.map((tag) => (
              <span key={tag} className={SURFACE_CHIP}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat icon={ShoppingBag} label="Total Orders" value={customer.totalOrders} />
        <MiniStat icon={DollarSign} label="Total Spent" value={formatBDT(customer.totalSpent)} />
        <MiniStat icon={DollarSign} label="Avg Order" value={formatBDT(customer.avgOrderValue)} />
        <MiniStat icon={Star} label="Loyalty Points" value={customer.loyaltyPoints.toLocaleString()} />
      </div>

      <div className="admin-module-card !p-0 overflow-hidden">
        <div className="flex border-b border-[var(--admin-glass-border-subtle)]">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-3 text-xs font-medium transition-colors',
                activeTab === tab
                  ? 'border-b-2 border-[var(--admin-brand-gold)] text-[var(--admin-brand-gold)]'
                  : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text-secondary)]',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'Orders' && (
            <div className="space-y-2">
              {(customer.orders ?? []).length === 0 ? (
                <p className="text-sm text-[var(--admin-text-secondary)]">No orders yet.</p>
              ) : (
                <table className="admin-module-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(customer.orders ?? []).map((order) => (
                      <tr key={order.id}>
                        <td className="font-mono text-xs font-black">{order.invoiceNumber}</td>
                        <td className="capitalize text-xs">{order.status.toLowerCase().replace(/_/g, ' ')}</td>
                        <td className="font-black">{formatBDT(Number(order.total))}</td>
                        <td className="text-xs">{order.createdAt.slice(0, 10)}</td>
                        <td>
                          <AdminLinkButton href={`/dashboard/orders/${order.invoiceNumber}`} size="sm">
                            View
                          </AdminLinkButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'Activity' && (
            <div className="space-y-3">
              {(customer.activityNotes ?? []).map((note) => (
                <div key={note.id} className={SURFACE_PANEL}>
                  <p className="text-sm text-[var(--admin-text)]">{note.body}</p>
                  <p className="mt-1 text-[10px] text-[var(--admin-text-secondary)]">
                    {note.createdAt.slice(0, 16).replace('T', ' ')}
                  </p>
                </div>
              ))}
              {(customer.orders ?? []).slice(0, 5).map((order) => (
                <div key={`act-${order.id}`} className={cn(SURFACE_PANEL, 'text-xs text-[var(--admin-text-secondary)]')}>
                  Order <span className="font-mono font-bold">{order.invoiceNumber}</span> — {order.status} — {formatBDT(Number(order.total))}
                </div>
              ))}
              {!customer.activityNotes?.length && !customer.orders?.length ? (
                <p className="text-sm text-[var(--admin-text-secondary)]">No activity recorded yet.</p>
              ) : null}
            </div>
          )}

          {activeTab === 'Overview' && (
            <div className="space-y-4">
              <InfoRow
                icon={User}
                label="Sign-in method"
                value={
                  customer.googleLinked
                    ? `Google${customer.emailVerified ? ' · email verified' : ''}`
                    : customer.authProvider === 'google'
                      ? 'Google'
                      : 'Email / phone + password'
                }
              />
              <InfoRow icon={Calendar} label="First Visit" value={customer.firstVisitDate ?? 'Unknown'} />
              <InfoRow icon={Calendar} label="Signup Date" value={customer.signupDate} />
              <InfoRow icon={Clock} label="Last Login" value={customer.lastLogin ?? 'Unknown'} />
              <InfoRow icon={User} label="Last Device" value={customer.lastDevice ?? 'Unknown'} />
              <InfoRow icon={Calendar} label="Last Order" value={customer.lastOrderDate ?? 'No orders yet'} />
              <InfoRow
                icon={MapPin}
                label="Addresses"
                value={customer.addresses.map((a) => `${a.city}, ${a.district}`).join(' • ') || 'None saved'}
              />
            </div>
          )}

          {activeTab === 'Notes' && (
            <div className="space-y-4">
              {customer.adminNotes && (
                <div className={SURFACE_PANEL}>
                  <p className="text-sm text-[var(--admin-text-secondary)]">{customer.adminNotes}</p>
                </div>
              )}
              <div className="space-y-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add private admin note... (e.g. 'Customer prefers phone confirmation', 'COD risk - requires advance payment')"
                  className={cn(INPUT_CLASS, 'py-2.5')}
                  rows={3}
                />
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      const note = newNote.trim()
                      if (!note) return
                      const ok = await onAddNote?.(note)
                      if (ok !== false) setNewNote('')
                    })()
                  }}
                  disabled={!newNote.trim()}
                  className="flex items-center gap-2 rounded-lg bg-gold/20 px-4 py-2 text-xs font-medium text-gold transition-opacity hover:opacity-80 disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Save Note
                </button>
              </div>
            </div>
          )}

          {activeTab === 'Tags' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {['Regular Buyer', 'VIP', 'COD Risk', 'High LTV', 'Returns Often',
                  'Prefers Phone Confirm', 'Polite Customer', 'Wholesale'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      void onAddTag?.(preset)
                    }}
                    className={PRESET_CHIP}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Custom tag..."
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      const tag = newTag.trim()
                      if (!tag) return
                      const ok = await onAddTag?.(tag)
                      if (ok !== false) setNewTag('')
                    })()
                  }}
                  disabled={!newTag.trim()}
                  className="rounded-lg bg-gold/20 px-4 py-2 text-xs font-medium text-gold transition-opacity hover:opacity-80 disabled:opacity-30"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {activeTab === 'AI Summary' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
                <Bot className="h-4 w-4 text-gold" />
                <span>AI-generated customer intelligence</span>
              </div>
              <div className="rounded-lg border border-gold/10 bg-gold/5 p-4">
                <p className="text-sm leading-relaxed text-[var(--admin-text-secondary)]">
                  This customer has been shopping with SPLARO for {customer.totalOrders} orders,
                  spending a total of {formatBDT(customer.totalSpent)} with an average order value
                  of {formatBDT(customer.avgOrderValue)}. Their COD risk score is {customer.codRiskScore}/100
                  ({customer.codRiskScore < 30 ? 'low risk' : customer.codRiskScore < 60 ? 'medium risk' : 'high risk'}).
                  {customer.loyaltyTier === 'GOLD' || customer.loyaltyTier === 'PLATINUM' || customer.loyaltyTier === 'DIAMOND'
                    ? ' They are a high-value customer and should receive priority service.'
                    : ' Consider offering a loyalty upgrade to increase retention.'}
                  {customer.totalOrders >= 3
                    ? ' As a repeat buyer, recommend personalized product suggestions from the Festive Edit and Luxury Pret collections.'
                    : ' This is an early-stage customer — recommend a welcome coupon for the next purchase.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="admin-kpi rounded-[20px]">
      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--admin-accent-muted)]">
        <Icon className="h-3.5 w-3.5 text-[var(--admin-accent)]" strokeWidth={1.5} />
      </div>
      <p className="admin-kpi__value text-lg">{value}</p>
      <p className="admin-kpi__label">{label}</p>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-accent-muted)]">
        <Icon className="h-3.5 w-3.5 text-[var(--admin-accent)]" strokeWidth={1.5} />
      </div>
      <div className="flex flex-1 items-center justify-between gap-3">
        <p className="text-xs text-[var(--admin-text-muted)]">{label}</p>
        <p className="text-sm text-[var(--admin-text)]">{value}</p>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import {
  User, Phone, Mail, MapPin, Calendar, ShoppingBag,
  DollarSign, Star, Clock, Bot, Plus, Ban, ShieldCheck,
} from 'lucide-react'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { AdminButton } from '@/components/ui/AdminButton'
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
  onAddNote?: (note: string) => void
  onAddTag?: (tag: string) => void
  onToggleBlock?: (blocked: boolean) => void
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

export function Customer360Profile({ customer, onAddNote, onAddTag, onToggleBlock, variant = 'dark' }: Customer360ProfileProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Overview')
  const [newNote, setNewNote] = useState('')
  const [newTag, setNewTag] = useState('')
  const light = variant === 'light'

  const cardClass = light ? 'admin-module-card' : 'rounded-xl border border-white/6 bg-[#161616] p-6'
  const titleClass = light ? 'text-[#111111]' : 'text-white/90'
  const mutedClass = light ? 'text-[#6B6B6B]' : 'text-white/40'

  const riskColor = customer.codRiskScore >= 70
    ? light ? 'text-red-600' : 'text-red-400'
    : customer.codRiskScore >= 40
      ? light ? 'text-amber-600' : 'text-amber-400'
      : light ? 'text-emerald-700' : 'text-emerald-400'

  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/20 text-2xl font-serif font-light text-gold">
              {customer.firstName[0]}{customer.lastName[0]}
            </div>
            <span
              className={cn(
                'absolute -bottom-1 -right-1 rounded-full border-2 px-1.5 py-0.5 text-[9px] font-semibold',
                light ? 'border-white' : 'border-[#161616]',
                TIER_COLORS[customer.loyaltyTier] ?? TIER_COLORS['BRONZE']!,
              )}
            >
              {customer.loyaltyTier}
            </span>
          </div>

          {/* Name + contact */}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className={cn('text-xl font-semibold', titleClass)}>
                {customer.firstName} {customer.lastName}
              </h2>
              {customer.vipScore >= 80 && (
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
                  VIP
                </span>
              )}
              {customer.isBlocked ? (
                <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">
                  Blocked
                </span>
              ) : null}
            </div>
            <div className={cn('mt-2 flex flex-wrap items-center gap-4 text-sm', mutedClass)}>
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

          {/* Risk score + block */}
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/30">COD Risk</p>
              <p className={cn('text-2xl font-bold', riskColor)}>
                {customer.codRiskScore}
              </p>
              <p className="text-[10px] text-white/30">/100</p>
            </div>
            {onToggleBlock ? (
              <AdminButton
                className="!text-xs"
                variant={customer.isBlocked ? 'gold' : 'ghost'}
                onClick={() => onToggleBlock(!customer.isBlocked)}
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

        {/* Tags */}
        {customer.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {customer.tags.map((tag) => (
              <span
                key={tag}
                className={light ? 'rounded-full border border-black/8 bg-white/70 px-2.5 py-0.5 text-[11px] text-[#6B6B6B]' : 'rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/60'}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat icon={ShoppingBag} label="Total Orders" value={customer.totalOrders} light={light} />
        <MiniStat icon={DollarSign} label="Total Spent" value={formatBDT(customer.totalSpent)} light={light} />
        <MiniStat icon={DollarSign} label="Avg Order" value={formatBDT(customer.avgOrderValue)} light={light} />
        <MiniStat icon={Star} label="Loyalty Points" value={customer.loyaltyPoints.toLocaleString()} light={light} />
      </div>

      <div className={light ? 'admin-module-card !p-0 overflow-hidden' : 'rounded-xl border border-white/6 bg-[#161616]'}>
        <div className={light ? 'flex border-b border-black/5' : 'flex border-b border-white/6'}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-3 text-xs font-medium transition-colors',
                activeTab === tab
                  ? light ? 'border-b-2 border-[var(--admin-brand-gold)] text-[#111111]' : 'border-b-2 border-[var(--admin-brand-gold)] text-[var(--admin-brand-gold)]'
                  : light ? 'text-[#6B6B6B] hover:text-[#111111]' : 'text-white/40 hover:text-white/70',
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
                <p className={cn('text-sm', mutedClass)}>No orders yet.</p>
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
                          <AdminNavLink href={`/dashboard/orders/${order.id}`} className="admin-btn !text-xs">
                            View
                          </AdminNavLink>
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
                <div key={note.id} className={light ? 'rounded-lg border border-black/5 bg-white/60 p-3' : 'rounded-lg bg-white/5 p-3'}>
                  <p className={cn('text-sm', light ? 'text-[#111111]' : 'text-white/70')}>{note.body}</p>
                  <p className={cn('mt-1 text-[10px]', mutedClass)}>{note.createdAt.slice(0, 16).replace('T', ' ')}</p>
                </div>
              ))}
              {(customer.orders ?? []).slice(0, 5).map((order) => (
                <div key={`act-${order.id}`} className={light ? 'rounded-lg border border-black/5 bg-white/40 p-3 text-xs' : 'rounded-lg bg-white/5 p-3 text-xs text-white/60'}>
                  Order <span className="font-mono font-bold">{order.invoiceNumber}</span> — {order.status} — {formatBDT(Number(order.total))}
                </div>
              ))}
              {!customer.activityNotes?.length && !customer.orders?.length ? (
                <p className={cn('text-sm', mutedClass)}>No activity recorded yet.</p>
              ) : null}
            </div>
          )}

          {activeTab === 'Overview' && (
            <div className="space-y-4">
              <InfoRow icon={Calendar} label="First Visit" value={customer.firstVisitDate ?? 'Unknown'} light={light} />
              <InfoRow icon={Calendar} label="Signup Date" value={customer.signupDate} light={light} />
              <InfoRow icon={Clock} label="Last Login" value={customer.lastLogin ?? 'Unknown'} light={light} />
              <InfoRow icon={User} label="Last Device" value={customer.lastDevice ?? 'Unknown'} light={light} />
              <InfoRow icon={Calendar} label="Last Order" value={customer.lastOrderDate ?? 'No orders yet'} light={light} />
              <InfoRow icon={MapPin} label="Addresses" value={
                customer.addresses.map(a => `${a.city}, ${a.district}`).join(' • ') || 'None saved'
              } light={light} />
            </div>
          )}

          {activeTab === 'Notes' && (
            <div className="space-y-4">
              {customer.adminNotes && (
                <div className="rounded-lg bg-white/5 p-4">
                  <p className="text-sm text-white/70">{customer.adminNotes}</p>
                </div>
              )}
              <div className="space-y-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add private admin note... (e.g. 'Customer prefers phone confirmation', 'COD risk - requires advance payment')"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/80 placeholder:text-white/25 focus:border-gold/40 focus:outline-none"
                  rows={3}
                />
                <button
                  onClick={() => { onAddNote?.(newNote); setNewNote('') }}
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
                    onClick={() => onAddTag?.(preset)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition-colors hover:border-gold/30 hover:text-gold"
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
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 placeholder:text-white/25 focus:border-gold/40 focus:outline-none"
                />
                <button
                  onClick={() => { onAddTag?.(newTag); setNewTag('') }}
                  disabled={!newTag.trim()}
                  className="rounded-lg bg-gold/20 px-4 py-2 text-xs font-medium text-gold disabled:opacity-30"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {activeTab === 'AI Summary' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Bot className="h-4 w-4 text-gold" />
                <span>AI-generated customer intelligence</span>
              </div>
              <div className="rounded-lg border border-gold/10 bg-gold/5 p-4">
                <p className="text-sm text-white/70 leading-relaxed">
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

function MiniStat({ icon: Icon, label, value, light }: { icon: React.ElementType; label: string; value: string | number; light?: boolean }) {
  return (
    <div className={light ? 'admin-kpi rounded-[20px]' : 'rounded-xl border border-white/6 bg-[#161616] p-4'}>
      <div className={light ? 'mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/70' : 'mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/6'}>
        <Icon className={light ? 'h-3.5 w-3.5 text-[#5E7CFF]' : 'h-3.5 w-3.5 text-white/40'} strokeWidth={1.5} />
      </div>
      <p className={light ? 'admin-kpi__value text-lg' : 'text-lg font-semibold text-white/90'}>{value}</p>
      <p className={light ? 'admin-kpi__label' : 'text-[10px] uppercase tracking-wider text-white/30'}>{label}</p>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, light }: { icon: React.ElementType; label: string; value: string; light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={light ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/70' : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5'}>
        <Icon className={light ? 'h-3.5 w-3.5 text-[#5E7CFF]' : 'h-3.5 w-3.5 text-white/30'} strokeWidth={1.5} />
      </div>
      <div className="flex flex-1 items-center justify-between">
        <p className={light ? 'text-xs text-[#6B6B6B]' : 'text-xs text-white/40'}>{label}</p>
        <p className={light ? 'text-sm text-[#111111]' : 'text-sm text-white/70'}>{value}</p>
      </div>
    </div>
  )
}

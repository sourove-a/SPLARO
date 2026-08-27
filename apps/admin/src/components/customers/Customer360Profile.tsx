'use client'

import { useState } from 'react'
import {
  User, Phone, Mail, MapPin, Calendar, ShoppingBag,
  DollarSign, Star, Clock, Bot, Plus, Ban, ShieldCheck, ShieldAlert, MonitorSmartphone,
} from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { formatBDT } from '@/lib/utils/currency'
import { formatBdPhone, telHref } from '@/lib/format/bd-phone'
import { cn } from '@/lib/utils/cn'
import type { CustomerFraudSignals } from '@/lib/api/customers'

interface CustomerProfileData {
  id: string
  customerCode?: string | null
  firstName: string
  lastName: string
  phone: string
  email?: string
  avatar?: string
  firstVisitDate?: string
  signupDate: string
  lastLogin?: string
  lastDevice?: string
  lastIp?: string
  fraudSignals?: CustomerFraudSignals
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
  'dc-c360-chip rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-0.5 text-[11px] text-[var(--ink-2)]'
const SURFACE_PANEL =
  'dc-c360-panel rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3'
const INPUT_CLASS =
  'w-full rounded-[9px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--violet-bd)] focus:outline-none'
const PRESET_CHIP =
  'rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--ink-2)] transition-colors hover:border-[var(--violet-bd)] hover:text-[var(--violet)]'

export function Customer360Profile({ customer, onAddNote, onAddTag, onToggleBlock }: Customer360ProfileProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Overview')
  const [newNote, setNewNote] = useState('')
  const [newTag, setNewTag] = useState('')

  return (
    <div className="dc-c360-body space-y-4">
      <div
        className="dc-c360-hero"
        style={{
          border: '1px solid var(--line)',
          borderRadius: 14,
          background: 'var(--surface)',
          backgroundImage: 'var(--card-sheen)',
          padding: 16,
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <div className="relative shrink-0 self-start">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[var(--violet-soft)] text-xl font-serif font-light text-[var(--violet)] sm:h-16 sm:w-16 sm:text-2xl">
              {customer.avatar ? (
                // Remote provider URL (Google). next/image would need every
                // host allow-listed and buys nothing at 64px.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={customer.avatar}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <>
                  {customer.firstName[0]}
                  {customer.lastName[0]}
                </>
              )}
            </div>
            <span
              className={cn(
                'absolute -bottom-1 -right-1 rounded-full border-2 border-[var(--surface)] px-1.5 py-0.5 text-[9px] font-semibold',
                TIER_COLORS[customer.loyaltyTier] ?? TIER_COLORS['BRONZE']!,
              )}
            >
              {customer.loyaltyTier}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="text-lg font-semibold text-[var(--ink)] sm:text-xl">
                {customer.firstName} {customer.lastName}
              </h2>
              {customer.customerCode ? (
                <span className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-[var(--violet)]">
                  {customer.customerCode.toUpperCase()}
                </span>
              ) : null}
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                  TIER_COLORS[customer.loyaltyTier] ?? TIER_COLORS['BRONZE']!,
                )}
              >
                {customer.loyaltyTier}
              </span>
              {customer.phone ? (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                  Phone verified
                </span>
              ) : null}
              {customer.vipScore >= 80 && (
                <span className="rounded-full border border-[var(--violet-bd)] bg-[var(--violet-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--violet)]">
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
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--ink-2)]">
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <a className="hover:underline" href={telHref(customer.phone)}>
                  {formatBdPhone(customer.phone)}
                </a>
              </span>
              {customer.email && (
                <span className="flex min-w-0 items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </span>
              )}
              {customer.addresses[0] ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {customer.addresses[0].district || customer.addresses[0].city}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                Joined {customer.signupDate}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:flex-col sm:items-end">
            {customer.phone ? (
              <AdminButton size="sm" variant="ghost" onClick={() => window.open(telHref(customer.phone), '_self')}>
                <Phone className="h-3.5 w-3.5" /> Call
              </AdminButton>
            ) : null}
            {onToggleBlock ? (
              <AdminButton
                size="sm"
                variant={customer.isBlocked ? 'accent' : 'ghost'}
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
        <MiniStat
          icon={ShoppingBag}
          label="Total Orders"
          value={customer.totalOrders}
          sub={customer.lastOrderDate ? `last on ${customer.lastOrderDate.slice(0, 10)}` : 'no orders yet'}
        />
        <MiniStat icon={DollarSign} label="Lifetime Spend" value={formatBDT(customer.totalSpent)} sub="net of returns" />
        <MiniStat icon={DollarSign} label="Avg Order Value" value={formatBDT(customer.avgOrderValue)} />
        <MiniStat
          icon={Star}
          label="Loyalty Points"
          value={customer.loyaltyPoints.toLocaleString()}
          sub={`${customer.loyaltyTier} tier`}
        />
      </div>

      <div
        className="dc-c360-tabs overflow-hidden"
        style={{
          border: '1px solid var(--line)',
          borderRadius: 14,
          background: 'var(--surface)',
          backgroundImage: 'var(--card-sheen)',
        }}
      >
        <div
          className="flex overflow-x-auto border-b border-[var(--line)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Customer profile sections"
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'shrink-0 whitespace-nowrap px-3.5 py-3 text-xs font-medium transition-colors sm:px-4',
                activeTab === tab
                  ? 'border-b-2 border-[var(--violet)] text-[var(--violet)]'
                  : 'border-b-2 border-transparent text-[var(--ink-3)] hover:text-[var(--ink-2)]',
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
                <p className="text-sm text-[var(--ink-2)]">No orders yet.</p>
              ) : (
                <table className="dc-c360-table w-full text-sm">
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
                  <p className="text-sm text-[var(--ink)]">{note.body}</p>
                  <p className="mt-1 text-[10px] text-[var(--ink-2)]">
                    {note.createdAt.slice(0, 16).replace('T', ' ')}
                  </p>
                </div>
              ))}
              {(customer.orders ?? []).slice(0, 5).map((order) => (
                <div key={`act-${order.id}`} className={cn(SURFACE_PANEL, 'text-xs text-[var(--ink-2)]')}>
                  Order <span className="font-mono font-bold">{order.invoiceNumber}</span> — {order.status} — {formatBDT(Number(order.total))}
                </div>
              ))}
              {!customer.activityNotes?.length && !customer.orders?.length ? (
                <p className="text-sm text-[var(--ink-2)]">No activity recorded yet.</p>
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
              <InfoRow
                icon={MonitorSmartphone}
                label="Last login IP"
                value={customer.lastIp ?? 'Not captured'}
              />
              <InfoRow icon={Calendar} label="Last Order" value={customer.lastOrderDate ?? 'No orders yet'} />
              <InfoRow
                icon={MapPin}
                label="Addresses"
                value={customer.addresses.map((a) => `${a.city}, ${a.district}`).join(' • ') || 'None saved'}
              />

              <FraudSignalsPanel signals={customer.fraudSignals} />
            </div>
          )}

          {activeTab === 'Notes' && (
            <div className="space-y-4">
              {customer.adminNotes && (
                <div className={SURFACE_PANEL}>
                  <p className="text-sm text-[var(--ink-2)]">{customer.adminNotes}</p>
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
                  className="flex items-center gap-2 rounded-lg bg-[var(--violet-soft)] px-4 py-2 text-xs font-medium text-[var(--violet)] transition-opacity hover:opacity-80 disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Save Note
                </button>
              </div>
            </div>
          )}

          {activeTab === 'Tags' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                  Applied
                </p>
                {customer.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {customer.tags.map((tag) => (
                      <span key={tag} className={SURFACE_CHIP}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--ink-2)]">No tags yet.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                  Suggested
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Regular Buyer', 'VIP', 'COD Risk', 'High LTV', 'Returns Often',
                    'Prefers Phone Confirm', 'Polite Customer', 'Wholesale'].map((preset) => {
                    const applied = customer.tags.some(
                      (tag) => tag.toLowerCase() === preset.toLowerCase(),
                    )
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={applied || !onAddTag}
                        onClick={() => {
                          void onAddTag?.(preset)
                        }}
                        className={cn(
                          PRESET_CHIP,
                          'inline-flex items-center gap-1.5',
                          applied && 'cursor-default opacity-45 hover:border-[var(--line)] hover:text-[var(--ink-2)]',
                        )}
                      >
                        {!applied ? <Plus className="h-3 w-3 shrink-0" strokeWidth={2.2} /> : null}
                        {preset}
                      </button>
                    )
                  })}
                </div>
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
                  disabled={!newTag.trim() || !onAddTag}
                  className="rounded-lg bg-[var(--violet-soft)] px-4 py-2 text-xs font-medium text-[var(--violet)] transition-opacity hover:opacity-80 disabled:opacity-30"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {activeTab === 'AI Summary' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-[var(--ink-3)]">
                <Bot className="h-4 w-4 text-[var(--violet)]" />
                <span>AI-generated customer intelligence</span>
              </div>
              <div className="rounded-lg border border-[var(--violet-bd)] bg-[var(--violet-soft)] p-4">
                <p className="text-sm leading-relaxed text-[var(--ink-2)]">
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

function MiniStat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div style={{
      border: '1px solid var(--line)',
      borderRadius: 14,
      background: 'var(--surface)',
      backgroundImage: 'var(--card-sheen)',
      padding: 14,
    }}>
      <div
        className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ background: 'var(--violet-soft)', color: 'var(--violet)' }}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
      </div>
      <p style={{ margin: 0, font: '700 18px/1.2 var(--dc-mono, ui-monospace, monospace)', color: 'var(--ink)' }}>{value}</p>
      <p
        style={{
          margin: '6px 0 0',
          font: '600 10.5px/1 var(--dc-font, inherit)',
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {label}
      </p>
      {sub ? <p className="mt-1 text-[11px] font-medium text-[var(--ink-3)]">{sub}</p> : null}
    </div>
  )
}

function FraudSignalsPanel({ signals }: { signals?: CustomerFraudSignals | undefined }) {
  if (!signals) {
    return (
      <div className={cn(SURFACE_PANEL, 'mt-2 space-y-2')}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
          <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.5} />
          Fraud signals
        </div>
        <p className="text-sm text-[var(--ink-2)]">Signals unavailable.</p>
      </div>
    )
  }

  if (!signals.captured) {
    return (
      <div className={cn(SURFACE_PANEL, 'mt-2 space-y-2')}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
          <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.5} />
          Fraud signals
        </div>
        <p className="text-sm text-[var(--ink-2)]">
          Not captured on older orders — new checkouts will store IP and device ID.
        </p>
      </div>
    )
  }

  const formatSeen = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  return (
    <div className={cn(SURFACE_PANEL, 'mt-2 space-y-3')}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
        <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.5} />
        Fraud signals
        <span className="font-normal normal-case tracking-normal text-[var(--ink-3)]">
          (review only — no auto-block)
        </span>
      </div>

      {signals.flags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {signals.flags.map((flag) => (
            <span
              key={flag}
              className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-800"
            >
              {flag}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-emerald-700">No elevated duplicate-device/IP warnings.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <SignalStat label="Order IP" value={signals.lastIp ?? 'Not captured'} />
        <SignalStat label="Device ID" value={signals.lastDeviceIdMasked ?? 'Not captured'} />
        <SignalStat label="Device" value={signals.lastDeviceSummary ?? 'Unknown'} />
        <SignalStat
          label="Same IP orders"
          value={`${signals.sameIpOrderCount} · ${signals.distinctPhonesOnIp} phone(s)`}
        />
        <SignalStat
          label="Same device orders"
          value={`${signals.sameDeviceOrderCount} · ${signals.distinctPhonesOnDevice} phone(s)`}
        />
        <SignalStat
          label="First / last seen"
          value={`${formatSeen(signals.firstSeenAt)} → ${formatSeen(signals.lastSeenAt)}`}
        />
      </div>
    </div>
  )
}

function SignalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--surface)]/40 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[var(--ink-3)]">{label}</p>
      <p className="mt-0.5 break-all font-mono text-xs text-[var(--ink)]">{value}</p>
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
        <p className="text-xs text-[var(--ink-3)]">{label}</p>
        <p className="text-sm text-[var(--ink)]">{value}</p>
      </div>
    </div>
  )
}

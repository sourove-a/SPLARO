'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import {
  BarChart3,
  Camera,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  Package,
  Plus,
  RefreshCw,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  WifiOff,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import {
  approveExpense,
  approveTransaction,
  createExpense,
  createPartnerTransaction,
  fetchExpenses,
  fetchPartnerHub,
  fetchPartnerTransactions,
  type ExpenseRow,
  type InventoryItem,
  type PartnerAccount,
  type PartnerHubData,
  type PartnerTransactionRow,
  updatePartnerProfile,
} from '@/lib/api/finance'
import { uploadAdminImage } from '@/lib/api/upload'
import { formatBDT } from '@/lib/format/currency'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { cn } from '@/lib/utils/cn'

const PARTNER_ORDER = ['sourove', 'raju', 'hridoy']

type HubTab =
  | 'overview'
  | 'partners'
  | 'inventory'
  | 'products'
  | 'profit'
  | 'expenses'
  | 'ledger'
  | 'invest'
  | 'withdraw'

const EXPENSE_CATEGORIES = [
  { value: 'PRODUCT_COST', label: 'Product cost' },
  { value: 'COURIER_COST', label: 'Courier / delivery' },
  { value: 'MARKETING_COST', label: 'Marketing' },
  { value: 'PACKAGING_COST', label: 'Packaging' },
  { value: 'OFFICE_EXPENSE', label: 'Office expense' },
  { value: 'SALARY', label: 'Salary' },
  { value: 'SAAS_SUBSCRIPTION_COST', label: 'SaaS / tools' },
  { value: 'OTHER_EXPENSE', label: 'Other' },
] as const

function tabFromHref(href: string): HubTab {
  if (href.includes('/expenses')) return 'expenses'
  if (href.includes('/investments')) return 'invest'
  if (href.includes('/withdrawals')) return 'withdraw'
  if (href.includes('/profit-loss')) return 'profit'
  if (href.includes('/daily-closing')) return 'ledger'
  return 'overview'
}

function PartnerAvatar({
  partner,
  size = 56,
  onUpload,
  uploading,
}: {
  partner: PartnerAccount
  size?: number
  onUpload?: (file: File) => void
  uploading?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const initials = partner.name.slice(0, 2).toUpperCase()

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-black/8 bg-gradient-to-br from-[#5E7CFF]/25 to-white shadow-sm">
        {partner.avatarUrl ? (
          <Image src={partner.avatarUrl} alt={partner.name} width={size} height={size} className="h-full w-full object-cover" unoptimized />
        ) : (
          <span className="text-lg font-black text-[#9a7b52]">{initials}</span>
        )}
      </div>
      {onUpload ? (
        <>
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-white bg-[#1c1c22] text-white shadow-md transition hover:bg-[#2f2f38] disabled:opacity-60"
            aria-label={`Upload photo for ${partner.name}`}
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUpload(file)
              e.target.value = ''
            }}
          />
        </>
      ) : null}
    </div>
  )
}

function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'text-[#5E7CFF]',
}: {
  label: string
  value: string
  sub?: string
  icon: typeof Wallet
  tone?: string
}) {
  return (
    <div className="partner-kpi-card">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', tone)} />
        <span className="admin-kpi__label">{label}</span>
      </div>
      <p className="mt-2 text-xl font-black text-[var(--admin-text)]">{value}</p>
      {sub ? <p className="mt-1 text-[11px] font-semibold text-[var(--admin-text-secondary)]">{sub}</p> : null}
    </div>
  )
}

function demandBadge(item: InventoryItem) {
  if (item.soldCount >= 10) return { label: 'Best seller', className: 'bg-emerald-100 text-emerald-800' }
  if (item.viewCount >= 50) return { label: 'High demand', className: 'bg-amber-100 text-amber-800' }
  if (item.stock === 0) return { label: 'Out of stock', className: 'bg-red-100 text-red-700' }
  if (item.stock <= 5) return { label: 'Low stock', className: 'bg-orange-100 text-orange-800' }
  return { label: 'Stable', className: 'bg-black/5 text-[var(--admin-text-secondary)]' }
}

export function PartnerHubPage({ moduleHref = '/dashboard/finance/partner-accounts' }: ModuleContextProps) {
  const [tab, setTab] = useState<HubTab>(() => tabFromHref(moduleHref))
  const [hub, setHub] = useState<PartnerHubData | null>(null)
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [ledger, setLedger] = useState<PartnerTransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [apiOnline, setApiOnline] = useState(true)
  const [uploadingSlug, setUploadingSlug] = useState<string | null>(null)
  const [savingSlug, setSavingSlug] = useState<string | null>(null)

  const [expenseForm, setExpenseForm] = useState({
    category: 'OTHER_EXPENSE',
    amount: '',
    note: '',
    partnerId: '',
  })

  const [txnForm, setTxnForm] = useState({ partnerId: '', amount: '', note: '' })

  const partners = useMemo(() => hub?.partners ?? [], [hub])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [hubData, e, l] = await Promise.all([
        fetchPartnerHub(),
        fetchExpenses(1, { limit: '50' }),
        fetchPartnerTransactions({ limit: '100' }),
      ])
      setHub(hubData)
      setExpenses(e.items ?? [])
      setLedger(l.items ?? [])
      setApiOnline(true)
    } catch {
      setHub(null)
      setExpenses([])
      setLedger([])
      setApiOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setTab(tabFromHref(moduleHref))
  }, [moduleHref])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const sortedPartners = useMemo(
    () =>
      [...partners].sort(
        (a, b) =>
          (PARTNER_ORDER.indexOf(a.slug) === -1 ? 99 : PARTNER_ORDER.indexOf(a.slug)) -
          (PARTNER_ORDER.indexOf(b.slug) === -1 ? 99 : PARTNER_ORDER.indexOf(b.slug)),
      ),
    [partners],
  )

  const handleAvatarUpload = async (partner: PartnerAccount, file: File) => {
    setUploadingSlug(partner.slug)
    try {
      const url = await uploadAdminImage(file, 'partners')
      await updatePartnerProfile(partner.slug, { avatarUrl: url })
      toast.success(`${partner.name} photo updated`)
      loadAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingSlug(null)
    }
  }

  const handleSaveProfile = async (partner: PartnerAccount, patch: { name: string; email: string; phone: string }) => {
    setSavingSlug(partner.slug)
    try {
      await updatePartnerProfile(partner.slug, patch)
      toast.success(`${partner.name} profile saved`)
      loadAll()
    } catch {
      toast.error('Could not save profile')
    } finally {
      setSavingSlug(null)
    }
  }

  const handleCreateExpense = async () => {
    const amount = Number(expenseForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (!expenseForm.note.trim()) {
      toast.error('Write why this expense was made')
      return
    }
    try {
      await createExpense({
        category: expenseForm.category,
        amount,
        note: expenseForm.note.trim(),
        ...(expenseForm.partnerId ? { partnerId: expenseForm.partnerId } : {}),
        createdBy: 'admin',
      })
      toast.success('Expense recorded — pending approval')
      setExpenseForm({ category: 'OTHER_EXPENSE', amount: '', note: '', partnerId: '' })
      loadAll()
    } catch {
      toast.error('Could not save expense')
    }
  }

  const handleApproveExpense = async (id: string) => {
    try {
      await approveExpense(id, 'admin')
      toast.success('Expense approved — partner balances updated')
      loadAll()
    } catch {
      toast.error('Could not approve expense')
    }
  }

  const handleCreateTxn = async (type: 'INVESTMENT' | 'WITHDRAWAL') => {
    const amount = Number(txnForm.amount)
    if (!txnForm.partnerId || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Select partner and valid amount')
      return
    }
    try {
      const tx = await createPartnerTransaction({
        partnerId: txnForm.partnerId,
        type,
        amount,
        note: txnForm.note.trim() || undefined,
        createdBy: 'admin',
      }) as { id: string; status: string }
      if (type === 'WITHDRAWAL' && tx.status === 'PENDING') {
        await approveTransaction(tx.id, 'admin')
      }
      toast.success(type === 'INVESTMENT' ? 'Investment recorded' : 'Withdrawal recorded')
      setTxnForm({ partnerId: '', amount: '', note: '' })
      loadAll()
    } catch {
      toast.error('Could not record transaction')
    }
  }

  if (loading) {
    return <div className="h-56 animate-pulse rounded-[22px] bg-[var(--admin-surface-muted)]" />
  }

  const totals = hub?.totals
  const inv = hub?.inventory.totals
  const monthly = hub?.profitLoss.monthly.totals
  const weekly = hub?.profitLoss.weekly.totals

  const tabs: { id: HubTab; label: string; icon: typeof Users }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'partners', label: 'Partners', icon: Users },
    { id: 'inventory', label: 'Stock / Mal', icon: Package },
    { id: 'products', label: 'Top products', icon: TrendingUp },
    { id: 'profit', label: 'Profit & Loss', icon: BarChart3 },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'ledger', label: 'Ledger', icon: Wallet },
    { id: 'invest', label: 'Investment', icon: TrendingUp },
    { id: 'withdraw', label: 'Withdrawal', icon: TrendingDown },
  ]

  return (
    <div className="space-y-5">
      {!apiOnline ? (
        <div className="admin-settings-status admin-settings-status--offline">
          <p className="flex items-center gap-2 text-xs font-semibold text-amber-900">
            <WifiOff className="h-4 w-4" />
            API offline — start backend on port 4000. No fake data is shown.
          </p>
        </div>
      ) : null}

      <section className="partner-hero-card">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5E7CFF]">SOUROVE · RAJU · HRIDOY</p>
          <h2 className="mt-1 text-2xl font-black text-[var(--admin-text)]">Partner Command Center</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-[var(--admin-text-secondary)]">
            Protteker alada hisab, investment, stock value, profit/loss — sob kichu live database theke. Kono demo number nai.
          </p>
        </div>
        <AdminButton variant="gold" onClick={loadAll}>
          <RefreshCw className="h-4 w-4" />
          Refresh live data
        </AdminButton>
      </section>

      {totals ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <KpiTile label="Combined balance" value={formatBDT(totals.combinedBalance)} icon={Wallet} />
          <KpiTile label="Total invested" value={formatBDT(totals.totalInvested)} icon={TrendingUp} tone="text-emerald-700" />
          <KpiTile label="Stock value (cost)" value={formatBDT(inv?.totalCostValue ?? 0)} sub={`${inv?.totalUnits ?? 0} units`} icon={Package} tone="text-zinc-700" />
          <KpiTile label="Stock value (retail)" value={formatBDT(inv?.totalRetailValue ?? 0)} sub={`${inv?.productCount ?? 0} products`} icon={Package} />
          <KpiTile label="Monthly net profit" value={formatBDT(totals.monthlyNetProfit)} sub={`Revenue ${formatBDT(totals.monthlyRevenue)}`} icon={BarChart3} tone={totals.monthlyNetProfit >= 0 ? 'text-emerald-700' : 'text-red-600'} />
          <KpiTile label="Weekly net profit" value={formatBDT(totals.weeklyNetProfit)} icon={Clock} />
        </div>
      ) : null}

      <div className="admin-tab-row flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={cn('admin-tab-pill', tab === id && 'admin-tab-pill--active')}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && hub ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {sortedPartners.map((partner) => (
              <div key={partner.id} className="partner-mini-card">
                <div className="flex items-center gap-3">
                  <PartnerAvatar partner={partner} size={48} />
                  <div>
                    <p className="text-lg font-black text-[var(--admin-text)]">{partner.name}</p>
                    <p className="text-[11px] font-semibold text-[var(--admin-text-secondary)]">{Number(partner.sharePercent)}% share · alada hisab</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-[var(--admin-text-secondary)]">Balance</p><p className="font-black text-[#5E7CFF]">{formatBDT(Number(partner.currentBalance))}</p></div>
                  <div><p className="text-[var(--admin-text-secondary)]">Invested</p><p className="font-black">{formatBDT(Number(partner.totalInvestment))}</p></div>
                  <div><p className="text-[var(--admin-text-secondary)]">Profit share</p><p className="font-black text-emerald-700">{formatBDT(Number(partner.totalProfitShare))}</p></div>
                  <div><p className="text-[var(--admin-text-secondary)]">Expense share</p><p className="font-black text-amber-800">{formatBDT(Number(partner.totalExpenseShare))}</p></div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="admin-module-card">
              <h3 className="admin-module-card__title">Recent investments — ke koto invest korlo</h3>
              {hub.recentInvestments.length === 0 ? (
                <p className="text-sm font-semibold text-[var(--admin-text-secondary)]">No investments recorded yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {hub.recentInvestments.slice(0, 8).map((row) => (
                    <div key={row.id} className="flex items-center justify-between rounded-xl border border-black/5 bg-white/60 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-black">{row.partner?.name ?? '—'}</p>
                        <p className="text-[11px] text-[var(--admin-text-secondary)]">{row.note ?? 'Investment'} · {new Date(row.date).toLocaleDateString('en-BD')}</p>
                      </div>
                      <p className="font-black text-emerald-700">{formatBDT(row.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="admin-module-card">
              <h3 className="admin-module-card__title">Expense breakdown — kothay khoroch</h3>
              {hub.expensesByCategory.length === 0 ? (
                <p className="text-sm font-semibold text-[var(--admin-text-secondary)]">No approved expenses yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {hub.expensesByCategory.map((e) => (
                    <div key={e.category} className="flex items-center justify-between text-sm">
                      <span className="font-semibold capitalize">{e.category.replace(/_/g, ' ').toLowerCase()}</span>
                      <span className="font-black text-[#5E7CFF]">{formatBDT(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'partners' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {sortedPartners.length === 0 ? (
            <div className="admin-module-card lg:col-span-3">
              <p className="admin-module-card__subtitle">Start API and refresh — SOUROVE, RAJU, HRIDOY auto-create on first load.</p>
            </div>
          ) : null}
          {sortedPartners.map((partner) => (
            <PartnerProfileCard
              key={partner.id}
              partner={partner}
              investments={hub?.recentInvestments.filter((i) => i.partner?.slug === partner.slug) ?? []}
              uploading={uploadingSlug === partner.slug}
              saving={savingSlug === partner.slug}
              onUpload={(file) => handleAvatarUpload(partner, file)}
              onSave={(patch) => handleSaveProfile(partner, patch)}
            />
          ))}
        </div>
      ) : null}

      {tab === 'inventory' && hub ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Total stock units" value={String(inv?.totalUnits ?? 0)} icon={Package} />
            <KpiTile label="Mal er dam (cost)" value={formatBDT(inv?.totalCostValue ?? 0)} icon={Wallet} />
            <KpiTile label="Bikri mulya (retail)" value={formatBDT(inv?.totalRetailValue ?? 0)} icon={TrendingUp} />
            <KpiTile label="Potential margin" value={formatBDT((inv?.totalRetailValue ?? 0) - (inv?.totalCostValue ?? 0))} icon={BarChart3} tone="text-emerald-700" />
          </div>
          <section className="admin-module-table-wrap">
            <div className="border-b border-black/5 px-4 py-3">
              <p className="admin-kpi__label">Live inventory · {hub.inventory.items.length} products</p>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-module-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Stock</th>
                    <th>Cost value</th>
                    <th>Retail value</th>
                    <th>Sold</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hub.inventory.items.map((item) => {
                    const badge = demandBadge(item)
                    return (
                      <tr key={item.id}>
                        <td className="font-semibold">{item.name}</td>
                        <td className="font-black">{item.stock}</td>
                        <td>{formatBDT(item.costValue)}</td>
                        <td>{formatBDT(item.retailValue)}</td>
                        <td>{item.soldCount}</td>
                        <td><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', badge.className)}>{badge.label}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'products' && hub ? (
        <section className="admin-module-table-wrap">
          <div className="border-b border-black/5 px-4 py-3">
            <p className="admin-kpi__label">Top products by demand — kon product bhalo cholche</p>
          </div>
          <div className="overflow-x-auto">
            <table className="admin-module-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Sold</th>
                  <th>Views</th>
                  <th>Stock</th>
                  <th>Demand</th>
                </tr>
              </thead>
              <tbody>
                {hub.topProducts.map((item, idx) => {
                  const badge = demandBadge(item)
                  return (
                    <tr key={item.id}>
                      <td className="font-black text-[#5E7CFF]">{idx + 1}</td>
                      <td className="font-semibold">{item.name}</td>
                      <td className="font-black">{item.soldCount}</td>
                      <td>{item.viewCount}</td>
                      <td>{item.stock}</td>
                      <td><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', badge.className)}>{badge.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {hub.topProducts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm font-semibold text-[var(--admin-text-secondary)]">No products in catalog yet.</p>
          ) : null}
        </section>
      ) : null}

      {tab === 'profit' && hub && monthly ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="admin-module-card admin-module-card--accent">
              <h3 className="admin-module-card__title">This month — labh / loss</h3>
              <p className={cn('mt-2 text-3xl font-black', monthly.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                {formatBDT(monthly.netProfit)}
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--admin-text-secondary)]">{hub.profitLoss.monthly.orderCount} delivered orders counted</p>
              <dl className="mt-4 space-y-2 text-sm">
                {[
                  ['Gross revenue', monthly.grossRevenue],
                  ['Product cost', -monthly.productCost],
                  ['Courier cost', -monthly.courierCost],
                  ['Packaging', -monthly.packagingCost],
                  ['Gateway fees', -monthly.paymentGatewayFee],
                  ['Discounts', -monthly.discount],
                  ['Return loss', -monthly.returnLoss],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between border-b border-black/5 pb-1">
                    <dt className="font-semibold">{label}</dt>
                    <dd className={cn('font-black', Number(val) < 0 ? 'text-red-600' : '')}>{formatBDT(Math.abs(Number(val)))}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="admin-module-card">
              <h3 className="admin-module-card__title">This week</h3>
              <p className={cn('mt-2 text-3xl font-black', (weekly?.netProfit ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                {formatBDT(weekly?.netProfit ?? 0)}
              </p>
              <p className="mt-4 text-sm font-semibold text-[var(--admin-text-secondary)]">
                Profit calculates automatically when orders are marked DELIVERED. No fake numbers.
              </p>
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'expenses' ? (
        <div className="space-y-4">
          <section className="admin-module-card admin-module-card--accent">
            <h3 className="admin-module-card__title">Record expense</h3>
            <p className="admin-module-card__subtitle mb-4">Ke kothay koto taka khoroch — ken khoroch korlo tar note likhun.</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="admin-field">
                <span className="admin-kpi__label">Category</span>
                <select className="admin-input" value={expenseForm.category} onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span className="admin-kpi__label">Amount (৳)</span>
                <input className="admin-input" type="number" min="0" value={expenseForm.amount} onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))} />
              </label>
              <label className="admin-field">
                <span className="admin-kpi__label">Paid by partner (optional)</span>
                <select className="admin-input" value={expenseForm.partnerId} onChange={(e) => setExpenseForm((f) => ({ ...f, partnerId: e.target.value }))}>
                  <option value="">Split by share %</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label className="admin-field md:col-span-2">
                <span className="admin-kpi__label">Why / what for</span>
                <input className="admin-input" placeholder="e.g. Steadfast courier bill" value={expenseForm.note} onChange={(e) => setExpenseForm((f) => ({ ...f, note: e.target.value }))} />
              </label>
            </div>
            <AdminButton variant="gold" className="mt-4" onClick={handleCreateExpense}>
              <Plus className="h-4 w-4" />
              Add expense
            </AdminButton>
          </section>

          <section className="admin-module-table-wrap">
            <div className="border-b border-black/5 px-4 py-3">
              <p className="admin-kpi__label">Live expenses · {expenses.length}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="admin-module-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Who</th>
                    <th>Why</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((row) => (
                    <tr key={row.id}>
                      <td className="text-xs">{new Date(row.expenseDate).toLocaleDateString('en-BD')}</td>
                      <td className="text-xs font-semibold">{row.category.replace(/_/g, ' ')}</td>
                      <td className="text-xs">{row.partner?.name ?? 'All partners'}</td>
                      <td className="max-w-[200px] truncate text-xs">{row.note ?? '—'}</td>
                      <td className="font-black">{formatBDT(Number(row.amount))}</td>
                      <td>
                        <span className={cn('admin-status', row.status === 'APPROVED' ? 'admin-status--delivered' : 'admin-status--pending')}>
                          {row.status.toLowerCase()}
                        </span>
                      </td>
                      <td>
                        {row.status === 'PENDING' ? (
                          <AdminButton variant="gold" size="sm" onClick={() => handleApproveExpense(row.id)}>
                            Approve
                          </AdminButton>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {(tab === 'invest' || tab === 'withdraw') ? (
        <section className="admin-module-card admin-module-card--accent max-w-xl">
          <h3 className="admin-module-card__title">{tab === 'invest' ? 'Partner investment' : 'Partner withdrawal'}</h3>
          <p className="admin-module-card__subtitle mb-4">Ke koto taka invest korlo ba tullo — note diye record korun.</p>
          <div className="space-y-3">
            <label className="admin-field">
              <span className="admin-kpi__label">Partner</span>
              <select className="admin-input" value={txnForm.partnerId} onChange={(e) => setTxnForm((f) => ({ ...f, partnerId: e.target.value }))}>
                <option value="">Select partner</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Amount (৳)</span>
              <input className="admin-input" type="number" min="0" value={txnForm.amount} onChange={(e) => setTxnForm((f) => ({ ...f, amount: e.target.value }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Note — kothay / keno</span>
              <input className="admin-input" placeholder="e.g. Initial stock purchase, Dhaka warehouse" value={txnForm.note} onChange={(e) => setTxnForm((f) => ({ ...f, note: e.target.value }))} />
            </label>
            <AdminButton variant="gold" onClick={() => handleCreateTxn(tab === 'invest' ? 'INVESTMENT' : 'WITHDRAWAL')}>
              Save {tab === 'invest' ? 'investment' : 'withdrawal'}
            </AdminButton>
          </div>
        </section>
      ) : null}

      {tab === 'ledger' ? (
        <section className="admin-module-table-wrap">
          <div className="border-b border-black/5 px-4 py-3">
            <p className="admin-kpi__label">Partner ledger · {ledger.length} entries</p>
          </div>
          <div className="overflow-x-auto">
            <table className="admin-module-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Partner</th>
                  <th>Type</th>
                  <th>Note</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={row.id}>
                    <td className="text-xs">{new Date(row.transactionDate).toLocaleDateString('en-BD')}</td>
                    <td className="font-semibold">{row.partner?.name ?? '—'}</td>
                    <td className="text-xs">{row.type.replace(/_/g, ' ')}</td>
                    <td className="max-w-[220px] truncate text-xs">{row.note ?? '—'}</td>
                    <td className="font-black">{formatBDT(Number(row.amount))}</td>
                    <td>
                      <span className={cn('admin-status', row.status === 'APPROVED' ? 'admin-status--delivered' : 'admin-status--pending')}>
                        {row.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function PartnerProfileCard({
  partner,
  investments,
  uploading,
  saving,
  onUpload,
  onSave,
}: {
  partner: PartnerAccount
  investments: PartnerHubData['recentInvestments']
  uploading: boolean
  saving: boolean
  onUpload: (file: File) => void
  onSave: (patch: { name: string; email: string; phone: string }) => void
}) {
  const [name, setName] = useState(partner.name)
  const [email, setEmail] = useState(partner.email ?? '')
  const [phone, setPhone] = useState(partner.phone ?? '')

  useEffect(() => {
    setName(partner.name)
    setEmail(partner.email ?? '')
    setPhone(partner.phone ?? '')
  }, [partner])

  return (
    <article className="admin-module-card admin-module-card--accent flex flex-col">
      <div className="mb-3 border-b border-black/5 pb-3">
        <h2 className="text-2xl font-black tracking-wide text-[var(--admin-text)]">{partner.name}</h2>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-text-secondary)]">
          Alada hisab · {Number(partner.sharePercent)}% share
        </p>
      </div>
      <div className="flex items-start gap-3">
        <PartnerAvatar partner={partner} onUpload={onUpload} uploading={uploading} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#5E7CFF]">Current balance</p>
          <p className="mt-1 text-2xl font-black text-[#5E7CFF]">{formatBDT(Number(partner.currentBalance))}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-[var(--admin-text-secondary)]">Invested</dt><dd className="font-black">{formatBDT(Number(partner.totalInvestment))}</dd></div>
        <div><dt className="text-[var(--admin-text-secondary)]">Withdrawn</dt><dd className="font-black">{formatBDT(Number(partner.totalWithdrawal))}</dd></div>
        <div><dt className="text-[var(--admin-text-secondary)]">Profit share</dt><dd className="font-black text-emerald-700">{formatBDT(Number(partner.totalProfitShare))}</dd></div>
        <div><dt className="text-[var(--admin-text-secondary)]">Expense share</dt><dd className="font-black text-amber-800">{formatBDT(Number(partner.totalExpenseShare))}</dd></div>
      </dl>

      {investments.length > 0 ? (
        <div className="mt-4 border-t border-black/5 pt-3">
          <p className="admin-kpi__label">Recent investments</p>
          <div className="mt-2 space-y-1.5">
            {investments.slice(0, 3).map((inv) => (
              <div key={inv.id} className="flex justify-between text-xs">
                <span className="truncate text-[var(--admin-text-secondary)]">{inv.note ?? 'Investment'}</span>
                <span className="font-black text-emerald-700">{formatBDT(inv.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        <label className="admin-field">
          <span className="admin-kpi__label">Name</span>
          <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="admin-field">
          <span className="admin-kpi__label">Email</span>
          <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="admin-field">
          <span className="admin-kpi__label">Phone</span>
          <input className="admin-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      </div>

      <AdminButton variant="gold" className="mt-4 w-full" loading={saving} onClick={() => onSave({ name: name.trim(), email: email.trim(), phone: phone.trim() })}>
        Save profile
      </AdminButton>
    </article>
  )
}

export function PartnerAccountsPage(props: ModuleContextProps) {
  return <PartnerHubPage {...props} />
}

export function ExpensesPanel(props: ModuleContextProps) {
  return <PartnerHubPage {...props} moduleHref="/dashboard/finance/expenses" />
}

export function InvestmentsPanel(props: ModuleContextProps) {
  return <PartnerHubPage {...props} moduleHref="/dashboard/finance/investments" />
}

export function WithdrawalsPanel(props: ModuleContextProps) {
  return <PartnerHubPage {...props} moduleHref="/dashboard/finance/withdrawals" />
}

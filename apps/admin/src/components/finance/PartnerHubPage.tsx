import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
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
  XCircle,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { FONT } from '@/components/dc/tokens'
import { PartnerSetupCard } from '@/components/finance/PartnerSetupCard'
import { toastFail, toastOk, toastApiSaved } from '@/lib/admin/feedback'
import { verifyNumberEquals, verifyPersisted, verifyStringEquals } from '@/lib/admin/mutation-verify'
import {
  approveExpense,
  approveTransaction,
  createExpense,
  createPartnerTransaction,
  fetchExpenses,
  fetchPartnerHub,
  fetchPartnerTransactions,
  rejectTransaction,
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

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `600 11px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}
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
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={{
          borderRadius: 12,
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
        }}
      >
        {partner.avatarUrl ? (
          <Image src={partner.avatarUrl} alt={partner.name} width={size} height={size} className="h-full w-full object-cover" unoptimized />
        ) : (
          <span style={{ font: `600 16px/1 ${FONT}`, color: 'var(--ink-2)' }}>{initials}</span>
        )}
      </div>
      {onUpload ? (
        <>
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center disabled:opacity-60"
            style={{
              borderRadius: 999,
              border: '1px solid var(--line)',
              background: 'var(--violet-solid)',
              color: 'var(--on-violet)',
            }}
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
  tone = 'var(--violet)',
}: {
  label: string
  value: string
  sub?: string
  icon: typeof Wallet
  tone?: string
}) {
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: tone }} />
        <span style={capsLabel}>{label}</span>
      </div>
      <p style={{ margin: '8px 0 0', font: `600 20px/1.2 ${FONT}`, color: 'var(--ink)' }}>{value}</p>
      {sub ? (
        <p style={{ margin: '4px 0 0', font: `600 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</p>
      ) : null}
    </div>
  )
}

function demandBadge(item: InventoryItem) {
  if (item.soldCount >= 10) return { label: 'Best seller', bg: 'var(--ok-soft)', fg: 'var(--ok)', bd: 'var(--ok-bd)' }
  if (item.viewCount >= 50) return { label: 'High demand', bg: 'var(--warn-soft)', fg: 'var(--warn)', bd: 'var(--warn-bd)' }
  if (item.stock === 0) return { label: 'Out of stock', bg: 'var(--bad-soft)', fg: 'var(--bad)', bd: 'var(--bad-bd)' }
  if (item.stock <= 5) return { label: 'Low stock', bg: 'var(--warn-soft)', fg: 'var(--warn)', bd: 'var(--warn-bd)' }
  return { label: 'Stable', bg: 'var(--surface-2)', fg: 'var(--ink-3)', bd: 'var(--line)' }
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
    () => [...partners].sort((a, b) => a.name.localeCompare(b.name)),
    [partners],
  )

  const pendingWithdrawals = useMemo(
    () => ledger.filter((row) => row.type === 'WITHDRAWAL' && row.status === 'PENDING'),
    [ledger],
  )

  const partnerLabel = useMemo(
    () => (partners.length ? partners.map((p) => p.name).join(' · ') : 'Partner ledger'),
    [partners],
  )

  const handleAvatarUpload = async (partner: PartnerAccount, file: File) => {
    setUploadingSlug(partner.slug)
    try {
      const uploaded = await uploadAdminImage(file, 'partners')
      const url = uploaded.url
      const saved = await updatePartnerProfile(partner.slug, { avatarUrl: url })
      if (!verifyStringEquals(saved.avatarUrl, url, 'Partner photo')) return
      toastApiSaved(`${partner.name} photo`)
      loadAll()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingSlug(null)
    }
  }

  const handleSaveProfile = async (partner: PartnerAccount, patch: { name: string; email: string; phone: string }) => {
    setSavingSlug(partner.slug)
    try {
      const saved = await updatePartnerProfile(partner.slug, patch)
      if (!verifyStringEquals(saved.name, patch.name, 'Partner name')) return
      if (!verifyStringEquals(saved.email ?? '', patch.email, 'Partner email')) return
      if (!verifyStringEquals(saved.phone ?? '', patch.phone, 'Partner phone')) return
      toastApiSaved(`${partner.name} profile`)
      loadAll()
    } catch {
      toastFail('Could not save profile')
    } finally {
      setSavingSlug(null)
    }
  }

  const handleCreateExpense = async () => {
    const amount = Number(expenseForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toastFail('Enter a valid amount')
      return
    }
    if (!expenseForm.note.trim()) {
      toastFail('Write why this expense was made')
      return
    }
    const note = expenseForm.note.trim()
    try {
      const created = await createExpense({
        category: expenseForm.category,
        amount,
        note,
        ...(expenseForm.partnerId ? { partnerId: expenseForm.partnerId } : {}),
        createdBy: 'admin',
      })
      if (!verifyNumberEquals(created.amount, amount, 'Expense amount')) return
      if (!verifyStringEquals(created.note ?? '', note, 'Expense note')) return
      if (!verifyPersisted(created.status === 'PENDING', 'Expense status')) return
      toastOk('Expense recorded — pending approval')
      setExpenseForm({ category: 'OTHER_EXPENSE', amount: '', note: '', partnerId: '' })
      loadAll()
    } catch {
      toastFail('Could not save expense')
    }
  }

  const handleApproveExpense = async (id: string) => {
    try {
      const approved = await approveExpense(id, 'admin')
      if (!verifyPersisted(approved.status === 'APPROVED', 'Expense approval did not persist on server')) return
      toastOk('Expense approved — partner balances updated')
      loadAll()
    } catch {
      toastFail('Could not approve expense')
    }
  }

  const handleCreateTxn = async (type: 'INVESTMENT' | 'WITHDRAWAL') => {
    const amount = Number(txnForm.amount)
    if (!txnForm.partnerId || !Number.isFinite(amount) || amount <= 0) {
      toastFail('Select partner and valid amount')
      return
    }
    if (type === 'WITHDRAWAL') {
      const partner = partners.find((p) => p.id === txnForm.partnerId)
      if (partner && Number(partner.currentBalance) < amount) {
        toastFail(`${partner.name} এর balance ${formatBDT(Number(partner.currentBalance))} — এত টাকা তোলা যাবে না`)
        return
      }
    }
    try {
      const created = await createPartnerTransaction({
        partnerId: txnForm.partnerId,
        type,
        amount,
        note: txnForm.note.trim() || undefined,
        createdBy: 'admin',
      })
      if (!verifyStringEquals(created.type, type, 'Transaction type')) return
      if (!verifyNumberEquals(created.amount, amount, 'Transaction amount')) return
      if (type === 'WITHDRAWAL') {
        if (!verifyPersisted(created.status === 'PENDING', 'Withdrawal status')) return
        toastOk('Withdrawal request পাঠানো হয়েছে — approval এর পর balance কাটা হবে')
      } else {
        if (!verifyPersisted(created.status === 'APPROVED', 'Investment status')) return
        toastApiSaved('Investment')
      }
      setTxnForm({ partnerId: '', amount: '', note: '' })
      loadAll()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not record transaction')
    }
  }

  const handleApproveTxn = async (id: string) => {
    try {
      const approved = await approveTransaction(id, 'admin')
      if (!verifyPersisted(approved.status === 'APPROVED', 'Transaction approval did not persist on server')) return
      toastApiSaved('Transaction approval')
      loadAll()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not approve')
    }
  }

  const handleRejectTxn = async (id: string) => {
    const reason = window.prompt('Reject reason (optional)') ?? 'Rejected by admin'
    try {
      const rejected = await rejectTransaction(id, reason, 'admin')
      if (!verifyPersisted(rejected.status === 'REJECTED', 'Transaction rejection did not persist on server')) return
      toastApiSaved('Transaction rejection')
      loadAll()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not reject')
    }
  }

  if (loading) {
    return (
      <div
        className="h-56 animate-pulse"
        style={{ borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--line)' }}
      />
    )
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
    <div className="dc-partner-body space-y-5" style={{ fontFamily: FONT }}>
      {!apiOnline ? (
        <div
          style={{
            ...card,
            padding: '12px 14px',
            borderColor: 'var(--warn-bd)',
            background: 'var(--warn-soft)',
            backgroundImage: 'none',
          }}
        >
          <p className="flex items-center gap-2" style={{ margin: 0, font: `600 12px/1.4 ${FONT}`, color: 'var(--warn)' }}>
            <WifiOff className="h-4 w-4" />
            API offline — start backend on port 4000. No fake data is shown.
          </p>
        </div>
      ) : null}

      <section className="dc-partner-intro" style={{ ...card, padding: '14px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <p className="dc-partner-intro__eyebrow" style={{ ...capsLabel, margin: 0 }}>{partnerLabel}</p>
          <p className="dc-partner-intro__copy" style={{ margin: '8px 0 0', maxWidth: '42rem', font: `500 13px/1.45 ${FONT}`, color: 'var(--ink-2)' }}>
            Protteker alada hisab, investment, stock value, profit/loss — sob live database theke. Apni je partner add korben, shei naam ekhane dekhabe.
          </p>
        </div>
        <AdminButton variant="accent" onClick={loadAll}>
          <RefreshCw className="h-4 w-4" />
          Refresh live data
        </AdminButton>
      </section>

      {partners.length === 0 ? (
        <PartnerSetupCard partners={[]} onUpdated={loadAll} />
      ) : null}

      {totals && partners.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <KpiTile label="Combined balance" value={formatBDT(totals.combinedBalance)} icon={Wallet} />
          <KpiTile label="Total invested" value={formatBDT(totals.totalInvested)} icon={TrendingUp} tone="var(--ok)" />
          <KpiTile label="Stock value (cost)" value={formatBDT(inv?.totalCostValue ?? 0)} sub={`${inv?.totalUnits ?? 0} units`} icon={Package} tone="var(--ink-2)" />
          <KpiTile label="Stock value (retail)" value={formatBDT(inv?.totalRetailValue ?? 0)} sub={`${inv?.productCount ?? 0} products`} icon={Package} />
          <KpiTile label="Monthly net profit" value={formatBDT(totals.monthlyNetProfit)} sub={`Revenue ${formatBDT(totals.monthlyRevenue)}`} icon={BarChart3} tone={totals.monthlyNetProfit >= 0 ? 'var(--ok)' : 'var(--bad)'} />
          <KpiTile label="Weekly net profit" value={formatBDT(totals.weeklyNetProfit)} icon={Clock} />
        </div>
      ) : null}

      {partners.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 34,
                padding: '0 12px',
                borderRadius: 9,
                border: `1px solid ${active ? 'var(--violet-bd)' : 'var(--line)'}`,
                background: active ? 'var(--violet-soft)' : 'var(--surface)',
                color: active ? 'var(--violet)' : 'var(--ink-2)',
                font: `600 12px/1 ${FONT}`,
                cursor: 'pointer',
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          )
        })}
      </div>
      ) : null}

      {tab === 'overview' && hub ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {sortedPartners.map((partner) => (
              <div key={partner.id} style={{ ...card, padding: '14px 16px' }}>
                <div className="flex items-center gap-3">
                  <PartnerAvatar partner={partner} size={48} />
                  <div>
                    <p style={{ margin: 0, font: `600 16px/1.3 ${FONT}`, color: 'var(--ink)' }}>{partner.name}</p>
                    <p style={{ margin: '2px 0 0', font: `600 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>{Number(partner.sharePercent)}% share · alada hisab</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2" style={{ font: `500 12px/1.35 ${FONT}` }}>
                  <div><p style={{ margin: 0, color: 'var(--ink-3)' }}>Balance</p><p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--violet)' }}>{formatBDT(Number(partner.currentBalance))}</p></div>
                  <div><p style={{ margin: 0, color: 'var(--ink-3)' }}>Invested</p><p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--ink)' }}>{formatBDT(Number(partner.totalInvestment))}</p></div>
                  <div><p style={{ margin: 0, color: 'var(--ink-3)' }}>Profit share</p><p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--ok)' }}>{formatBDT(Number(partner.totalProfitShare))}</p></div>
                  <div><p style={{ margin: 0, color: 'var(--ink-3)' }}>Expense share</p><p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--warn)' }}>{formatBDT(Number(partner.totalExpenseShare))}</p></div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section style={{ ...card, padding: '14px 16px' }}>
              <h3 style={{ margin: 0, font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>Recent investments — ke koto invest korlo</h3>
              {hub.recentInvestments.length === 0 ? (
                <p style={{ margin: '10px 0 0', font: `600 13px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>No investments recorded yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {hub.recentInvestments.slice(0, 8).map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between px-3 py-2.5"
                      style={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface-2)' }}
                    >
                      <div>
                        <p style={{ margin: 0, font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>{row.partner?.name ?? '—'}</p>
                        <p style={{ margin: '2px 0 0', font: `500 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>{row.note ?? 'Investment'} · {new Date(row.date).toLocaleDateString('en-BD')}</p>
                      </div>
                      <p style={{ margin: 0, font: `600 13px/1 ${FONT}`, color: 'var(--ok)' }}>{formatBDT(row.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={{ ...card, padding: '14px 16px' }}>
              <h3 style={{ margin: 0, font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>Expense breakdown — kothay khoroch</h3>
              {hub.expensesByCategory.length === 0 ? (
                <p style={{ margin: '10px 0 0', font: `600 13px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>No approved expenses yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {hub.expensesByCategory.map((e) => (
                    <div key={e.category} className="flex items-center justify-between" style={{ font: `600 13px/1.3 ${FONT}` }}>
                      <span style={{ color: 'var(--ink)', textTransform: 'capitalize' }}>{e.category.replace(/_/g, ' ').toLowerCase()}</span>
                      <span style={{ color: 'var(--violet)' }}>{formatBDT(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'partners' ? (
        <div className="space-y-4">
          {sortedPartners.length === 0 ? (
            <PartnerSetupCard partners={[]} onUpdated={loadAll} />
          ) : (
            <>
              <PartnerSetupCard partners={partners} onUpdated={loadAll} />
              <div className="grid gap-4 lg:grid-cols-3">
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
            </>
          )}
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
          <section className="dc-partner-table-wrap">
            <div className="border-b border-black/5 px-4 py-3">
              <p className="admin-kpi__label">Live inventory · {hub.inventory.items.length} products</p>
            </div>
            <div className="overflow-x-auto">
              <table className="dc-partner-table">
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
                        <td className="font-semibold">{item.stock}</td>
                        <td>{formatBDT(item.costValue)}</td>
                        <td>{formatBDT(item.retailValue)}</td>
                        <td>{item.soldCount}</td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              borderRadius: 8,
                              padding: '3px 8px',
                              font: `600 10px/1 ${FONT}`,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              background: badge.bg,
                              color: badge.fg,
                              border: `1px solid ${badge.bd}`,
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>
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
        <section className="dc-partner-table-wrap">
          <div className="border-b border-black/5 px-4 py-3">
            <p className="admin-kpi__label">Top products by demand — kon product bhalo cholche</p>
          </div>
          <div className="overflow-x-auto">
            <table className="dc-partner-table">
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
                      <td className="font-semibold text-[var(--violet)]">{idx + 1}</td>
                      <td className="font-semibold">{item.name}</td>
                      <td className="font-semibold">{item.soldCount}</td>
                      <td>{item.viewCount}</td>
                      <td>{item.stock}</td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            borderRadius: 8,
                            padding: '3px 8px',
                            font: `600 10px/1 ${FONT}`,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            background: badge.bg,
                            color: badge.fg,
                            border: `1px solid ${badge.bd}`,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {hub.topProducts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm font-semibold text-[var(--ink-2)]">No products in catalog yet.</p>
          ) : null}
        </section>
      ) : null}

      {tab === 'profit' && hub && monthly ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="dc-partner-card">
              <h3 className="dc-partner-card__title">This month — labh / loss</h3>
              <p className={cn('mt-2 text-3xl font-semibold', monthly.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                {formatBDT(monthly.netProfit)}
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--ink-2)]">{hub.profitLoss.monthly.orderCount} delivered orders counted</p>
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
                    <dd className={cn('font-semibold', Number(val) < 0 ? 'text-red-600' : '')}>{formatBDT(Math.abs(Number(val)))}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="dc-partner-card">
              <h3 className="dc-partner-card__title">This week</h3>
              <p className={cn('mt-2 text-3xl font-semibold', (weekly?.netProfit ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                {formatBDT(weekly?.netProfit ?? 0)}
              </p>
              <p className="mt-4 text-sm font-semibold text-[var(--ink-2)]">
                Profit calculates automatically when orders are marked DELIVERED. No fake numbers.
              </p>
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'expenses' ? (
        <div className="space-y-4">
          <section className="dc-partner-card">
            <h3 className="dc-partner-card__title">Record expense</h3>
            <p className="dc-partner-card__sub mb-4">Ke kothay koto taka khoroch — ken khoroch korlo tar note likhun.</p>
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
            <AdminButton variant="accent" className="mt-4" onClick={handleCreateExpense}>
              <Plus className="h-4 w-4" />
              Add expense
            </AdminButton>
          </section>

          <section className="dc-partner-table-wrap">
            <div className="border-b border-black/5 px-4 py-3">
              <p className="admin-kpi__label">Live expenses · {expenses.length}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="dc-partner-table">
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
                      <td className="font-semibold">{formatBDT(Number(row.amount))}</td>
                      <td>
                        <span className={cn('admin-status', row.status === 'APPROVED' ? 'admin-status--delivered' : 'admin-status--pending')}>
                          {row.status.toLowerCase()}
                        </span>
                      </td>
                      <td>
                        {row.status === 'PENDING' ? (
                          <AdminButton variant="accent" size="sm" onClick={() => handleApproveExpense(row.id)}>
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
        <div className="space-y-4">
          {tab === 'withdraw' && pendingWithdrawals.length > 0 ? (
            <section className="dc-partner-card dc-partner-card--warn">
              <h3 className="dc-partner-card__title">Pending withdrawals — approval লাগবে</h3>
              <p className="dc-partner-card__sub mb-4">
                Withdrawal approve না করা পর্যন্ত balance কাটা হবে না।
              </p>
              <div className="space-y-2">
                {pendingWithdrawals.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink)]">
                        {row.partner?.name ?? 'Partner'} — {formatBDT(Number(row.amount))}
                      </p>
                      <p className="text-xs text-[var(--ink-3)]">{row.note ?? 'No note'}</p>
                    </div>
                    <div className="flex gap-2">
                      <AdminButton size="sm" variant="accent" onClick={() => void handleApproveTxn(row.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </AdminButton>
                      <AdminButton size="sm" variant="ghost" onClick={() => void handleRejectTxn(row.id)}>
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </AdminButton>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="dc-partner-card max-w-xl">
            <h3 className="dc-partner-card__title">{tab === 'invest' ? 'Partner investment' : 'Partner withdrawal'}</h3>
            <p className="dc-partner-card__sub mb-4">
              {tab === 'invest'
                ? 'Capital add korle turant balance update hobe.'
                : 'Withdrawal request pending thakbe — approve korar por balance katabe.'}
            </p>
            {partners.length === 0 ? (
              <p className="text-sm font-semibold text-[var(--ink-2)]">আগে partner যোগ করুন Partners tab থেকে।</p>
            ) : (
              <div className="space-y-3">
                <label className="admin-field">
                  <span className="admin-kpi__label">Partner</span>
                  <select className="admin-input" value={txnForm.partnerId} onChange={(e) => setTxnForm((f) => ({ ...f, partnerId: e.target.value }))}>
                    <option value="">Select partner</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {formatBDT(Number(p.currentBalance))}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span className="admin-kpi__label">Amount (৳)</span>
                  <input className="admin-input" type="number" min="0" value={txnForm.amount} onChange={(e) => setTxnForm((f) => ({ ...f, amount: e.target.value }))} />
                </label>
                <label className="admin-field">
                  <span className="admin-kpi__label">Note — kothay / keno</span>
                  <input className="admin-input" placeholder="e.g. bKash payout, initial stock" value={txnForm.note} onChange={(e) => setTxnForm((f) => ({ ...f, note: e.target.value }))} />
                </label>
                <AdminButton variant="accent" onClick={() => handleCreateTxn(tab === 'invest' ? 'INVESTMENT' : 'WITHDRAWAL')}>
                  {tab === 'invest' ? 'Save investment' : 'Request withdrawal'}
                </AdminButton>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'ledger' ? (
        <section className="dc-partner-table-wrap">
          <div className="border-b border-black/5 px-4 py-3">
            <p className="admin-kpi__label">Partner ledger · {ledger.length} entries</p>
          </div>
          <div className="overflow-x-auto">
            <table className="dc-partner-table">
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
                    <td className="font-semibold">{formatBDT(Number(row.amount))}</td>
                    <td>
                      {row.status === 'PENDING' ? (
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-700"
                            onClick={() => void handleApproveTxn(row.id)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-600"
                            onClick={() => void handleRejectTxn(row.id)}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className={cn('admin-status', row.status === 'APPROVED' ? 'admin-status--delivered' : 'admin-status--pending')}>
                          {row.status.toLowerCase()}
                        </span>
                      )}
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
    <article className="dc-partner-card flex flex-col">
      <div className="mb-3 border-b border-black/5 pb-3">
        <h2 className="text-2xl font-semibold tracking-wide text-[var(--ink)]">{partner.name}</h2>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)]">
          Alada hisab · {Number(partner.sharePercent)}% share
        </p>
      </div>
      <div className="flex items-start gap-3">
        <PartnerAvatar partner={partner} onUpload={onUpload} uploading={uploading} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--violet)]">Current balance</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--violet)]">{formatBDT(Number(partner.currentBalance))}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-[var(--ink-2)]">Invested</dt><dd className="font-semibold">{formatBDT(Number(partner.totalInvestment))}</dd></div>
        <div><dt className="text-[var(--ink-2)]">Withdrawn</dt><dd className="font-semibold">{formatBDT(Number(partner.totalWithdrawal))}</dd></div>
        <div><dt className="text-[var(--ink-2)]">Profit share</dt><dd className="font-semibold text-emerald-700">{formatBDT(Number(partner.totalProfitShare))}</dd></div>
        <div><dt className="text-[var(--ink-2)]">Expense share</dt><dd className="font-semibold text-amber-800">{formatBDT(Number(partner.totalExpenseShare))}</dd></div>
      </dl>

      {investments.length > 0 ? (
        <div className="mt-4 border-t border-black/5 pt-3">
          <p className="admin-kpi__label">Recent investments</p>
          <div className="mt-2 space-y-1.5">
            {investments.slice(0, 3).map((inv) => (
              <div key={inv.id} className="flex justify-between text-xs">
                <span className="truncate text-[var(--ink-2)]">{inv.note ?? 'Investment'}</span>
                <span className="font-semibold text-emerald-700">{formatBDT(inv.amount)}</span>
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

      <AdminButton variant="accent" className="mt-4 w-full" loading={saving} onClick={() => onSave({ name: name.trim(), email: email.trim(), phone: phone.trim() })}>
        Save profile
      </AdminButton>
    </article>
  )
}

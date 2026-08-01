'use client'

import { useMemo, useState } from 'react'
import { Percent, Plus, Save, UserPlus, Users } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { toastFail, toastOk } from '@/lib/admin/feedback'
import {
  createPartner,
  updatePartnerShares,
  type PartnerAccount,
} from '@/lib/api/finance'
import { cn } from '@/lib/utils/cn'

interface PartnerSetupCardProps {
  partners: PartnerAccount[]
  onUpdated: () => void
  compact?: boolean
}

export function PartnerSetupCard({ partners, onUpdated, compact }: PartnerSetupCardProps) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sharePercent, setSharePercent] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [shareDraft, setShareDraft] = useState<Record<string, string>>({})
  const [savingShares, setSavingShares] = useState(false)

  const shareTotal = useMemo(() => {
    if (partners.length === 0) return Number(sharePercent) || 0
    return partners.reduce((sum, p) => {
      const raw = shareDraft[p.id] ?? String(p.sharePercent)
      const n = Number(raw)
      return sum + (Number.isFinite(n) ? n : 0)
    }, 0)
  }, [partners, shareDraft, sharePercent])

  const shareValid = Math.abs(shareTotal - 100) < 0.05

  const derivedPartnerName = useMemo(() => {
    const e = email.trim().toLowerCase()
    if (e.includes('@')) {
      const local = e.split('@')[0] ?? ''
      const cleaned = local.replace(/[^a-z0-9]+/g, ' ').trim()
      const parts = cleaned.split(/\s+/).filter(Boolean)
      if (parts.length > 0) {
        const titled = parts.map((p) => p.slice(0, 1).toUpperCase() + p.slice(1)).join(' ')
        if (titled.trim().length >= 2) return titled.trim()
      }
    }

    const digits = phone.replace(/\D/g, '')
    if (digits.length >= 4) return `Partner ${digits.slice(-4)}`

    return 'Partner'
  }, [email, phone])

  const handleAddPartner = async () => {
    const displayName = derivedPartnerName.trim()
    if (displayName.length < 2) {
      toastFail('Partner name derive kora jacche na — email/phone diye চেষ্টা করুন')
      return
    }
    const share = Number(sharePercent)
    if (!Number.isFinite(share) || share <= 0 || share > 100) {
      toastFail('Share % ১–১০০ এর মধ্যে দিন')
      return
    }

    setSaving(true)
    try {
      const created = await createPartner({
        name: displayName,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        sharePercent: share,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        createdBy: 'admin',
      })
      if (created.name.trim() !== displayName) {
        toastFail('Partner save did not persist on server')
        return
      }
      toastOk(`${displayName} partner হিসেবে যোগ হয়েছে`)
      setEmail('')
      setPhone('')
      setSharePercent('')
      setNotes('')
      onUpdated()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Partner যোগ করা যায়নি')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveShares = async () => {
    if (!shareValid) {
      toastFail(`Share মোট ১০০% হতে হবে — এখন ${shareTotal.toFixed(1)}%`)
      return
    }
    setSavingShares(true)
    try {
      const saved = await updatePartnerShares(
        partners.map((p) => ({
          partnerId: p.id,
          sharePercent: Number(shareDraft[p.id] ?? p.sharePercent),
        })),
        'admin',
      )
      const mismatch = partners.some((p) => {
        const expected = Number(shareDraft[p.id] ?? p.sharePercent)
        const got = saved.find((row) => row.id === p.id)?.sharePercent
        return Number(got) !== expected
      })
      if (mismatch) {
        toastFail('Share % did not persist on server')
        return
      }
      toastOk('Partner share % সেভ হয়েছে')
      onUpdated()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Share সেভ করা যায়নি')
    } finally {
      setSavingShares(false)
    }
  }

  if (partners.length === 0) {
    return (
      <section className="dc-partner-setup-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--violet)]">
              Partner setup
            </p>
            <h3 className="mt-1 text-xl font-black text-[var(--ink)]">আপনার partner যোগ করুন</h3>
            <p className="mt-2 max-w-lg text-sm font-medium text-[var(--ink-2)]">
              আগে থেকে partner name দরকার নেই — email/phone (এবং agreement notes) দিয়ে partner তৈরি হবে, এরপর share % বসাবেন। Finance tracking তখনই শুরু হবে।
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--violet-soft)]">
            <Users className="h-6 w-6 text-[var(--violet)]" />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="admin-field md:col-span-2">
            <span className="admin-kpi__label">Partner (auto)</span>
            <div className="admin-input" style={{ padding: '10px 12px' }} aria-label="Derived partner name">
              {derivedPartnerName}
            </div>
            <p className="mt-2 text-xs font-semibold text-[var(--ink-3)]">
              Derived from email/phone. Agreement/terms নিচে দিন।
            </p>
          </div>
          <label className="admin-field">
            <span className="admin-kpi__label">Profit share % *</span>
            <input
              className="admin-input"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              placeholder="33.33"
              value={sharePercent}
              onChange={(e) => setSharePercent(e.target.value)}
            />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">Phone (optional)</span>
            <input
              className="admin-input"
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">Email (optional)</span>
            <input
              className="admin-input"
              type="email"
              placeholder="partner@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">Agreement / terms (optional)</span>
            <textarea
              className="admin-input min-h-[110px] resize-y"
              placeholder="Partner agreement text, responsibilities, payout terms, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <AdminButton variant="accent" className="mt-5" loading={saving} onClick={() => void handleAddPartner()}>
          <UserPlus className="h-4 w-4" />
          প্রথম partner যোগ করুন
        </AdminButton>
      </section>
    )
  }

  if (compact) return null

  return (
    <section className="dc-partner-setup-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--ink-3)]">
            Add another partner
          </p>
          <h3 className="text-sm font-black text-[var(--ink)]">নতুন partner</h3>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase',
            shareValid
              ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/12 text-amber-800 dark:text-amber-300',
          )}
        >
          <Percent className="h-3 w-3" />
          Total share: {shareTotal.toFixed(1)}%
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="admin-field">
          <span className="admin-kpi__label">Email</span>
          <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partner@email.com" />
          <p className="mt-2 text-xs font-semibold text-[var(--ink-3)]">
            Auto partner name: {derivedPartnerName}
          </p>
        </label>
        <label className="admin-field">
          <span className="admin-kpi__label">Share %</span>
          <input
            className="admin-input"
            type="number"
            min="0.01"
            max="100"
            value={sharePercent}
            onChange={(e) => setSharePercent(e.target.value)}
          />
        </label>
        <label className="admin-field">
          <span className="admin-kpi__label">Phone</span>
          <input className="admin-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="admin-field flex items-end">
          <AdminButton variant="accent" className="w-full" loading={saving} onClick={() => void handleAddPartner()}>
            <Plus className="h-4 w-4" />
            Add
          </AdminButton>
        </label>
      </div>

      <label className="admin-field">
        <span className="admin-kpi__label">Agreement / terms (optional)</span>
        <textarea
          className="admin-input min-h-[95px] resize-y"
          placeholder="Paste partner agreement text / payout terms / responsibilities..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {partners.length >= 2 ? (
        <div className="rounded-[16px] border border-[var(--line)] bg-[var(--admin-surface)] p-4">
          <p className="admin-kpi__label mb-3">Profit share split — মোট ১০০% হতে হবে</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => (
              <label key={p.id} className="admin-field">
                <span className="admin-kpi__label">{p.name}</span>
                <input
                  className="admin-input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={p.sharePercent}
                  onChange={(e) => setShareDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <AdminButton
            variant="ghost"
            className="mt-3"
            loading={savingShares}
            disabled={!shareValid}
            onClick={() => void handleSaveShares()}
          >
            <Save className="h-4 w-4" />
            Save share split
          </AdminButton>
        </div>
      ) : null}
    </section>
  )
}

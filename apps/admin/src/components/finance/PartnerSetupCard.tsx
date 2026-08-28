'use client'

import { useMemo, useState } from 'react'
import { Percent, Save, UserPlus, Users } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import {
  createPartner,
  updatePartnerShares,
  type CreatePartnerResult,
  type PartnerAccount,
} from '@/lib/api/finance'
import { useAdminSession, usePermission } from '@/lib/api/hooks'
import {
  PERMISSION_DENIED_TITLE,
  canManagePartnerEquity,
  canManagePartnerRoster,
} from '@/lib/auth/permissions'
import { cn } from '@/lib/utils/cn'

interface PartnerSetupCardProps {
  partners: PartnerAccount[]
  onUpdated: () => void | Promise<void>
  compact?: boolean
}

function matchesPersistedPartner(
  result: CreatePartnerResult,
  name: string,
  email: string,
  sharePercent: number,
): boolean {
  return (
    result.partner.name.trim() === name &&
    result.partner.email?.trim().toLowerCase() === email &&
    Number(result.partner.sharePercent) === sharePercent &&
    result.partner.inviteStatus?.toUpperCase() === 'INVITED' &&
    Boolean(result.partner.inviteSentAt)
  )
}

export function PartnerSetupCard({ partners, onUpdated, compact }: PartnerSetupCardProps) {
  const session = useAdminSession()
  const canCreateFinance = usePermission('finance', 'create')
  const canAddPartner = canManagePartnerRoster(session.data?.role) && canCreateFinance
  const canEditEquity = canManagePartnerEquity(session.data?.role)

  const [fullName, setFullName] = useState('')
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

  const handleAddPartner = async () => {
    if (!canAddPartner) {
      toastFail(PERMISSION_DENIED_TITLE)
      return
    }
    const name = fullName.trim()
    if (name.length < 2) {
      toastFail('Enter the partner’s full name')
      return
    }
    const mail = email.trim().toLowerCase()
    if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      toastFail('Enter a valid email — invite will be sent here')
      return
    }
    const share = Number(sharePercent)
    if (!Number.isFinite(share) || share <= 0 || share > 100) {
      toastFail('Equity share must be between 1 and 100')
      return
    }

    setSaving(true)
    try {
      const result = await createPartner({
        name,
        email: mail,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        sharePercent: share,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        createdBy: 'admin',
      })
      if (!matchesPersistedPartner(result, name, mail, share)) {
        toastFail('Partner or invite state did not persist on server')
        return
      }
      toastOk(`${name} added to partner roster`)
      if (!result.inviteEmailSent) {
        toastWarn('Invite email not sent — check SMTP in Settings, then Resend invite')
      } else {
        toastOk(`Confirmation email sent to ${mail}`)
      }
      setFullName('')
      setEmail('')
      setPhone('')
      setSharePercent('')
      setNotes('')
      await onUpdated()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not add partner')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveShares = async () => {
    if (!canEditEquity) {
      toastFail(`${PERMISSION_DENIED_TITLE} — only Owner can change equity shares`)
      return
    }
    if (!shareValid) {
      toastFail(`Equity shares must total 100% — currently ${shareTotal.toFixed(1)}%`)
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
      toastOk('Equity shares saved')
      await onUpdated()
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not save shares')
    } finally {
      setSavingShares(false)
    }
  }

  if (!canAddPartner && partners.length < 2) {
    return (
      <section
        className={cn('dc-partner-setup-card', compact && 'dc-partner-setup-card--compact')}
        style={{
          border: '1px solid var(--line)',
          borderRadius: 14,
          background: 'var(--surface)',
          padding: compact ? '16px 18px' : '20px 22px',
        }}
      >
        <p className="text-sm font-medium text-[var(--ink-2)]">
          {PERMISSION_DENIED_TITLE} — only Owner or Admin can add equity partners.
        </p>
      </section>
    )
  }

  return (
    <section
      className={cn('dc-partner-setup-card', compact && 'dc-partner-setup-card--compact')}
      style={{
        border: '1px solid var(--line)',
        borderRadius: 14,
        background: 'var(--surface)',
        backgroundImage: 'var(--card-sheen)',
        padding: compact ? '16px 18px' : '20px 22px',
      }}
    >
      {canAddPartner ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--violet)]">
                Add partner
              </p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--ink)]">Invite to the equity roster</h3>
              <p className="mt-2 max-w-lg text-sm font-medium text-[var(--ink-2)]">
                Enter legal full name and email. A confirmation email is sent on save. Equity shares across
                all partners should total 100%.
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--violet-soft)]">
              <Users className="h-6 w-6 text-[var(--violet)]" />
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="admin-field md:col-span-2">
              <span className="admin-kpi__label">Full name *</span>
              <input
                className="admin-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Md. Sourove Ahmed"
                autoComplete="name"
              />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Email *</span>
              <input
                className="admin-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@example.com"
                autoComplete="email"
              />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Phone</span>
              <input
                className="admin-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                autoComplete="tel"
              />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Equity share % *</span>
              <div className="relative">
                <input
                  className="admin-input pr-10"
                  inputMode="decimal"
                  value={sharePercent}
                  onChange={(e) => setSharePercent(e.target.value)}
                  placeholder="33.33"
                />
                <Percent className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
              </div>
            </label>
            <label className="admin-field md:col-span-2">
              <span className="admin-kpi__label">Notes / agreement</span>
              <textarea
                className="admin-input min-h-[72px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional partnership terms"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <AdminButton variant="accent" disabled={saving} onClick={() => void handleAddPartner()}>
              <UserPlus className="h-4 w-4" />
              {saving ? 'Adding…' : 'Add partner & send invite'}
            </AdminButton>
          </div>
        </>
      ) : null}

      {partners.length >= 2 ? (
        <div className={cn(canAddPartner && 'mt-8 border-t border-[var(--line)] pt-5')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--ink-3)]">
                Equity split
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--ink-2)]">
                {canEditEquity
                  ? 'Adjust shares so the total is exactly 100%.'
                  : 'Only Owner can change equity shares. Current split is shown below.'}
              </p>
            </div>
            <p
              className={cn(
                'text-sm font-semibold',
                shareValid ? 'text-[var(--ok)]' : 'text-[var(--warn)]',
              )}
            >
              Total {shareTotal.toFixed(2)}%
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => (
              <label key={p.id} className="admin-field">
                <span className="admin-kpi__label">{p.name}</span>
                <input
                  className="admin-input"
                  inputMode="decimal"
                  value={shareDraft[p.id] ?? String(p.sharePercent)}
                  onChange={(e) => setShareDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                  disabled={!canEditEquity}
                  readOnly={!canEditEquity}
                />
              </label>
            ))}
          </div>
          {canEditEquity ? (
            <div className="mt-4">
              <AdminButton
                variant="ghost"
                disabled={savingShares || !shareValid}
                onClick={() => void handleSaveShares()}
              >
                <Save className="h-4 w-4" />
                {savingShares ? 'Saving…' : 'Save equity shares'}
              </AdminButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

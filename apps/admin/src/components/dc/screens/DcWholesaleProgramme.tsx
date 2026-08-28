'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, toneStyle } from '@/components/dc/tokens'
import { toastApiSaved, toastFail, toastWarn } from '@/lib/admin/feedback'
import {
  createWholesaleTier,
  deleteWholesaleTier,
  fetchWholesaleTiers,
  updateWholesaleTier,
  type ApiWholesaleTier,
} from '@/lib/api/wholesale'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `700 10.5px/1 ${FONT}`,
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

const field = {
  height: 34,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  font: `500 12.5px/1 ${FONT}`,
  width: '100%',
} as const

interface Draft {
  name: string
  minUnits: string
  leadTimeDays: string
  summary: string
  perks: string
  sortOrder: string
  isActive: boolean
}

const EMPTY_DRAFT: Draft = {
  name: '',
  minUnits: '',
  leadTimeDays: '',
  summary: '',
  perks: '',
  sortOrder: '0',
  isActive: true,
}

function toDraft(tier: ApiWholesaleTier): Draft {
  return {
    name: tier.name,
    minUnits: tier.minUnits ? String(tier.minUnits) : '',
    leadTimeDays: tier.leadTimeDays ? String(tier.leadTimeDays) : '',
    summary: tier.summary ?? '',
    perks: (tier.perks ?? []).join('\n'),
    sortOrder: String(tier.sortOrder ?? 0),
    isActive: tier.isActive,
  }
}

function draftToInput(draft: Draft) {
  return {
    name: draft.name.trim(),
    minUnits: Math.max(0, Math.floor(Number(draft.minUnits) || 0)),
    leadTimeDays: draft.leadTimeDays.trim()
      ? Math.max(0, Math.floor(Number(draft.leadTimeDays) || 0))
      : null,
    summary: draft.summary.trim(),
    perks: draft.perks
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8),
    sortOrder: Math.floor(Number(draft.sortOrder) || 0),
    isActive: draft.isActive,
  }
}

export function DcWholesaleProgramme() {
  const router = useRouter()
  return (
    <DcScreenProvider
      screen="wholesale-programme"
      onNavigate={(next) => router.push(`/dashboard/${next}`)}
    >
      <DcWholesaleProgrammeBody />
    </DcScreenProvider>
  )
}

function DcWholesaleProgrammeBody() {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<ApiWholesaleTier | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [removing, setRemoving] = useState<ApiWholesaleTier | null>(null)

  const tiers = useQuery({
    queryKey: ['wholesale-tiers'],
    queryFn: fetchWholesaleTiers,
    staleTime: 30_000,
  })
  const { api } = useAdminConnection(25_000)
  const rows = tiers.data?.tiers ?? []
  const published = rows.filter((tier) => tier.isActive).length
  const pageStatus = dcPageStatus([tiers], api.pulse)

  const afterWrite = () => {
    void qc.invalidateQueries({ queryKey: ['wholesale-tiers'] })
    void qc.invalidateQueries({ queryKey: ['wholesale-inquiries'] })
  }

  const openNew = () => {
    setDraft(EMPTY_DRAFT)
    setEditing('new')
  }

  const openEdit = (tier: ApiWholesaleTier) => {
    setDraft(toDraft(tier))
    setEditing(tier)
  }

  const save = async () => {
    const input = draftToInput(draft)
    if (input.name.length < 2) {
      toastWarn('Give the tier a name')
      return
    }
    setBusy(true)
    try {
      if (editing === 'new') {
        await createWholesaleTier(input)
        toastApiSaved(`Tier "${input.name}" created`)
      } else if (editing) {
        await updateWholesaleTier(editing.id, input)
        toastApiSaved(`Tier "${input.name}" saved`)
      }
      afterWrite()
      setEditing(null)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not save this tier')
    } finally {
      setBusy(false)
    }
  }

  const togglePublished = async (tier: ApiWholesaleTier) => {
    setBusy(true)
    try {
      await updateWholesaleTier(tier.id, { isActive: !tier.isActive })
      afterWrite()
      toastApiSaved(tier.isActive ? `"${tier.name}" hidden` : `"${tier.name}" published`)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not change this tier')
    } finally {
      setBusy(false)
    }
  }

  const runDelete = async (tier: ApiWholesaleTier) => {
    setBusy(true)
    try {
      const result = await deleteWholesaleTier(tier.id)
      afterWrite()
      setRemoving(null)
      toastApiSaved(
        result.detachedInquiries > 0
          ? `Tier deleted — ${result.detachedInquiries} enquir${
              result.detachedInquiries === 1 ? 'y keeps' : 'ies keep'
            } their history`
          : 'Tier deleted',
      )
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not delete this tier')
    } finally {
      setBusy(false)
    }
  }

  const skeleton: DcBlock[] = [{ t: 'list', title: '', items: [] } as DcBlock]

  return (
    <>
      <DcPageHead
        crumbGroup="Wholesale"
        title="Wholesale Programme"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          tiers.isFetching
            ? 'syncing…'
            : `${published} published of ${rows.length}`
        }
        syncing={tiers.isFetching}
        onSync={() => void tiers.refetch()}
        actions={[{ label: 'Add tier', icon: 'icon-plus', onClick: openNew }]}
      />

      {tiers.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : tiers.error ? (
        <DcErrorState
          error={`GET /admin/wholesale-tiers → ${
            tiers.error instanceof Error ? tiers.error.message : '500 Internal Server Error'
          }`}
          hint="The storefront falls back to the enquiry-only page while this is unavailable."
          onRetry={() => void tiers.refetch()}
        />
      ) : rows.length === 0 ? (
        <DcEmptyState
          icon="icon-layers"
          title="No published tiers"
          body="Until you add one, /wholesale stays enquiry-only — no minimums, no lead times, exactly as it reads today. Add a tier to publish indicative volumes buyers can place themselves against."
          cta="Add the first tier"
          onCta={openNew}
        />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((tier) => (
            <div
              key={tier.id}
              style={{
                ...card,
                padding: '15px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                opacity: tier.isActive ? 1 : 0.6,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ font: `600 14px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                    {tier.name}
                  </span>
                  <span style={{ font: `400 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                    {tier.minUnits > 0
                      ? `from ${tier.minUnits.toLocaleString('en-US')} pcs`
                      : 'no published minimum'}
                    {tier.leadTimeDays ? ` · ${tier.leadTimeDays} day lead time` : ''}
                    {tier._count?.inquiries
                      ? ` · ${tier._count.inquiries} enquir${
                          tier._count.inquiries === 1 ? 'y' : 'ies'
                        }`
                      : ''}
                  </span>
                </div>
                <span
                  style={{
                    ...toneStyle(tier.isActive ? 'ok' : 'mute'),
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tier.isActive ? 'Published' : 'Hidden'}
                </span>
              </div>

              {tier.summary ? (
                <p style={{ margin: 0, font: `400 12.5px/1.6 ${FONT}`, color: 'var(--ink-2)' }}>
                  {tier.summary}
                </p>
              ) : null}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                <button type="button" disabled={busy} onClick={() => openEdit(tier)} style={chip}>
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void togglePublished(tier)}
                  style={chip}
                >
                  {tier.isActive ? 'Hide from site' : 'Publish'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRemoving(tier)}
                  style={{ ...chip, color: 'var(--bad)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <DcModal
          open
          title={editing === 'new' ? 'New tier' : `Edit ${editing.name}`}
          subtitle={
            editing === 'new'
              ? 'Published tiers appear on /wholesale and in the enquiry form.'
              : 'The key stays fixed — enquiries already filed against it keep their tier.'
          }
          confirmLabel={editing === 'new' ? 'Create tier' : 'Save tier'}
          busy={busy}
          width="min(560px, 94vw)"
          onClose={() => setEditing(null)}
          onConfirm={() => void save()}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={capsLabel}>Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Stockist"
                maxLength={60}
                style={field}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={capsLabel}>Minimum units</span>
                <input
                  type="number"
                  min={0}
                  value={draft.minUnits}
                  onChange={(e) => setDraft((d) => ({ ...d, minUnits: e.target.value }))}
                  placeholder="0 = none published"
                  style={field}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={capsLabel}>Lead time (days)</span>
                <input
                  type="number"
                  min={0}
                  value={draft.leadTimeDays}
                  onChange={(e) => setDraft((d) => ({ ...d, leadTimeDays: e.target.value }))}
                  placeholder="optional"
                  style={field}
                />
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={capsLabel}>Summary</span>
              <textarea
                value={draft.summary}
                onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                rows={3}
                maxLength={400}
                placeholder="One or two lines shown on the tier card."
                style={{ ...field, height: 'auto', padding: '9px 10px', lineHeight: 1.6 }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={capsLabel}>Perks — one per line</span>
              <textarea
                value={draft.perks}
                onChange={(e) => setDraft((d) => ({ ...d, perks: e.target.value }))}
                rows={4}
                placeholder={'Seasonal line sheet\nPriority restock\nCo-op marketing'}
                style={{ ...field, height: 'auto', padding: '9px 10px', lineHeight: 1.6 }}
              />
              <span style={{ font: `400 11.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
                First eight are shown; the card is a summary, not a contract.
              </span>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={capsLabel}>Sort order</span>
                <input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))}
                  style={field}
                />
              </label>
              <label
                style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end' }}
              >
                <span style={capsLabel}>Visibility</span>
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, isActive: !d.isActive }))}
                  style={{ ...field, cursor: 'pointer', textAlign: 'left' }}
                >
                  {draft.isActive ? 'Published on /wholesale' : 'Hidden'}
                </button>
              </label>
            </div>
          </div>
        </DcModal>
      ) : null}

      {removing ? (
        <DcModal
          open
          title={`Delete ${removing.name}?`}
          subtitle={
            removing._count?.inquiries
              ? `${removing._count.inquiries} enquir${
                  removing._count.inquiries === 1 ? 'y is' : 'ies are'
                } filed against this tier. They are kept — only the tier link is cleared.`
              : 'This removes the tier from /wholesale and from the enquiry form.'
          }
          confirmLabel="Delete tier"
          busy={busy}
          width="min(460px, 94vw)"
          onClose={() => setRemoving(null)}
          onConfirm={() => void runDelete(removing)}
        />
      ) : null}
    </>
  )
}

const chip = {
  height: 30,
  padding: '0 11px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink-2)',
  cursor: 'pointer',
  font: `600 12px/1 ${FONT}`,
} as const

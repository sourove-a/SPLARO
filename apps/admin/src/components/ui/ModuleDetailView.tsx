'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import type { FlatAdminRoute } from '@/lib/navigation/admin-nav'
import { loadAdminData, saveRecordEdit } from '@/lib/admin/admin-actions'
import { notifyDraftSaved } from '@/lib/admin/feedback'
import { useAdminNavigate } from '@/lib/navigation/client-nav'

interface ModuleDetailViewProps {
  navItem: FlatAdminRoute
  moduleHref: string
  recordId: string
  mode: 'detail' | 'edit'
}

export function ModuleDetailView({ navItem, moduleHref, recordId, mode }: ModuleDetailViewProps) {
  const { navigate } = useAdminNavigate()
  const title = mode === 'edit' ? `Edit ${recordId}` : recordId
  const storageKey = `record:${moduleHref}:${recordId}`

  const [name, setName] = useState(`${navItem.label} · ${recordId}`)
  const [status, setStatus] = useState('active')
  const [notes, setNotes] = useState(`Internal notes for ${recordId} in ${navItem.group}.`)

  useEffect(() => {
    const saved = loadAdminData<{ name?: string; status?: string; notes?: string } | null>(storageKey, null)
    if (saved) {
      if (saved.name) setName(saved.name)
      if (saved.status) setStatus(saved.status)
      if (saved.notes) setNotes(saved.notes)
    }
  }, [storageKey])

  const handleSave = () => {
    saveRecordEdit(moduleHref, recordId, { name, status, notes })
    notifyDraftSaved(recordId)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-[14px] border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
        Local draft workspace — saves to this browser only. Live records use the module list and API
        panels.
      </div>
      <div className="admin-module-card relative z-[1]">
        <p className="admin-kpi__label">{navItem.label}</p>
        <h2 className="mt-1 text-lg font-black text-[var(--admin-text)]">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-[var(--admin-text-secondary)]">
          {mode === 'edit' ? 'Update fields below, then save.' : 'Review and update fields below.'}
        </p>

        <div className="relative z-[1] mt-5 space-y-3">
          <label className="block space-y-1.5">
            <span className="admin-kpi__label">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="admin-input"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="admin-kpi__label">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="admin-input"
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="admin-kpi__label">Notes</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="admin-input resize-none"
            />
          </label>
        </div>

        <div className="relative z-[1] mt-5 flex flex-wrap gap-2">
          <AdminButton variant="gold" onClick={handleSave}>
            <Save className="h-4 w-4" />
            Save changes
          </AdminButton>
          {mode === 'detail' ? (
            <AdminButton variant="ghost" onClick={() => navigate(`${moduleHref}/${recordId}/edit`)}>
              Edit record
            </AdminButton>
          ) : null}
          <AdminButton variant="ghost" onClick={() => navigate(moduleHref)}>
            <ArrowLeft className="h-4 w-4" />
            Back to {navItem.label}
          </AdminButton>
        </div>
      </div>
    </div>
  )
}

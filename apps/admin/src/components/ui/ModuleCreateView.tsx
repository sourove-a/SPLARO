'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Sparkles } from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { notifySaved, saveDraftRecord } from '@/lib/admin/admin-actions'

interface ModuleCreateViewProps {
  moduleLabel: string
  moduleHref: string
  pageTitle: string
}

export function ModuleCreateView({ moduleLabel, moduleHref, pageTitle }: ModuleCreateViewProps) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Please enter a name before saving.')
      return
    }
    saveDraftRecord(moduleHref, { name: name.trim(), notes: notes.trim(), title: pageTitle })
    notifySaved(`${pageTitle} draft`)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-[24px] border border-black/5 bg-white/55 p-6">
        <div className="mb-5 flex items-center gap-2 text-[#5E7CFF]">
          <Sparkles className="h-4 w-4" />
          <p className="text-xs font-black uppercase tracking-[0.14em]">New record</p>
        </div>
        <h2 className="text-lg font-black text-[#111111]">{pageTitle}</h2>
        <p className="mt-1 text-sm font-semibold text-[#6B6B6B]">
          Draft a new {moduleLabel.toLowerCase()} entry. Saved locally in this browser until API sync is enabled.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-[#6B6B6B]">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Enter ${moduleLabel.toLowerCase()} name`}
              className="w-full rounded-[16px] border border-black/8 bg-white/80 px-4 py-3 text-sm font-semibold text-[#111111] outline-none transition focus:border-[#5E7CFF]/50"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-[#6B6B6B]">Notes</span>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional internal notes"
              className="w-full resize-none rounded-[16px] border border-black/8 bg-white/80 px-4 py-3 text-sm font-semibold text-[#111111] outline-none transition focus:border-[#5E7CFF]/50"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <AdminButton variant="gold" onClick={handleSave}>
            <Save className="h-4 w-4" />
            Save draft
          </AdminButton>
          <AdminLinkButton href={moduleHref} variant="ghost">
            <ArrowLeft className="h-4 w-4" />
            Back to {moduleLabel}
          </AdminLinkButton>
        </div>
      </div>
    </div>
  )
}

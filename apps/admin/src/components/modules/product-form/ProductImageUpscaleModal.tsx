'use client'

import Image from 'next/image'
import { Loader2, Sparkles, X } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'

export type UpscaleModalState = {
  file: File
  objectUrl: string
  width: number
  height: number
  previewId?: string
  previewUrl?: string
  previewWidth?: number
  previewHeight?: number
  generating?: boolean
  aiAvailable: boolean
  aiReason: string | null
}

interface ProductImageUpscaleModalProps {
  state: UpscaleModalState
  busy: boolean
  onClose: () => void
  onSkip: () => void
  onGeneratePreview: () => void
  onApprove: () => void
}

export function ProductImageUpscaleModal({
  state,
  busy,
  onClose,
  onSkip,
  onGeneratePreview,
  onApprove,
}: ProductImageUpscaleModalProps) {
  const hasPreview = Boolean(state.previewId && state.previewUrl)
  const canSkip = state.width >= 800

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal>
      <div className="relative w-full max-w-lg rounded-[16px] border border-[rgba(16,17,20,0.1)] bg-[#f7f6f3] p-4 shadow-xl">
        <button
          type="button"
          className="absolute right-3 top-3 rounded-full p-1 text-[#71717a] hover:bg-black/5"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-3 flex items-center gap-2 pr-8">
          <Sparkles className="h-4 w-4 text-[var(--admin-accent,#101114)]" />
          <h3 className="text-sm font-black text-[#18181b]">Small product photo</h3>
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-[#52525b]">
          This image is {state.width}×{state.height}px (under 1200px). Hard minimum is 800px;
          1200px+ is recommended for gallery quality. AI upscale is opt-in — preview first, then
          approve. Original file is always kept.
        </p>

        {!state.aiAvailable ? (
          <p className="mb-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900">
            {state.aiReason ?? 'AI upscale not configured.'} You can still upload if ≥800px wide.
          </p>
        ) : null}

        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="overflow-hidden rounded-[12px] border border-[rgba(16,17,20,0.08)] bg-white">
            <div className="relative aspect-square">
              <Image src={state.objectUrl} alt="Original" fill unoptimized className="object-contain" />
            </div>
            <p className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#71717a]">
              Original · {state.width}px
            </p>
          </div>
          <div className="overflow-hidden rounded-[12px] border border-[rgba(16,17,20,0.08)] bg-white">
            <div className="relative aspect-square flex items-center justify-center bg-[rgba(16,17,20,0.03)]">
              {state.generating ? (
                <Loader2 className="h-6 w-6 animate-spin text-[var(--admin-accent)]" />
              ) : hasPreview && state.previewUrl ? (
                <Image src={state.previewUrl} alt="AI upscaled preview" fill unoptimized className="object-contain" />
              ) : (
                <p className="px-3 text-center text-[11px] text-[#a1a1aa]">AI preview not generated yet</p>
              )}
            </div>
            <p className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#71717a]">
              {hasPreview && state.previewWidth
                ? `AI · ${state.previewWidth}px`
                : 'AI preview'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {canSkip ? (
            <AdminButton type="button" variant="ghost" disabled={busy} onClick={onSkip}>
              Upload without AI
            </AdminButton>
          ) : (
            <AdminButton type="button" variant="ghost" disabled={busy} onClick={onClose}>
              Cancel
            </AdminButton>
          )}
          {!hasPreview ? (
            <AdminButton
              type="button"
              disabled={busy || !state.aiAvailable || state.generating}
              onClick={onGeneratePreview}
            >
              {state.generating ? 'Generating…' : 'Generate AI preview'}
            </AdminButton>
          ) : (
            <AdminButton type="button" disabled={busy} onClick={onApprove}>
              Use AI upscale
            </AdminButton>
          )}
        </div>
      </div>
    </div>
  )
}

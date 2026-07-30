'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { Film, X } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { MediaUploadZone } from '@/components/media/MediaUploadZone'
import { resolveMediaUrl } from '@/lib/media-url'
import { cn } from '@/lib/utils/cn'

export interface HeroSlideFormValues {
  title: string
  subtitle: string
  linkUrl: string
  image: string
}

interface HeroSlideEditorModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initial: HeroSlideFormValues
  saving?: boolean
  onClose: () => void
  onSave: (values: HeroSlideFormValues) => void
}

export function isHeroMediaVideoUrl(url: string) {
  const value = url.trim()
  return /\.(mp4|webm|ogg)(\?|$)/i.test(value) || /videos\.pexels\.com\/video-files/i.test(value)
}

/** Table / card thumb — never feed mp4 into next/image. */
export function heroSlidePreview(url: string): { kind: 'image' | 'video'; src: string } {
  const raw = url.trim()
  if (!raw) return { kind: 'image', src: '' }
  if (!isHeroMediaVideoUrl(raw)) {
    return { kind: 'image', src: resolveMediaUrl(raw) }
  }
  const pexels = raw.match(/videos\.pexels\.com\/video-files\/(\d+)\//)
  if (pexels?.[1]) {
    return {
      kind: 'image',
      src: `https://images.pexels.com/videos/${pexels[1]}/pictures/preview-0.jpg?auto=compress&cs=tinysrgb&w=640`,
    }
  }
  return { kind: 'video', src: resolveMediaUrl(raw) }
}

export function HeroSlideEditorModal({
  open,
  mode,
  initial,
  saving = false,
  onClose,
  onSave,
}: HeroSlideEditorModalProps) {
  const titleId = useId()
  const [form, setForm] = useState<HeroSlideFormValues>(initial)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, saving])

  if (!open || !mounted) return null

  const preview = heroSlidePreview(form.image)
  const showVideo = isHeroMediaVideoUrl(form.image)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const title = form.title.trim()
    const image = form.image.trim()
    if (!title || !image) return
    onSave({
      title,
      subtitle: form.subtitle.trim(),
      linkUrl: form.linkUrl.trim() || '/',
      image,
    })
  }

  return createPortal(
    <div className="admin-slide-editor-root fixed inset-0 z-[220] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close slide editor"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!saving) onClose()
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'admin-slide-editor relative z-[1] flex max-h-[min(92vh,760px)] w-full max-w-[540px] flex-col overflow-hidden',
          'rounded-[20px] border border-black/[0.08] bg-white shadow-2xl',
          'dark:border-white/10 dark:bg-[var(--admin-c-16171d)]',
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
              Hero slider
            </p>
            <h2 id={titleId} className="mt-1 text-base font-black text-[var(--admin-text-primary)]">
              {mode === 'edit' ? 'Edit slide' : 'New slide'}
            </h2>
            <p className="mt-1 text-[11px] font-semibold leading-snug text-[var(--admin-text-muted)]">
              Image or video URL — live on homepage after save.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 text-[var(--admin-text-muted)] transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {preview.src ? (
              <div className="relative overflow-hidden rounded-[14px] border border-black/[0.08] bg-[var(--admin-surface-input)] dark:border-white/10">
                <div className="aspect-video w-full">
                  {showVideo ? (
                    <video
                      src={preview.kind === 'video' ? preview.src : resolveMediaUrl(form.image)}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      controls
                      poster={preview.kind === 'image' ? preview.src : undefined}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview.src} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                {showVideo ? (
                  <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
                    <Film className="h-3 w-3" aria-hidden />
                    Video
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-[14px] border border-dashed border-black/15 bg-black/[0.02] text-[12px] font-semibold text-[var(--admin-text-muted)] dark:border-white/15 dark:bg-white/[0.03]">
                Preview appears after you add a media URL
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">
                Headline
              </span>
              <input
                className="admin-input w-full"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Elegance That Moves With You."
                required
                autoComplete="off"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">
                Subtitle
              </span>
              <textarea
                className="admin-input w-full min-h-[72px] resize-y"
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                placeholder="Premium fashion crafted for timeless everyday luxury."
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">
                Button link
              </span>
              <input
                className="admin-input w-full"
                value={form.linkUrl}
                onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                placeholder="/shop"
                autoComplete="off"
              />
            </label>

            <div className="space-y-2">
              <label className="block space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">
                  Image or video URL
                </span>
                <input
                  className="admin-input w-full font-mono text-[11px]"
                  value={form.image}
                  onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                  placeholder="https://… or /uploads/banners/…"
                  required
                  autoComplete="off"
                />
              </label>
              <MediaUploadZone
                folder="banners"
                label="Upload image from device"
                onUploaded={(url) => setForm((f) => ({ ...f, image: url }))}
              />
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-black/[0.06] px-5 py-4 dark:border-white/10">
            <AdminButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </AdminButton>
            <AdminButton
              type="submit"
              variant="gold"
              loading={saving}
              disabled={!form.title.trim() || !form.image.trim()}
            >
              {mode === 'edit' ? 'Save changes' : 'Add slide'}
            </AdminButton>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  )
}

'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { MediaUploadZone } from '@/components/media/MediaUploadZone'
import { resolveMediaUrl } from '@/lib/media-url'

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

const FIELD: React.CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid var(--admin-glass-border)',
  background: 'var(--admin-surface-input)',
  padding: '10px 12px',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--admin-text-primary)',
  outline: 'none',
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--admin-text-muted)',
  marginBottom: 6,
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url.trim())
}

export function HeroSlideEditorModal({
  open,
  mode,
  initial,
  saving = false,
  onClose,
  onSave,
}: HeroSlideEditorModalProps) {
  const [form, setForm] = useState<HeroSlideFormValues>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const previewSrc = form.image.trim() ? resolveMediaUrl(form.image) : ''
  const showVideo = isVideoUrl(form.image)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const title = form.title.trim()
    const image = form.image.trim()
    if (!title) return
    if (!image) return
    onSave({
      title,
      subtitle: form.subtitle.trim(),
      linkUrl: form.linkUrl.trim() || '/',
      image,
    })
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close slide editor"
            className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hero-slide-editor-title"
            className="settings-card admin-panel-glass fixed left-1/2 top-1/2 z-[91] flex max-h-[min(90vh,720px)] w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: 'var(--admin-glass-border)' }}
            >
              <div>
                <p className="admin-page-eyebrow">Hero slider</p>
                <h2 id="hero-slide-editor-title" className="text-base font-black" style={{ color: 'var(--admin-text-primary)' }}>
                  {mode === 'edit' ? 'Edit slide' : 'New slide'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border"
                style={{ borderColor: 'var(--admin-glass-border)', color: 'var(--admin-text-muted)' }}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {previewSrc ? (
                  <div
                    className="overflow-hidden rounded-[14px] border"
                    style={{ borderColor: 'var(--admin-glass-border)', aspectRatio: '16/9', background: 'var(--admin-surface-input)' }}
                  >
                    {showVideo ? (
                      <video src={previewSrc} className="h-full w-full object-cover" muted playsInline controls />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewSrc} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                ) : null}

                <div>
                  <label style={LABEL} htmlFor="hero-slide-title">Headline</label>
                  <input
                    id="hero-slide-title"
                    style={FIELD}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Elegance That Moves With You."
                    required
                  />
                </div>

                <div>
                  <label style={LABEL} htmlFor="hero-slide-subtitle">Subtitle</label>
                  <textarea
                    id="hero-slide-subtitle"
                    style={{ ...FIELD, minHeight: 72, resize: 'vertical' }}
                    value={form.subtitle}
                    onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                    placeholder="Premium fashion crafted for timeless everyday luxury."
                  />
                </div>

                <div>
                  <label style={LABEL} htmlFor="hero-slide-link">Button link</label>
                  <input
                    id="hero-slide-link"
                    style={FIELD}
                    value={form.linkUrl}
                    onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                    placeholder="/shop"
                  />
                </div>

                <div>
                  <label style={LABEL} htmlFor="hero-slide-image">Image or video URL</label>
                  <input
                    id="hero-slide-image"
                    style={{ ...FIELD, fontFamily: 'monospace', fontSize: 11 }}
                    value={form.image}
                    onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                    placeholder="https://… or /uploads/banners/…"
                    required
                  />
                  <div className="mt-2">
                    <MediaUploadZone
                      folder="banners"
                      label="Upload image from device"
                      onUploaded={(url) => setForm((f) => ({ ...f, image: url }))}
                    />
                  </div>
                </div>
              </div>

              <div
                className="flex items-center justify-end gap-2 border-t px-5 py-4"
                style={{ borderColor: 'var(--admin-glass-border)' }}
              >
                <AdminButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
                  Cancel
                </AdminButton>
                <AdminButton type="submit" variant="gold" loading={saving} disabled={!form.title.trim() || !form.image.trim()}>
                  {mode === 'edit' ? 'Save changes' : 'Add slide'}
                </AdminButton>
              </div>
            </form>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

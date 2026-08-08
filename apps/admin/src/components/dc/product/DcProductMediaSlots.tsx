'use client'

import { useCallback, useRef, useState } from 'react'
import Image from 'next/image'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcMediaPickModal } from '@/components/dc/product/DcMediaPickModal'
import { DcField, DcInput } from '@/components/dc/product/DcProductFormPrimitives'
import { FONT, MONO } from '@/components/dc/tokens'
import { toastFail, toastWarn } from '@/lib/admin/feedback'
import { uploadAdminImage } from '@/lib/api/upload'

/**
 * Every slot crops to 4/5 because that is what `.shop-product-card__media`
 * renders on the storefront — a 1/1 main tile previewed a crop the shop never
 * shows, and mixing ratios left the grid rows ragged.
 */
const SLOT_RATIO = '4 / 5'

const SLOT_META = [
  { key: 'main', label: 'Main card thumbnail', hint: 'Upload · URL · library', ratio: SLOT_RATIO },
  { key: 'front', label: 'Front', hint: 'Upload · URL · library', ratio: SLOT_RATIO },
  { key: 'back', label: 'Back', hint: 'Upload · URL · library', ratio: SLOT_RATIO },
  { key: 'cuff', label: 'Cuff detail', hint: 'Upload · URL · library', ratio: SLOT_RATIO },
  { key: 'model', label: 'On model', hint: 'Upload · URL · library', ratio: SLOT_RATIO },
  { key: 'fabric', label: 'Fabric close-up', hint: 'Upload · URL · library', ratio: SLOT_RATIO },
] as const

export function DcProductMediaSlots({
  imageUrls,
  videoUrl,
  altText,
  onImageUrlsChange,
  onVideoUrlChange,
  onAltChange,
  disabled,
  uploadFolder = 'products',
}: {
  imageUrls: string[]
  videoUrl: string
  altText: string
  onImageUrlsChange: (urls: string[]) => void
  onVideoUrlChange: (url: string) => void
  onAltChange: (alt: string) => void
  disabled?: boolean
  /** Department folder e.g. products-men — keeps library organised. */
  uploadFolder?: string
}) {
  const [busyIdx, setBusyIdx] = useState<number | null>(null)
  const [urlDrafts, setUrlDrafts] = useState<Record<number, string>>({})
  const [librarySlot, setLibrarySlot] = useState<number | null>(null)
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const filled = imageUrls.filter(Boolean).length

  const writeSlot = useCallback(
    (index: number, url: string | null) => {
      const slots = Array.from({ length: 6 }, (_, i) => imageUrls[i] ?? '')
      slots[index] = url ?? ''
      let last = -1
      for (let i = 0; i < slots.length; i++) if (slots[i]) last = i
      if (last < 0) {
        onImageUrlsChange([])
        return
      }
      onImageUrlsChange(slots.slice(0, last + 1).filter(Boolean))
    },
    [imageUrls, onImageUrlsChange],
  )

  const uploadTo = async (index: number, file: File) => {
    if (disabled) return
    setBusyIdx(index)
    try {
      const res = await uploadAdminImage(file, uploadFolder)
      const url =
        (res as { url?: string; publicUrl?: string }).url ??
        (res as { publicUrl?: string }).publicUrl
      if (!url) throw new Error('Upload returned no URL')
      const slots = Array.from({ length: 6 }, (_, i) => imageUrls[i] ?? '')
      slots[index] = url
      let last = -1
      for (let i = 0; i < slots.length; i++) if (slots[i]) last = i
      onImageUrlsChange(slots.slice(0, last + 1).filter(Boolean))
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Image upload failed')
    } finally {
      setBusyIdx(null)
    }
  }

  const applyUrl = (index: number) => {
    const raw = (urlDrafts[index] ?? '').trim()
    if (!raw) {
      toastWarn('Paste an image link first')
      return
    }
    if (!/^https?:\/\//i.test(raw) && !raw.startsWith('/')) {
      toastWarn('URL must start with https:// or /uploads/…')
      return
    }
    writeSlot(index, raw)
    setUrlDrafts((prev) => ({ ...prev, [index]: '' }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="dc-media-grid">
        {SLOT_META.map((slot, index) => {
          const url = imageUrls[index]
          const busy = busyIdx === index
          return (
            <div key={slot.key} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => inputRefs.current[index]?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files?.[0]
                  if (file) void uploadTo(index, file)
                }}
                style={{
                  position: 'relative',
                  display: 'grid',
                  placeItems: 'center',
                  width: '100%',
                  aspectRatio: slot.ratio,
                  borderRadius: 12,
                  border: url ? '1px solid var(--line)' : '1px dashed var(--line-2)',
                  background: 'var(--surface-2)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  overflow: 'hidden',
                  padding: 0,
                  color: 'var(--ink-3)',
                }}
              >
                <input
                  ref={(el) => {
                    inputRefs.current[index] = el
                  }}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) void uploadTo(index, file)
                  }}
                />
                {url ? (
                  <>
                    <Image src={url} alt={slot.label} fill sizes="180px" style={{ objectFit: 'cover' }} unoptimized />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        writeSlot(index, null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          writeSlot(index, null)
                        }
                      }}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-2)',
                        cursor: 'pointer',
                        zIndex: 1,
                      }}
                    >
                      <DcIcon name="icon-trash-2" size={12} />
                    </span>
                  </>
                ) : (
                  <span
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      padding: 14,
                      textAlign: 'center',
                    }}
                  >
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: 'var(--surface)',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'var(--ink-2)',
                      }}
                    >
                      {busy ? (
                        <DcIcon name="icon-loader" size={16} style={{ animation: 'dc-spin .8s linear infinite' }} />
                      ) : (
                        <DcIcon name="icon-image-plus" size={16} />
                      )}
                    </span>
                    <span style={{ font: `500 11px/1.35 ${FONT}`, color: 'var(--ink-3)', maxWidth: 120 }}>
                      {busy ? 'Uploading…' : slot.hint}
                    </span>
                  </span>
                )}
              </button>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ flex: 1, font: `500 11px/1.3 ${FONT}`, color: 'var(--ink-2)' }}>{slot.label}</span>
                <span style={{ font: `600 9.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                  {index === 0 ? 'MAIN' : String(index + 1).padStart(2, '0')}
                </span>
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={urlDrafts[index] ?? ''}
                  onChange={(e) => setUrlDrafts((prev) => ({ ...prev, [index]: e.target.value }))}
                  placeholder="https://… or /uploads/…"
                  disabled={disabled}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 30,
                    padding: '0 8px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    font: `400 11px/1 ${MONO}`,
                  }}
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => applyUrl(index)}
                  title="Use link"
                  style={{
                    height: 30,
                    padding: '0 8px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    font: `600 10px/1 ${FONT}`,
                    color: 'var(--ink-2)',
                  }}
                >
                  Link
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setLibrarySlot(index)}
                  title="Pick from media library"
                  style={{
                    height: 30,
                    width: 30,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    color: 'var(--ink-2)',
                  }}
                >
                  <DcIcon name="icon-folder-open" size={12} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 12,
        }}
      >
        <DcField label="Video URL · optional">
          <DcInput
            mono
            value={videoUrl}
            onChange={(e) => onVideoUrlChange(e.target.value)}
            placeholder="YouTube or MP4 link"
            disabled={disabled}
          />
        </DcField>
        <DcField label="Alt text · all images" hint="Used by screen readers and Google Images.">
          <DcInput value={altText} onChange={(e) => onAltChange(e.target.value)} disabled={disabled} />
        </DcField>
      </div>

      <span style={{ font: `400 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
        {filled} of 6 filled · first image is the storefront card thumbnail · uploads go to{' '}
        <code style={{ fontFamily: MONO }}>{uploadFolder}</code>
      </span>

      <DcMediaPickModal
        open={librarySlot != null}
        preferredFolder={uploadFolder}
        onClose={() => setLibrarySlot(null)}
        onPick={(picked) => {
          if (librarySlot != null) writeSlot(librarySlot, picked)
        }}
      />
    </div>
  )
}

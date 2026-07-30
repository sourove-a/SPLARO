'use client'

import { useCallback, useRef, useState } from 'react'
import Image from 'next/image'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcField, DcInput } from '@/components/dc/product/DcProductFormPrimitives'
import { FONT, MONO } from '@/components/dc/tokens'
import { toastFail } from '@/lib/admin/feedback'
import { uploadAdminImage } from '@/lib/api/upload'

const SLOT_META = [
  { key: 'main', label: 'Main card thumbnail', hint: 'Drop main photo or browse files', ratio: '1 / 1' },
  { key: 'front', label: 'Front', hint: 'Drop photo or browse files', ratio: '3 / 4' },
  { key: 'back', label: 'Back', hint: 'Drop photo or browse files', ratio: '3 / 4' },
  { key: 'cuff', label: 'Cuff detail', hint: 'Drop photo or browse files', ratio: '3 / 4' },
  { key: 'model', label: 'On model', hint: 'Drop photo or browse files', ratio: '3 / 4' },
  { key: 'fabric', label: 'Fabric close-up', hint: 'Drop photo or browse files', ratio: '3 / 4' },
] as const

export function DcProductMediaSlots({
  imageUrls,
  videoUrl,
  altText,
  onImageUrlsChange,
  onVideoUrlChange,
  onAltChange,
  disabled,
}: {
  imageUrls: string[]
  videoUrl: string
  altText: string
  onImageUrlsChange: (urls: string[]) => void
  onVideoUrlChange: (url: string) => void
  onAltChange: (alt: string) => void
  disabled?: boolean
}) {
  const [busyIdx, setBusyIdx] = useState<number | null>(null)
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
      // Dense list for API, preserving order (empty holes dropped only after last filled)
      onImageUrlsChange(slots.slice(0, last + 1).filter(Boolean))
    },
    [imageUrls, onImageUrlsChange],
  )

  const uploadTo = async (index: number, file: File) => {
    if (disabled) return
    setBusyIdx(index)
    try {
      const res = await uploadAdminImage(file)
      const url = (res as { url?: string; publicUrl?: string }).url
        ?? (res as { publicUrl?: string }).publicUrl
      if (!url) throw new Error('Upload returned no URL')
      // Preserve positional slots when possible
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
          gap: 12,
        }}
      >
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
        {filled} of 6 filled · first image is the storefront card thumbnail
      </span>
    </div>
  )
}

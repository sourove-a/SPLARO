'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcMediaPickModal } from '@/components/dc/product/DcMediaPickModal'
import { DcField, DcInput } from '@/components/dc/product/DcProductFormPrimitives'
import { FONT, MONO } from '@/components/dc/tokens'
import { toastFail, toastWarn } from '@/lib/admin/feedback'
import { uploadAdminImage } from '@/lib/api/upload'
import { arrayMove, DcSortableList, useDcSortable } from '@/components/dc/DcSortableList'

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

function padSlots(urls: string[]): string[] {
  return Array.from({ length: SLOT_META.length }, (_, i) => urls[i] ?? '')
}

function compactSlots(slots: string[]): string[] {
  let last = -1
  for (let i = 0; i < slots.length; i++) if (slots[i]) last = i
  if (last < 0) return []
  return slots.slice(0, last + 1)
}

export function DcProductMediaSlots({
  imageUrls,
  videoUrl,
  altText,
  onImageUrlsChange,
  onVideoUrlChange,
  onAltChange,
  disabled,
  uploadFolder = 'products',
  excludeUrls = imageUrls,
  categoryId,
  categoryName,
  categoryImage,
  onSetHomepageImage,
  homepageBusy = false,
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
  /** Image URLs already assigned to this product, hidden from the picker. */
  excludeUrls?: string[]
  categoryId?: string
  categoryName?: string
  categoryImage?: string | null
  onSetHomepageImage?: (url: string) => void | Promise<void>
  homepageBusy?: boolean
}) {
  const [busyIdx, setBusyIdx] = useState<number | null>(null)
  const [urlDrafts, setUrlDrafts] = useState<Record<number, string>>({})
  const [librarySlot, setLibrarySlot] = useState<number | null>(null)
  // Move / homepage / URL / library controls used to sit permanently under all
  // six tiles — five stacked control rows each, which is what turned this one
  // section into most of the page. They now open for a single slot at a time.
  const [openTools, setOpenTools] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const slots = padSlots(imageUrls)
  const filled = slots.filter(Boolean).length
  const homepageUrl = (categoryImage ?? '').trim()

  const emit = useCallback(
    (next: string[]) => {
      onImageUrlsChange(compactSlots(padSlots(next)))
    },
    [onImageUrlsChange],
  )

  const writeSlot = useCallback(
    (index: number, url: string | null) => {
      const next = padSlots(imageUrls)
      next[index] = url ?? ''
      emit(next)
    },
    [emit, imageUrls],
  )

  const moveSlot = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= SLOT_META.length || to >= SLOT_META.length) return
      const next = padSlots(imageUrls)
      const fromUrl = next[from]
      if (!fromUrl) return
      const toUrl = next[to]
      next[from] = toUrl ?? ''
      next[to] = fromUrl
      emit(next)
    },
    [emit, imageUrls],
  )

  const reorderSlots = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= SLOT_META.length || to >= SLOT_META.length) return
      emit(arrayMove(padSlots(imageUrls), from, to))
    },
    [emit, imageUrls],
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
      writeSlot(index, url)
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

  const setHomepage = (url: string) => {
    if (!onSetHomepageImage) return
    if (!categoryId) {
      toastWarn('Pick a category first', 'Homepage tile is saved on the category (Polo Shirt, Panjabi, …).')
      return
    }
    void onSetHomepageImage(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {filled === 0 ? (
        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 12,
            background: 'var(--surface-2)',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          <span style={{ font: `600 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>Start with the main card photo</span>
          <span style={{ font: `400 11.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
            Fill the first slot first. The storefront card, product page lead image, and most shares all start from that photo.
          </span>
        </div>
      ) : null}
      <DcSortableList
        ids={SLOT_META.map((slot) => slot.key)}
        layout="grid"
        disabled={Boolean(disabled)}
        onReorder={reorderSlots}
      >
      <div className="dc-media-grid">
        {SLOT_META.map((slot, index) => {
          const url = slots[index]
          const busy = busyIdx === index
          const isHomepage = Boolean(url && homepageUrl && url === homepageUrl)
          const isDrop = dropTarget === index
          return (
            <SortableSlotShell
              key={slot.key}
              id={slot.key}
              className={`dc-media-slot${index === 0 ? ' dc-media-slot--main' : ''}`}
              disabled={Boolean(disabled) || !url}
            >
              {(drag) => (
            <>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => {
                  if (url) return
                  inputRefs.current[index]?.click()
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                  setDropTarget(index)
                }}
                onDragLeave={() => {
                  setDropTarget((current) => (current === index ? null : current))
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setDropTarget(null)
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
                  border: isDrop
                    ? '2px solid var(--violet-solid)'
                    : url
                      ? '1px solid var(--line)'
                      : '1px dashed var(--line-2)',
                  background: 'var(--surface-2)',
                  cursor: disabled ? 'not-allowed' : url ? 'default' : 'pointer',
                  overflow: 'hidden',
                  padding: 0,
                  color: 'var(--ink-3)',
                  opacity: drag.isDragging ? 0.55 : 1,
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
                      aria-label="Drag to reorder"
                      {...drag.attributes}
                      {...drag.listeners}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        left: 8,
                        top: 8,
                        zIndex: 2,
                        display: 'grid',
                        placeItems: 'center',
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: 'rgba(10,10,12,.72)',
                        color: 'var(--on-violet)',
                        cursor: 'grab',
                        touchAction: 'none',
                      }}
                    >
                      <DcIcon name="icon-grip-vertical" size={13} />
                    </span>
                    {isHomepage ? (
                      <span
                        style={{
                          position: 'absolute',
                          left: 8,
                          bottom: 8,
                          zIndex: 1,
                          padding: '3px 7px',
                          borderRadius: 6,
                          background: 'rgba(10,10,12,.78)',
                          color: 'var(--on-violet)',
                          font: `700 9px/1 ${FONT}`,
                          letterSpacing: '.06em',
                        }}
                      >
                        HOMEPAGE
                      </span>
                    ) : null}
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
                      {busy ? 'Uploading…' : index === 0 ? 'Start here' : slot.hint}
                    </span>
                    {!busy ? (
                      <span style={{ font: `400 10px/1.35 ${FONT}`, color: 'var(--ink-3)', maxWidth: 140, opacity: 0.78 }}>
                        {index === 0 ? 'Main storefront thumbnail' : 'Optional detail angle'}
                      </span>
                    ) : null}
                  </span>
                )}
              </button>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ flex: 1, minWidth: 0, font: `500 11px/1.3 ${FONT}`, color: 'var(--ink-2)' }}>
                  {slot.label}
                </span>
                <button
                  type="button"
                  className="dc-media-slot__tools-toggle"
                  aria-expanded={openTools === index}
                  aria-label={`${openTools === index ? 'Hide' : 'Show'} options for ${slot.label}`}
                  onClick={() => setOpenTools((current) => (current === index ? null : index))}
                >
                  <DcIcon name={openTools === index ? 'icon-chevron-up' : 'icon-ellipsis'} size={12} />
                </button>
              </span>
              <div
                className="dc-media-slot__tools"
                data-open={openTools === index ? 'true' : 'false'}
                hidden={openTools !== index}
              >
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  disabled={disabled || !url || index === 0}
                  aria-label={`Move ${slot.label} earlier`}
                  onClick={() => reorderSlots(index, index - 1)}
                  style={{
                    height: 30,
                    width: 30,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    cursor: disabled || !url || index === 0 ? 'default' : 'pointer',
                    color: 'var(--ink-2)',
                  }}
                >
                  <DcIcon name="icon-chevron-up" size={12} />
                </button>
                <button
                  type="button"
                  disabled={disabled || !url || index === SLOT_META.length - 1}
                  aria-label={`Move ${slot.label} later`}
                  onClick={() => reorderSlots(index, index + 1)}
                  style={{
                    height: 30,
                    width: 30,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    cursor: disabled || !url || index === SLOT_META.length - 1 ? 'default' : 'pointer',
                    color: 'var(--ink-2)',
                  }}
                >
                  <DcIcon name="icon-chevron-down" size={12} />
                </button>
                <select
                  aria-label={`Use ${slot.label} as`}
                  disabled={disabled || !url}
                  value={index}
                  onChange={(e) => moveSlot(index, Number(e.target.value))}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 30,
                    padding: '0 6px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    color: 'var(--ink-2)',
                    font: `600 10.5px/1 ${FONT}`,
                  }}
                >
                  {SLOT_META.map((option, optionIndex) => (
                    <option key={option.key} value={optionIndex}>
                      {optionIndex === index ? option.label : `Move to ${option.label}`}
                    </option>
                  ))}
                </select>
                {onSetHomepageImage ? (
                  <button
                    type="button"
                    disabled={disabled || !url || homepageBusy || isHomepage}
                    onClick={() => url && setHomepage(url)}
                    title={
                      categoryName
                        ? `Use this photo as the ${categoryName} homepage tile`
                        : 'Use this photo as the homepage category tile'
                    }
                    style={{
                      height: 30,
                      padding: '0 8px',
                      borderRadius: 8,
                      border: `1px solid ${isHomepage ? 'var(--violet-solid)' : 'var(--line)'}`,
                      background: isHomepage ? 'var(--violet-soft)' : 'var(--surface)',
                      cursor: disabled || !url || isHomepage ? 'default' : 'pointer',
                      font: `600 10px/1 ${FONT}`,
                      color: isHomepage ? 'var(--violet)' : 'var(--ink-2)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isHomepage ? 'Homepage' : 'Set homepage'}
                  </button>
                ) : null}
              </div>
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
            </>
              )}
            </SortableSlotShell>
          )
        })}
      </div>
      </DcSortableList>

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
        {filled} of 6 filled · first image is the shop card · drag the handle to reorder · tap ••• on a tile for move,
        link, library and homepage
        {categoryName ? ` · Set homepage saves the tile for ${categoryName}` : ''} · uploads go to{' '}
        <code style={{ fontFamily: MONO }}>{uploadFolder}</code>
      </span>

      <DcMediaPickModal
        open={librarySlot != null}
        preferredFolder={uploadFolder}
        excludeUrls={excludeUrls}
        onClose={() => setLibrarySlot(null)}
        onPick={(picked) => {
          if (librarySlot != null) writeSlot(librarySlot, picked)
        }}
      />
    </div>
  )
}

function SortableSlotShell({
  id,
  className,
  disabled,
  children,
}: {
  id: string
  className: string
  disabled?: boolean
  children: (drag: ReturnType<typeof useDcSortable>) => ReactNode
}) {
  const drag = useDcSortable(id, disabled)
  return (
    <div ref={drag.setNodeRef} className={className} style={drag.style}>
      {children(drag)}
    </div>
  )
}

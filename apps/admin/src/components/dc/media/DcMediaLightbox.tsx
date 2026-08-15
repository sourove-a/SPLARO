'use client'

/* eslint-disable @next/next/no-img-element -- runtime upload URLs, zoom canvas */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { DcIcon } from '@/components/dc/DcIcon'
import { useDcScreen } from '@/components/dc/DcScreenContext'
import { MONO, toneStyle } from '@/components/dc/tokens'
import { fetchMediaUsage, updateMediaAsset, type MediaUsage } from '@/lib/api/media'
import {
  downloadFilename,
  formatMediaBytes,
  formatMediaDate,
  mediaCopyPayloads,
  publicMediaUrl,
  relativeMediaPath,
  resolutionGrade,
  sameOriginMediaSrc,
  usageOwnerHref,
} from '@/lib/media/asset-meta'
import { heroMediaPreviewSrc } from '@splaro/config'

export type DcLightboxAsset = {
  id: string
  type: string
  name: string
  url: string
  altText: string
  source: string
  updated: string
  publicUrl?: string
  folder?: string
  mimeType?: string | null
  sizeBytes?: number | null
  width?: number | null
  height?: number | null
  contentHash?: string | null
  kind?: string | null
  focalX?: number | null
  focalY?: number | null
  createdAt?: string
  updatedAt?: string
  productId?: string
}

const ZOOM_MIN = 1
const ZOOM_MAX = 5

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function DcMediaLightbox({
  assets,
  activeKey,
  onActiveKeyChange,
  onClose,
}: {
  assets: DcLightboxAsset[]
  activeKey: { type: string; id: string } | null
  onActiveKeyChange: (next: { type: string; id: string }) => void
  onClose: () => void
}) {
  const { toast } = useDcScreen()
  const router = useRouter()
  const qc = useQueryClient()
  const rootRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDetailsElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const [altDraft, setAltDraft] = useState('')
  const [focal, setFocal] = useState<{ x: number; y: number } | null>(null)
  const [downloading, setDownloading] = useState(false)

  const index = useMemo(() => {
    if (!activeKey) return -1
    return assets.findIndex((asset) => asset.id === activeKey.id && asset.type === activeKey.type)
  }, [assets, activeKey])
  const asset = index >= 0 ? assets[index] : null

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!activeKey) return
    if (index < 0) onClose()
  }, [activeKey, index, onClose])

  useEffect(() => {
    setZoom(1)
    zoomRef.current = 1
    setPan({ x: 0, y: 0 })
    setAltDraft(asset?.altText ?? '')
    setFocal(
      asset?.focalX != null && asset?.focalY != null ? { x: asset.focalX, y: asset.focalY } : null,
    )
  }, [asset?.id, asset?.type, asset?.altText, asset?.focalX, asset?.focalY])

  const mime = (asset?.mimeType ?? '').toLowerCase()
  const isVideo = Boolean(asset) && (asset?.kind === 'video' || mime.startsWith('video/'))
  const isPdf = Boolean(asset) && (asset?.kind === 'pdf' || mime === 'application/pdf')
  const isImage = Boolean(asset) && !isVideo && !isPdf

  const go = useCallback(
    (delta: number) => {
      if (assets.length === 0) return
      const current = index < 0 ? 0 : index
      const next = assets[(current + delta + assets.length) % assets.length]
      if (!next) return
      onActiveKeyChange({ type: next.type, id: next.id })
    },
    [assets, index, onActiveKeyChange],
  )

  const setZoomAround = useCallback((nextZoom: number) => {
    const clamped = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX)
    zoomRef.current = clamped
    setZoom(clamped)
    if (clamped <= 1) setPan({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    if (!asset) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
      if (dialogs.item(dialogs.length - 1) !== rootRef.current) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (copyRef.current?.open) {
          copyRef.current.open = false
          return
        }
        onClose()
        return
      }
      if (isTypingTarget(event.target)) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        go(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        go(1)
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setZoomAround(zoomRef.current + 0.25)
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        setZoomAround(zoomRef.current - 0.25)
      } else if (event.key === '0') {
        event.preventDefault()
        setZoomAround(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [asset, go, onClose, setZoomAround])

  useEffect(() => {
    if (!mounted || !isImage) return
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = event.deltaY > 0 ? 0.9 : 1.1
      setZoomAround(zoomRef.current * factor)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [mounted, asset?.id, isImage, setZoomAround])

  const usageQuery = useQuery({
    queryKey: ['media-usage', asset?.id],
    queryFn: () => fetchMediaUsage(asset!.id),
    enabled: Boolean(asset && asset.type.toLowerCase() === 'library'),
    staleTime: 15_000,
  })

  const saveMut = useMutation({
    mutationFn: async (payload: { altText?: string; focalX?: number; focalY?: number }) => {
      if (!asset || asset.type.toLowerCase() !== 'library') {
        throw new Error('Only library assets can be edited here')
      }
      return updateMediaAsset(asset.id, payload)
    },
    onSuccess: (saved, payload) => {
      void qc.invalidateQueries({ queryKey: ['platform-media'] })
      void qc.invalidateQueries({ queryKey: ['media-trash'] })
      void qc.invalidateQueries({ queryKey: ['media-dupes'] })
      if (payload.altText !== undefined) {
        setAltDraft(saved.altText ?? '')
        toast('ok', 'Alt text saved', saved.altText?.trim() ? saved.altText : 'Alt is now empty.')
      } else {
        toast('ok', 'Focal point saved', 'Crops will pin to this spot.')
      }
    },
    onError: (err) => {
      setAltDraft(asset?.altText ?? '')
      setFocal(
        asset?.focalX != null && asset?.focalY != null ? { x: asset.focalX, y: asset.focalY } : null,
      )
      toast('bad', 'Not saved', err instanceof Error ? err.message : 'Could not update this asset')
    },
  })

  if (!mounted || !asset) return null

  const src = sameOriginMediaSrc(asset.url)
  const fullSrc = publicMediaUrl(asset.url, asset.publicUrl)
  const copies = mediaCopyPayloads({
    url: asset.url,
    ...(asset.publicUrl ? { publicUrl: asset.publicUrl } : {}),
    altText: asset.altText,
    width: asset.width ?? null,
    height: asset.height ?? null,
  })
  const grade = resolutionGrade(asset.width, asset.height)
  const gradeTone = toneStyle(grade.tone)
  const library = asset.type.toLowerCase() === 'library'
  const altDirty = altDraft !== (asset.altText ?? '')
  const usage: MediaUsage[] = library ? (usageQuery.data?.usage ?? []) : []
  const zoomLabel = `${Math.round(zoom * 100)}%`

  const copyValue = (label: string, value: string) => {
    void navigator.clipboard.writeText(value).then(
      () => {
        if (copyRef.current) copyRef.current.open = false
        toast('ok', `${label} copied`, value)
      },
      () => toast('bad', 'Copy failed', 'Browser denied clipboard access.'),
    )
  }

  const download = async () => {
    setDownloading(true)
    try {
      const res = await fetch(src, { credentials: 'same-origin' })
      if (!res.ok) throw new Error(`Download returned ${res.status}`)
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = downloadFilename(asset.name, asset.url, asset.mimeType)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(href), 1_000)
      toast('ok', 'Download started', anchor.download)
    } catch (err) {
      toast(
        'warn',
        'Could not save as a file',
        err instanceof Error ? err.message : 'Opening the original in a new tab instead.',
      )
      window.open(fullSrc, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloading(false)
    }
  }

  return createPortal(
    <div
      ref={rootRef}
      className="dc-mlbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${asset.name}`}
    >
      <div className="dc-mlbox__stage">
        <div className="dc-mlbox__stage-bar">
          <span className="dc-mlbox__counter">
            {index + 1} / {assets.length}
          </span>
          <span className="dc-mlbox__hint">ESC close · ← → navigate · scroll zoom</span>
          <button
            type="button"
            className="dc-mlbox__icon-btn"
            aria-label="Close preview"
            onClick={onClose}
          >
            <DcIcon name="icon-x" size={16} />
          </button>
        </div>

        {assets.length > 1 ? (
          <>
            <button
              type="button"
              className="dc-mlbox__nav dc-mlbox__nav--prev"
              aria-label="Previous asset"
              onClick={() => go(-1)}
            >
              <DcIcon name="icon-chevron-left" size={22} />
            </button>
            <button
              type="button"
              className="dc-mlbox__nav dc-mlbox__nav--next"
              aria-label="Next asset"
              onClick={() => go(1)}
            >
              <DcIcon name="icon-chevron-right" size={22} />
            </button>
          </>
        ) : null}

        <div
          ref={canvasRef}
          className={`dc-mlbox__canvas${zoom > 1 ? ' is-zoomed' : ''}`}
          onDoubleClick={() => {
            if (!isImage) return
            setZoomAround(zoom > 1 ? 1 : 2)
          }}
          onPointerDown={(event) => {
            if (!isImage || zoom <= 1) return
            event.currentTarget.setPointerCapture(event.pointerId)
            dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current
            if (!drag) return
            setPan({
              x: drag.panX + (event.clientX - drag.x),
              y: drag.panY + (event.clientY - drag.y),
            })
          }}
          onPointerUp={() => {
            dragRef.current = null
          }}
          onPointerCancel={() => {
            dragRef.current = null
          }}
        >
          {isPdf ? (
            <iframe title={asset.name} src={src} className="dc-mlbox__frame" />
          ) : isVideo ? (
            <video src={src} controls playsInline className="dc-mlbox__video" />
          ) : (
            <img
              src={src}
              alt={asset.altText || asset.name}
              draggable={false}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            />
          )}
        </div>

        {isImage ? (
          <div className="dc-mlbox__zoom">
            <button type="button" onClick={() => setZoomAround(zoom - 0.25)} aria-label="Zoom out">
              <DcIcon name="icon-minus" size={14} />
            </button>
            <span>{zoomLabel}</span>
            <button type="button" onClick={() => setZoomAround(zoom + 0.25)} aria-label="Zoom in">
              <DcIcon name="icon-plus" size={14} />
            </button>
            <button type="button" onClick={() => setZoomAround(1)} disabled={zoom === 1}>
              Fit
            </button>
          </div>
        ) : null}
      </div>

      <aside className="dc-mlbox__meta">
        <header className="dc-mlbox__meta-head">
          <div>
            <h2 title={asset.name}>{asset.name}</h2>
            <p>{asset.type} · {asset.source}</p>
          </div>
        </header>

        <div className="dc-mlbox__tools">
          <details ref={copyRef} className="dc-mlbox__copy">
            <summary>
              <DcIcon name="icon-copy" size={13} />
              Copy
            </summary>
            <div role="menu" aria-label="Copy formats">
              {copies.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  role="menuitem"
                  onClick={() => copyValue(item.label, item.value)}
                >
                  <span>{item.label}</span>
                  <code>{item.value}</code>
                </button>
              ))}
            </div>
          </details>
          <button type="button" className="dc-mlbox__tool" disabled={downloading} onClick={() => void download()}>
            <DcIcon name="icon-download" size={13} />
            {downloading ? 'Saving…' : 'Download'}
          </button>
          <button
            type="button"
            className="dc-mlbox__tool"
            onClick={() => window.open(fullSrc, '_blank', 'noopener,noreferrer')}
          >
            <DcIcon name="icon-external-link" size={13} />
            Original
          </button>
        </div>

        <dl className="dc-mlbox__facts">
          <div>
            <dt>Dimensions</dt>
            <dd>
              {asset.width && asset.height ? `${asset.width} × ${asset.height} px` : '—'}
              <span
                className="dc-mlbox__grade"
                title={grade.title}
                style={{ borderColor: gradeTone.bd, background: gradeTone.bg, color: gradeTone.fg }}
              >
                {grade.label}
              </span>
            </dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd style={{ fontFamily: MONO }}>{formatMediaBytes(asset.sizeBytes)}</dd>
          </div>
          <div>
            <dt>MIME</dt>
            <dd style={{ fontFamily: MONO }}>{asset.mimeType || '—'}</dd>
          </div>
          <div>
            <dt>Hash</dt>
            <dd className="dc-mlbox__hash" title={asset.contentHash ?? undefined}>
              {asset.contentHash || '—'}
            </dd>
          </div>
          <div>
            <dt>Folder</dt>
            <dd>{asset.folder || '—'}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatMediaDate(asset.createdAt)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{formatMediaDate(asset.updatedAt) !== '—' ? formatMediaDate(asset.updatedAt) : asset.updated}</dd>
          </div>
          <div>
            <dt>Path</dt>
            <dd className="dc-mlbox__hash" title={relativeMediaPath(asset.url)}>
              {relativeMediaPath(asset.url) || '—'}
            </dd>
          </div>
        </dl>

        <label className="dc-mlbox__field">
          <span>Alt text</span>
          <textarea
            rows={3}
            value={altDraft}
            disabled={!library || saveMut.isPending}
            placeholder={library ? 'Describe the image for SEO and screen readers' : 'Edit alt from the owner module'}
            onChange={(event) => setAltDraft(event.target.value)}
          />
          {library ? (
            <button
              type="button"
              className="dc-mlbox__save"
              disabled={!altDirty || saveMut.isPending}
              onClick={() => saveMut.mutate({ altText: altDraft })}
            >
              {saveMut.isPending && altDirty ? 'Saving…' : 'Save alt'}
            </button>
          ) : (
            <span className="dc-mlbox__note">Alt for this type is edited on its owner page.</span>
          )}
        </label>

        {isImage ? (
          <div className="dc-mlbox__field">
            <span>Focal point</span>
            <button
              type="button"
              className="dc-mlbox__focal"
              disabled={!library || saveMut.isPending}
              aria-label="Set focal point"
              onClick={(event) => {
                if (!library) return
                const box = event.currentTarget.getBoundingClientRect()
                const x = clamp((event.clientX - box.left) / box.width, 0, 1)
                const y = clamp((event.clientY - box.top) / box.height, 0, 1)
                setFocal({ x, y })
                saveMut.mutate({ focalX: x, focalY: y })
              }}
            >
              <img src={heroMediaPreviewSrc(src)} alt="" />
              {focal ? (
                <i style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }} />
              ) : null}
            </button>
            <span className="dc-mlbox__note">
              {library
                ? focal
                  ? `${Math.round(focal.x * 100)}% × ${Math.round(focal.y * 100)}% — click to move`
                  : 'Click the preview to pin the crop'
                : 'Focal point is only stored on library assets'}
            </span>
          </div>
        ) : null}

        <div className="dc-mlbox__field">
          <span>Where used</span>
          {!library ? (
            <p className="dc-mlbox__note">This file is owned by a {asset.type.toLowerCase()} record.</p>
          ) : usageQuery.isLoading ? (
            <p className="dc-mlbox__note">Checking catalogue links…</p>
          ) : usageQuery.isError ? (
            <p className="dc-mlbox__note">Usage lookup failed — try again from the asset menu.</p>
          ) : usage.length === 0 ? (
            <p className="dc-mlbox__note">Not linked anywhere in the catalogue.</p>
          ) : (
            <ul className="dc-mlbox__used">
              {usage.map((item) => {
                const href = usageOwnerHref(item)
                return (
                  <li key={`${item.type}-${item.id}`}>
                    {href ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          router.push(href)
                        }}
                      >
                        <em>{item.type}</em>
                        {item.label}
                      </button>
                    ) : (
                      <span>
                        <em>{item.type}</em>
                        {item.label}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  )
}

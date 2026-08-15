'use client'

/* eslint-disable @next/next/no-img-element -- local blob previews for queued files */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { formatBytes } from '@/components/dc/media/DcStoragePanel'
import { createMediaAsset, fetchLibraryMedia, type MediaFolder } from '@/lib/api/media'
import { uploadAdminImage } from '@/lib/api/upload'
import { cleanupOrphanWithRetry, RASTER_UPLOAD, uploadRejection } from '@/lib/media/upload-rules'
import '@/styles/dc-media-upload.css'

/**
 * Multi-file upload queue.
 *
 * One file is the modal's job — it can name the asset, set alt text and attach
 * to a product. A batch is a different task: the admin cares that every file
 * lands, in the right folder, and wants to see which one failed. So this runs
 * the files itself, two at a time, and keeps each row's state visible.
 *
 * Two at a time is deliberate: the API host caps worker threads, and the upload
 * route runs a sharp pipeline per file. More parallelism there makes every file
 * slower, not the batch faster.
 */

const CONCURRENCY = 2

type ItemStatus = 'queued' | 'uploading' | 'optimizing' | 'indexing' | 'done' | 'error' | 'cancelled'

type QueueItem = {
  id: string
  file: File
  preview: string | null
  name: string
  altText: string
  status: ItemStatus
  progress: number
  error?: string | undefined
  contentHash?: string | null
  /** Set once the finished batch is checked against the library's hashes. */
  duplicate?: boolean
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  queued: 'Queued',
  uploading: 'Uploading',
  optimizing: 'Optimising',
  indexing: 'Indexing',
  done: 'Saved',
  error: 'Failed',
  cancelled: 'Cancelled',
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || 'Library asset'
}

export interface DcUploadQueueProps {
  files: File[]
  folder: MediaFolder
  watermark: boolean
  /** Runs after every file settles, so the caller can refresh its lists. */
  onFinished: (summary: { saved: number; failed: number; duplicates: number }) => void
  onProgressChange?: ((busy: boolean) => void) | undefined
}

export function DcUploadQueue({ files, folder, watermark, onFinished, onProgressChange }: DcUploadQueueProps) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [running, setRunning] = useState(false)
  const abortRef = useRef(new Map<string, AbortController>())
  const startedRef = useRef(false)
  /**
   * Mirror of `items` the async run reads instead of a stale closure. It is
   * written on every commit rather than during render: the run finishes in the
   * same tick as the last status update, before React has re-rendered, and a
   * render-time mirror would still be reporting the files as in flight.
   */
  const itemsRef = useRef<QueueItem[]>([])

  const commit = useCallback((updater: (prev: QueueItem[]) => QueueItem[]) => {
    const next = updater(itemsRef.current)
    itemsRef.current = next
    setItems(next)
  }, [])

  // Blob previews are revoked on unmount; a queue of 40 files otherwise pins
  // every one of those images in memory for the life of the page.
  useEffect(() => {
    const seeded: QueueItem[] = files.map((file, index) => {
      const rejection = uploadRejection(file)
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        name: baseName(file.name),
        altText: baseName(file.name).replace(/[-_]+/g, ' '),
        status: rejection ? 'error' : 'queued',
        progress: 0,
        ...(rejection ? { error: rejection } : {}),
      }
    })
    itemsRef.current = seeded
    setItems(seeded)
    return () => {
      for (const item of seeded) {
        if (item.preview) URL.revokeObjectURL(item.preview)
      }
    }
  }, [files])

  const patch = useCallback(
    (id: string, changes: Partial<QueueItem>) => {
      commit((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)))
    },
    [commit],
  )

  const uploadOne = useCallback(
    async (item: QueueItem) => {
      const controller = new AbortController()
      abortRef.current.set(item.id, controller)
      const uploadId = `${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
      let uploadedUrl: string | null = null
      let committed = false
      try {
        patch(item.id, { status: 'uploading', progress: 0, error: undefined })
        const uploaded = await uploadAdminImage(item.file, 'media', {
          signal: controller.signal,
          uploadId,
          watermark: watermark && RASTER_UPLOAD.has(item.file.type),
          optimize: RASTER_UPLOAD.has(item.file.type) && item.file.type !== 'image/gif',
          onProgress: (percent) => {
            patch(item.id, {
              progress: percent,
              ...(percent >= 100 ? { status: 'optimizing' as const } : {}),
            })
          },
        })
        uploadedUrl = uploaded.url
        patch(item.id, { status: 'indexing', progress: 100 })

        const indexed = await createMediaAsset({
          name: item.name.trim() || baseName(item.file.name),
          path: uploaded.url,
          altText: item.altText.trim() || item.name.trim() || baseName(item.file.name),
          folder,
          ...(uploaded.mimeType ? { mimeType: uploaded.mimeType } : {}),
          ...(uploaded.sizeBytes !== undefined ? { sizeBytes: uploaded.sizeBytes } : {}),
          ...(uploaded.width !== undefined ? { width: uploaded.width } : {}),
          ...(uploaded.height !== undefined ? { height: uploaded.height } : {}),
          ...(uploaded.contentHash ? { contentHash: uploaded.contentHash } : {}),
          ...(uploaded.kind ? { kind: uploaded.kind } : {}),
          ...(uploaded.watermarked ? { watermarked: true } : {}),
        })
        committed = true
        patch(item.id, { status: 'done', progress: 100, contentHash: indexed.contentHash ?? null })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed'
        const cancelled = message === 'Upload cancelled'
        // An upload that never reached the index leaves a file nothing points
        // at — drop it here rather than leaving it for the orphan sweep.
        if (!committed && uploadedUrl) {
          await cleanupOrphanWithRetry(uploadedUrl).catch(() => undefined)
        }
        patch(item.id, {
          status: cancelled ? 'cancelled' : 'error',
          ...(cancelled ? {} : { error: message }),
        })
      } finally {
        abortRef.current.delete(item.id)
      }
    },
    [folder, patch, watermark],
  )

  const run = useCallback(async () => {
    setRunning(true)
    onProgressChange?.(true)
    const pending = itemsRef.current.filter((item) => item.status === 'queued')
    let cursor = 0
    const workers = Array.from({ length: Math.min(CONCURRENCY, pending.length) }, async () => {
      while (cursor < pending.length) {
        const next = pending[cursor]
        cursor += 1
        if (next) await uploadOne(next)
      }
    })
    await Promise.all(workers)

    // Hash-match the batch against the library so a re-uploaded file is called
    // out instead of quietly doubling the folder.
    const settled = itemsRef.current
    let duplicates = 0
    if (settled.some((item) => item.status === 'done' && item.contentHash)) {
      try {
        const dupes = await fetchLibraryMedia({ duplicates: true })
        const dupeHashes = new Set(dupes.assets.map((asset) => asset.contentHash).filter(Boolean))
        const flagged = new Set(
          settled
            .filter((item) => item.status === 'done' && item.contentHash && dupeHashes.has(item.contentHash))
            .map((item) => item.id),
        )
        duplicates = flagged.size
        if (duplicates > 0) {
          commit((prev) => prev.map((item) => (flagged.has(item.id) ? { ...item, duplicate: true } : item)))
        }
      } catch {
        // A duplicate check that fails is not an upload failure — the files are saved.
      }
    }

    setRunning(false)
    onProgressChange?.(false)
    onFinished({
      saved: settled.filter((item) => item.status === 'done').length,
      failed: settled.filter((item) => item.status === 'error').length,
      duplicates,
    })
  }, [commit, onFinished, onProgressChange, uploadOne])

  // Start as soon as the queue is seeded — the admin already chose these files.
  useEffect(() => {
    if (startedRef.current || items.length === 0) return
    startedRef.current = true
    void run()
  }, [items, run])

  useEffect(() => {
    const controllers = abortRef.current
    return () => {
      for (const controller of controllers.values()) controller.abort()
    }
  }, [])

  const totals = useMemo(() => {
    const done = items.filter((item) => item.status === 'done').length
    const failed = items.filter((item) => item.status === 'error').length
    const bytes = items.reduce((sum, item) => sum + item.file.size, 0)
    return { done, failed, bytes }
  }, [items])

  const retryable = items.filter((item) => item.status === 'error' || item.status === 'cancelled')

  return (
    <div className="dc-mup">
      <div className="dc-mup__head">
        <span className="dc-mup__meta">
          {totals.done}/{items.length} saved · {formatBytes(totals.bytes)}
          {totals.failed > 0 ? ` · ${totals.failed} failed` : ''}
        </span>
        {running ? (
          <button
            type="button"
            className="dc-mup__tool is-danger"
            onClick={() => {
              for (const controller of abortRef.current.values()) controller.abort()
            }}
          >
            Cancel remaining
          </button>
        ) : retryable.length > 0 ? (
          <button
            type="button"
            className="dc-mup__tool"
            onClick={() => {
              commit((prev) =>
                prev.map((item) =>
                  item.status === 'error' || item.status === 'cancelled'
                    ? { ...item, status: 'queued' as const, progress: 0, error: undefined }
                    : item,
                ),
              )
              void run()
            }}
          >
            Retry {retryable.length} failed
          </button>
        ) : null}
      </div>

      <ul className="dc-mup__list">
        {items.map((item) => (
          <li key={item.id} className={`dc-mup__row is-${item.status}`}>
            {item.preview ? (
              <img className="dc-mup__thumb" src={item.preview} alt="" />
            ) : (
              <span className="dc-mup__thumb dc-mup__thumb--icon">
                <DcIcon name={item.file.type === 'application/pdf' ? 'icon-file-text' : 'icon-film'} size={15} />
              </span>
            )}
            <div className="dc-mup__body">
              <span className="dc-mup__name" title={item.file.name}>
                {item.file.name}
              </span>
              <span className="dc-mup__sub">
                {formatBytes(item.file.size)} · {STATUS_LABEL[item.status]}
                {item.error ? ` — ${item.error}` : ''}
                {item.duplicate ? ' — same file already in the library' : ''}
              </span>
              <span className="dc-mup__track" aria-hidden>
                <span
                  className="dc-mup__fill"
                  style={{ width: `${item.status === 'done' ? 100 : item.progress}%` }}
                />
              </span>
            </div>
            <span className="dc-mup__state">
              {item.status === 'done' ? (
                <DcIcon name={item.duplicate ? 'icon-copy' : 'icon-check'} size={14} />
              ) : item.status === 'error' ? (
                <DcIcon name="icon-alert-triangle" size={14} />
              ) : item.status === 'cancelled' ? (
                <DcIcon name="icon-x" size={14} />
              ) : item.status === 'queued' ? (
                <button
                  type="button"
                  className="dc-mup__drop"
                  aria-label={`Remove ${item.file.name} from the queue`}
                  onClick={() => commit((prev) => prev.filter((row) => row.id !== item.id))}
                >
                  <DcIcon name="icon-x" size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  className="dc-mup__drop"
                  aria-label={`Cancel ${item.file.name}`}
                  onClick={() => abortRef.current.get(item.id)?.abort()}
                >
                  <DcIcon name="icon-x" size={13} />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

'use client'

/* eslint-disable @next/next/no-img-element -- runtime upload URLs, not build-time assets */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { formatBytes } from '@/components/dc/media/DcStoragePanel'
import { useMediaOrphans } from '@/lib/api/hooks'
import {
  bulkDeleteMediaAssets,
  createMediaAsset,
  purgeMediaOrphans,
  type LibraryMediaAsset,
} from '@/lib/api/media'
import { resolveMediaUrl } from '@/lib/media-url'
import { heroMediaPreviewSrc } from '@splaro/config'
import '@/styles/dc-media-panes.css'

/**
 * The two panes that clean the library up rather than browse it.
 *
 * Duplicates and orphans are both "the library holds more than it should"
 * problems, but they need opposite treatment: a duplicate is indexed and safe to
 * trash, an orphan is a file Postgres has never heard of and may still be linked
 * by hand, so deleting one goes through the usage-checked endpoint.
 */

const PANE_SKELETON: DcBlock[] = [{ t: 'media', title: '', slots: [] } as DcBlock]

function newestFirst(a: LibraryMediaAsset, b: LibraryMediaAsset): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

export interface DcDuplicateGroupsProps {
  assets: LibraryMediaAsset[]
  loading: boolean
  error: unknown
  onRetry: () => void
  onChanged: () => void
  toast: (tone: 'ok' | 'bad' | 'warn' | 'info', title: string, body?: string) => void
}

/** Same-hash assets, grouped, with a one-click "keep the newest" resolution. */
export function DcDuplicateGroups({ assets, loading, error, onRetry, onChanged, toast }: DcDuplicateGroupsProps) {
  const groups = useMemo(() => {
    const byHash = new Map<string, LibraryMediaAsset[]>()
    for (const asset of assets) {
      if (!asset.contentHash) continue
      byHash.set(asset.contentHash, [...(byHash.get(asset.contentHash) ?? []), asset])
    }
    return [...byHash.entries()]
      .map(([hash, rows]) => {
        const sorted = [...rows].sort(newestFirst)
        return {
          hash,
          rows: sorted,
          wastedBytes: sorted.slice(1).reduce((sum, row) => sum + (row.sizeBytes ?? 0), 0),
        }
      })
      .filter((group) => group.rows.length > 1)
      .sort((a, b) => b.wastedBytes - a.wastedBytes)
  }, [assets])

  const keepNewest = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteMediaAssets(ids),
    onSuccess: (res) => {
      const failed = res.results.filter((row) => !row.ok)
      onChanged()
      if (failed.length > 0) {
        toast('warn', `${res.results.length - failed.length} trashed`, `${failed.length} still linked — unlink them first.`)
        return
      }
      toast('ok', `${res.results.length} copies trashed`, 'The newest file stayed in the library.')
    },
    onError: (err) => toast('bad', 'Could not trash copies', err instanceof Error ? err.message : 'Bulk delete failed'),
  })

  if (loading) return <DcLoadingState blocks={PANE_SKELETON} />
  if (error) {
    return (
      <DcErrorState
        error={`GET /admin/media?duplicates=1 → ${error instanceof Error ? error.message : 'failed'}`}
        hint="Nothing was changed — this is only the duplicate scan."
        onRetry={onRetry}
      />
    )
  }
  if (groups.length === 0) {
    return (
      <DcEmptyState
        icon="icon-copy-check"
        title="No duplicate files"
        body="Every indexed file in this library has its own content hash."
      />
    )
  }

  const reclaimable = groups.reduce((sum, group) => sum + group.wastedBytes, 0)

  return (
    <div className="dc-mpane">
      <div className="dc-mpane__head">
        <span className="dc-mpane__lead">
          {groups.length} duplicate group{groups.length === 1 ? '' : 's'}
        </span>
        <span className="dc-mpane__meta">{formatBytes(reclaimable)} reclaimable</span>
      </div>

      {groups.map((group) => (
        <div key={group.hash} className="dc-mpane__group">
          <div className="dc-mpane__group-head">
            <span className="dc-mpane__name">{group.rows[0]?.name ?? 'Duplicate'}</span>
            <span className="dc-mpane__meta">
              {group.rows.length} copies · {formatBytes(group.wastedBytes)} wasted
            </span>
            <button
              type="button"
              className="dc-mpane__tool"
              disabled={keepNewest.isPending}
              onClick={() => keepNewest.mutate(group.rows.slice(1).map((row) => row.id))}
            >
              Keep newest, trash {group.rows.length - 1}
            </button>
          </div>
          <ul className="dc-mpane__copies">
            {group.rows.map((row, index) => {
              const url = resolveMediaUrl(row.path)
              return (
                <li key={row.id} className={index === 0 ? 'is-keep' : ''}>
                  {url ? <img src={heroMediaPreviewSrc(url)} alt="" /> : <span className="dc-mpane__noimg" />}
                  <span className="dc-mpane__copy-name" title={row.path}>
                    {row.name}
                  </span>
                  <span className="dc-mpane__meta">
                    {row.folder} · {formatBytes(row.sizeBytes ?? 0)} · {new Date(row.createdAt).toLocaleDateString()}
                  </span>
                  <span className={`dc-mpane__flag${index === 0 ? ' is-keep' : ''}`}>
                    {index === 0 ? 'Keeping' : 'Trash'}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

export interface DcOrphanPaneProps {
  onChanged: () => void
  toast: (tone: 'ok' | 'bad' | 'warn' | 'info', title: string, body?: string) => void
}

/**
 * Files sitting in the upload folder that no asset row points at.
 *
 * Listing one does not prove it is unused — a URL pasted into a banner outlives
 * its index row — so "Delete" goes through `/admin/media/orphans/purge`, which
 * runs the same usage check the single-asset delete does and refuses a linked
 * file. "Index it" is the opposite fix: adopt the file into the library instead.
 */
export function DcOrphanPane({ onChanged, toast }: DcOrphanPaneProps) {
  const orphans = useMediaOrphans()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['media-orphans'] })
    void qc.invalidateQueries({ queryKey: ['media-storage'] })
    onChanged()
  }

  const purge = useMutation({
    mutationFn: (paths: string[]) => purgeMediaOrphans(paths),
    onSuccess: (res) => {
      setSelected(new Set())
      refresh()
      const failed = res.results.filter((row) => !row.ok)
      if (failed.length > 0) {
        toast(
          'warn',
          `${res.deleted} deleted · ${failed.length} kept`,
          failed[0]?.error ?? 'Some files are still referenced somewhere.',
        )
        return
      }
      toast('ok', `${res.deleted} file${res.deleted === 1 ? '' : 's'} deleted`, 'Disk space is back.')
    },
    onError: (err) => toast('bad', 'Purge failed', err instanceof Error ? err.message : 'Could not delete orphans'),
  })

  const adopt = useMutation({
    mutationFn: (orphan: { path: string; bytes: number }) =>
      createMediaAsset({
        name: orphan.path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Recovered file',
        path: orphan.path,
        folder: 'media',
        sizeBytes: orphan.bytes,
      }),
    onSuccess: () => {
      refresh()
      toast('ok', 'File indexed', 'It now shows in the library and counts against storage.')
    },
    onError: (err) => toast('bad', 'Could not index file', err instanceof Error ? err.message : 'POST /admin/media failed'),
  })

  if (orphans.isLoading) return <DcLoadingState blocks={PANE_SKELETON} />
  if (orphans.error) {
    return (
      <DcErrorState
        error={`GET /admin/media/orphans → ${orphans.error instanceof Error ? orphans.error.message : 'failed'}`}
        hint="Nothing was deleted — this is only the disk scan."
        onRetry={() => void orphans.refetch()}
      />
    )
  }

  const data = orphans.data
  if (!data || data.orphans.length === 0) {
    return (
      <DcEmptyState
        icon="icon-check"
        title="No stray files"
        body={
          data?.available === false
            ? 'The upload folder could not be read, so nothing can be listed here.'
            : 'Every file in the upload folder is indexed in the library.'
        }
      />
    )
  }

  const selectable = data.orphans.filter((row) => row.purgeSafe)
  const selectedRows = data.orphans.filter((row) => selected.has(row.path))

  return (
    <div className="dc-mpane">
      <div className="dc-mpane__head">
        <span className="dc-mpane__lead">
          {data.total} stray file{data.total === 1 ? '' : 's'} · {formatBytes(data.totalBytes)} reclaimable
        </span>
        {data.returned < data.total ? (
          <span className="dc-mpane__meta">showing the {data.returned} largest</span>
        ) : null}
        <label className="dc-mpane__check">
          <input
            type="checkbox"
            checked={selectable.length > 0 && selected.size === selectable.length}
            onChange={(event) =>
              setSelected(event.target.checked ? new Set(selectable.map((row) => row.path)) : new Set())
            }
          />
          Select all deletable
        </label>
        {selected.size > 0 ? (
          <button
            type="button"
            className="dc-mpane__tool is-danger"
            disabled={purge.isPending}
            onClick={() => purge.mutate([...selected])}
          >
            Delete {selected.size} · {formatBytes(selectedRows.reduce((sum, row) => sum + row.bytes, 0))}
          </button>
        ) : null}
        <button type="button" className="dc-mpane__tool" onClick={() => void orphans.refetch()}>
          <DcIcon name="icon-refresh-cw" size={12} /> Rescan
        </button>
      </div>

      <ul className="dc-mpane__rows">
        {data.orphans.map((row) => (
          <li key={row.familyKey} className="dc-mpane__row">
            <input
              type="checkbox"
              checked={selected.has(row.path)}
              disabled={!row.purgeSafe}
              aria-label={`Select ${row.path}`}
              onChange={() =>
                setSelected((prev) => {
                  const next = new Set(prev)
                  if (next.has(row.path)) next.delete(row.path)
                  else next.add(row.path)
                  return next
                })
              }
            />
            <span className="dc-mpane__body">
              <span className="dc-mpane__copy-name" title={row.path}>
                {row.path}
              </span>
              <span className="dc-mpane__meta">
                {formatBytes(row.bytes)} · {row.files} file{row.files === 1 ? '' : 's'} ·{' '}
                {new Date(row.modifiedAt).toLocaleString()}
                {row.pending ? ' · still uploading' : ''}
              </span>
            </span>
            <button
              type="button"
              className="dc-mpane__tool"
              disabled={adopt.isPending || row.pending}
              onClick={() => adopt.mutate({ path: row.path, bytes: row.bytes })}
            >
              Index it
            </button>
            <button
              type="button"
              className="dc-mpane__tool is-danger"
              disabled={purge.isPending || !row.purgeSafe}
              title={row.purgeSafe ? undefined : 'Uploaded moments ago — it may still be in flight'}
              onClick={() => purge.mutate([row.path])}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

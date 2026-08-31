'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'

import { DcModal } from '@/components/dc/DcModal'
import { FONT } from '@/components/dc/tokens'
import { heroMediaPreviewSrc } from '@splaro/config'
import { MEDIA_DEPT_FOLDERS } from '@/lib/admin/size-presets'
import { useMedia } from '@/lib/api/hooks'
import { mediaIdentity, resolveMediaUrl } from '@/lib/media-url'
import { DcIcon } from '@/components/dc/DcIcon'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'

const PICKER_FOLDERS = [
  { key: 'all', label: 'All media' },
  { key: 'media', label: 'General / Hero' },
  ...MEDIA_DEPT_FOLDERS.filter((folder) => folder.key !== 'all').map((folder) => ({
    key: folder.key,
    label: folder.label,
  })),
] as const

interface MediaAsset {
  id: string
  name: string
  url: string
  altText?: string
  folder?: string
  type?: string
}

export function DcMediaPickModal({
  open,
  onClose,
  onPick,
  preferredFolder,
  excludeUrls = [],
}: {
  open: boolean
  onClose: () => void
  onPick: (url: string) => void
  preferredFolder?: string
  excludeUrls?: string[]
}) {
  const preferredKey = preferredFolder === 'media'
    ? 'media'
    : MEDIA_DEPT_FOLDERS.find((folder) => folder.folder === preferredFolder)?.key ?? 'all'
  const [folderKey, setFolderKey] = useState(preferredKey)
  const [query, setQuery] = useState('')
  const deferredQuery = useDebouncedValue(query)
  const media = useMedia({
    limit: 60,
    q: deferredQuery,
    folder: folderKey as 'all' | 'media' | 'men' | 'women' | 'kids' | 'footwear' | 'accessories',
  })

  useEffect(() => {
    if (!open) return
    setFolderKey(preferredKey)
    setQuery('')
  }, [open, preferredKey])

  const excludedKeys = useMemo(
    () => new Set(excludeUrls.map(mediaIdentity).filter(Boolean)),
    [excludeUrls],
  )
  const fetchedAssets = useMemo(
    () => (media.data?.pages.flatMap((page) => page.assets) ?? []).filter((a) => Boolean(a.url)) as MediaAsset[],
    [media.data],
  )
  const assets = useMemo(
    () => fetchedAssets.filter((asset) => !excludedKeys.has(mediaIdentity(asset.url))),
    [excludedKeys, fetchedAssets],
  )
  const folderLabel = PICKER_FOLDERS.find((f) => f.key === folderKey)?.label ?? 'All media'
  const hasFetchedAssets = fetchedAssets.length > 0
  // A page whose photos are all on this product already filters down to
  // nothing. Keep paging so the unused photos further down stay reachable
  // instead of the modal reporting the folder as exhausted.
  const fetchingHiddenPage =
    assets.length === 0 && media.hasNextPage && !media.isLoading && !media.isFetchNextPageError

  let emptyTitle = `${folderLabel} has no photos yet`
  let emptyBody = 'Upload from Media Library, or drop a file straight onto the product slot.'
  if (query) {
    emptyTitle = 'No unused photo matches that search'
    emptyBody = 'Clear the search, or switch to another folder tab.'
  } else if (hasFetchedAssets) {
    emptyTitle = `All ${folderLabel.toLowerCase()} photos are already used`
    emptyBody = 'Choose another folder or upload a new photo.'
  }

  const { fetchNextPage, isFetchingNextPage } = media
  useEffect(() => {
    if (!open || !fetchingHiddenPage || isFetchingNextPage) return
    void fetchNextPage()
  }, [fetchNextPage, fetchingHiddenPage, isFetchingNextPage, open])

  return (
    <DcModal
      open={open}
      title="Pick from media library"
      subtitle="Men · Women · Kids · Footwear · Accessories folders keep photos organised."
      confirmLabel="Close"
      width="min(880px, 100%)"
      onClose={onClose}
      onConfirm={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, flex: 1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PICKER_FOLDERS.map((f) => {
            const on = folderKey === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFolderKey(f.key)}
                aria-pressed={on}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 999,
                  border: `1px solid ${on ? 'var(--violet-bd)' : 'var(--line)'}`,
                  background: on ? 'var(--violet-soft)' : 'var(--surface-2)',
                  color: on ? 'var(--violet)' : 'var(--ink-2)',
                  font: `600 11.5px/1 ${FONT}`,
                  cursor: 'pointer',
                }}
              >
                <span>{f.label}</span>
              </button>
            )
          })}
        </div>

        <label style={{ position: 'relative', display: 'block' }}>
          <span
            style={{
              position: 'absolute',
              left: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--ink-3)',
              pointerEvents: 'none',
            }}
          >
            <DcIcon name="icon-search" size={14} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${folderLabel.toLowerCase()} by name or URL…`}
            aria-label="Search media library"
            style={{
              width: '100%',
              height: 38,
              padding: '0 34px 0 32px',
              borderRadius: 9,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: `500 12.5px/1 ${FONT}`,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'grid',
                placeItems: 'center',
                width: 22,
                height: 22,
                border: 0,
                borderRadius: 6,
                background: 'transparent',
                color: 'var(--ink-3)',
                cursor: 'pointer',
              }}
            >
              <DcIcon name="icon-x" size={13} />
            </button>
          ) : null}
        </label>

        {media.isLoading || fetchingHiddenPage ? (
          <div className="dc-media-pick__grid" aria-busy="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="dc-skeleton dc-media-pick__skeleton" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '48px 20px',
              border: '1px dashed var(--line-2)',
              borderRadius: 12,
              background: 'var(--surface-2)',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 44,
                height: 44,
                borderRadius: 12,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                color: 'var(--ink-3)',
              }}
            >
              <DcIcon name={query ? 'icon-search-x' : 'icon-image-off'} size={19} />
            </span>
            <span style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
              {emptyTitle}
            </span>
            <span
              style={{
                font: `400 11.5px/1.5 ${FONT}`,
                color: 'var(--ink-3)',
                maxWidth: 360,
                textWrap: 'pretty',
              }}
            >
              {emptyBody}
            </span>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                font: `500 11px/1 ${FONT}`,
                color: 'var(--ink-3)',
              }}
            >
              <span>
                Showing {assets.length} · {folderLabel}
              </span>
            </div>

            <div className="dc-media-pick__grid">
              {assets.map((a) => {
                const src = heroMediaPreviewSrc(resolveMediaUrl(a.url))
                return (
                  <button
                    key={`${a.type ?? 'media'}-${a.id}`}
                    type="button"
                    title={a.name}
                    onClick={() => {
                      onPick(a.url)
                      onClose()
                    }}
                    className="dc-media-pick__tile"
                  >
                    <span className="dc-media-pick__thumb">
                      {src ? (
                        <Image
                          src={src}
                          alt=""
                          fill
                          sizes="180px"
                          style={{ objectFit: 'cover' }}
                          unoptimized
                        />
                      ) : (
                        <span
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--ink-3)',
                          }}
                        >
                          <DcIcon name="icon-image" size={18} />
                        </span>
                      )}
                      <span className="dc-media-pick__veil" aria-hidden>
                        <DcIcon name="icon-check" size={17} />
                        <span>Use photo</span>
                      </span>
                    </span>
                    {/* Without a caption there is no way to tell one crop from another. */}
                    <span className="dc-media-pick__name">{a.name}</span>
                  </button>
                )
              })}
            </div>

            {media.hasNextPage ? (
              <button
                type="button"
                disabled={media.isFetchingNextPage}
                onClick={() => void media.fetchNextPage()}
                className="dc-hover-line"
                style={{
                  alignSelf: 'center',
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 9,
                  border: '1px solid var(--line-2)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink-2)',
                  cursor: media.isFetchingNextPage ? 'wait' : 'pointer',
                  font: `600 12px/1 ${FONT}`,
                }}
              >
                {media.isFetchingNextPage ? 'Loading…' : 'Load more media'}
              </button>
            ) : null}
          </>
        )}
      </div>
    </DcModal>
  )
}

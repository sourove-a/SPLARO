'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'

import { DcModal } from '@/components/dc/DcModal'
import { DcField, DcInput } from '@/components/dc/product/DcProductFormPrimitives'
import { FONT } from '@/components/dc/tokens'
import { MEDIA_DEPT_FOLDERS, mediaDeptKeyFromUrl } from '@/lib/admin/size-presets'
import { useMedia } from '@/lib/api/hooks'
import { resolveMediaUrl } from '@/lib/media-url'

export function DcMediaPickModal({
  open,
  onClose,
  onPick,
  preferredFolder,
}: {
  open: boolean
  onClose: () => void
  onPick: (url: string) => void
  preferredFolder?: string
}) {
  const media = useMedia()
  const preferredKey =
    MEDIA_DEPT_FOLDERS.find((f) => f.folder === preferredFolder)?.key ?? 'all'
  const [folderKey, setFolderKey] = useState(preferredKey)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setFolderKey(preferredKey)
  }, [open, preferredKey])

  const rows = useMemo(() => {
    const list = (media.data?.assets ?? []) as { id: string; name: string; url: string; altText?: string }[]
    const q = query.trim().toLowerCase()
    return list.filter((a) => {
      if (!a.url) return false
      const key = mediaDeptKeyFromUrl(a.url)
      if (folderKey !== 'all') {
        // Dept tab: matching dept folder OR shared /uploads/products/
        if (key !== folderKey && key !== 'all') return false
      }
      if (!q) return true
      return (
        a.name.toLowerCase().includes(q) ||
        (a.altText ?? '').toLowerCase().includes(q) ||
        a.url.toLowerCase().includes(q)
      )
    })
  }, [media.data, folderKey, query])

  return (
    <DcModal
      open={open}
      title="Pick from media library"
      subtitle="Men · Women · Kids · Footwear · Accessories folders keep photos organised."
      confirmLabel="Close"
      onClose={onClose}
      onConfirm={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MEDIA_DEPT_FOLDERS.map((f) => {
            const on = folderKey === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFolderKey(f.key)}
                style={{
                  border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                  borderRadius: 999,
                  padding: '6px 12px',
                  background: on ? 'var(--ink)' : 'transparent',
                  color: on ? 'var(--surface)' : 'var(--ink-2)',
                  font: `600 11px/1 ${FONT}`,
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
        <DcField label="Search">
          <DcInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or URL…" />
        </DcField>
        {media.isLoading ? (
          <div style={{ color: 'var(--ink-3)', font: `500 13px/1.4 ${FONT}` }}>Loading library…</div>
        ) : rows.length === 0 ? (
          <div style={{ color: 'var(--ink-3)', font: `500 13px/1.4 ${FONT}` }}>
            No images in this folder yet. Upload from Media Library or drop a file on the product slot.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
              gap: 10,
              overflow: 'auto',
              paddingBottom: 8,
            }}
          >
            {rows.slice(0, 80).map((a) => {
              const src = resolveMediaUrl(a.url)
              return (
                <button
                  key={a.id}
                  type="button"
                  title={a.name}
                  onClick={() => {
                    onPick(a.url)
                    onClose()
                  }}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: 10,
                    border: '1px solid var(--line)',
                    overflow: 'hidden',
                    padding: 0,
                    cursor: 'pointer',
                    background: 'var(--surface-2)',
                  }}
                >
                  {src ? (
                    <Image src={src} alt={a.name} fill sizes="96px" style={{ objectFit: 'cover' }} unoptimized />
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </DcModal>
  )
}

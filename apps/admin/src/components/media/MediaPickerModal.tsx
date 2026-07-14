'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { ImageIcon, Loader2, Search, X } from 'lucide-react'
import { useMedia } from '@/lib/api/hooks'
import { MediaUploadZone } from '@/components/media/MediaUploadZone'
import { resolveMediaUrl } from '@/lib/media-url'
import { AdminButton } from '@/components/ui/AdminButton'
import { cn } from '@/lib/utils/cn'

type TabId = 'all' | 'library' | 'product' | 'recent'

interface MediaPickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
  title?: string
  multi?: boolean
  onSelectMany?: (urls: string[]) => void
}

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
  title = 'Choose from library',
  multi = false,
  onSelectMany,
}: MediaPickerModalProps) {
  const { data, isLoading, isError, refetch } = useMedia()
  const [tab, setTab] = useState<TabId>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const assets = useMemo(() => {
    const list = (data?.assets ?? []).filter((a) => !/\.(mp4|webm|mov)/i.test(a.url))
    const q = query.toLowerCase().trim()
    let filtered = q ? list.filter((a) => a.name.toLowerCase().includes(q)) : list
    if (tab === 'library') filtered = filtered.filter((a) => a.type === 'banner' || a.source.includes('library'))
    if (tab === 'product') filtered = filtered.filter((a) => a.type === 'product')
    if (tab === 'recent') filtered = [...filtered].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 40)
    return filtered
  }, [data, query, tab])

  if (!open) return null

  const toggle = (url: string) => {
    if (!multi) {
      setSelected([url])
      return
    }
    setSelected((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]))
  }

  const confirm = () => {
    if (multi && onSelectMany) {
      onSelectMany(selected)
    } else if (selected[0]) {
      onSelect(selected[0])
    }
    setSelected([])
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[20px] border border-black/8 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-black/6 px-5 py-4">
          <div>
            <h3 className="text-sm font-black text-[var(--admin-text-primary)]">{title}</h3>
            <p className="text-[11px] font-semibold text-[var(--admin-text-muted)]">Pick from media library or upload new</p>
          </div>
          <button type="button" className="rounded-full p-2 hover:bg-black/5" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-black/6 px-5 py-3">
          {(['all', 'library', 'product', 'recent'] as TabId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={cn(
                'rounded-full px-3 py-1 text-[11px] font-bold capitalize',
                tab === id ? 'bg-[#101114] text-white' : 'bg-black/5 text-[var(--admin-text-secondary)]',
              )}
              onClick={() => setTab(id)}
            >
              {id}
            </button>
          ))}
          <div className="relative ml-auto min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-text-muted)]" />
            <input
              className="admin-input w-full pl-9"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4">
            <MediaUploadZone
              folder="media"
              label="Upload new image"
              onUploaded={(url) => {
                void refetch()
                if (!multi) {
                  onSelect(url)
                  onClose()
                } else {
                  setSelected((prev) => [...prev, url])
                }
              }}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm font-semibold text-[var(--admin-text-muted)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading library…
            </div>
          ) : isError ? (
            <p className="py-8 text-center text-sm font-semibold text-red-700">API offline — cannot load media library.</p>
          ) : assets.length === 0 ? (
            <p className="py-8 text-center text-sm font-semibold text-[var(--admin-text-secondary)]">No images found.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {assets.map((asset) => {
                const url = resolveMediaUrl(asset.url)
                const isSelected = selected.includes(asset.url)
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={cn(
                      'group relative aspect-square overflow-hidden rounded-[12px] border-2 bg-[#f7f7f7]',
                      isSelected ? 'border-[#c8a97e]' : 'border-transparent hover:border-black/10',
                    )}
                    onClick={() => toggle(asset.url)}
                  >
                    <Image src={url} alt={asset.name} fill unoptimized sizes="120px" className="object-cover" />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-[9px] font-semibold text-white">
                      {asset.name}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-black/6 px-5 py-4">
          <span className="text-[11px] font-semibold text-[var(--admin-text-muted)]">
            {multi ? `${selected.length} selected` : selected[0] ? '1 selected' : 'Select an image'}
          </span>
          <div className="flex gap-2">
            <AdminButton variant="ghost" onClick={onClose}>
              Cancel
            </AdminButton>
            <AdminButton variant="gold" disabled={!selected.length} onClick={confirm}>
              <ImageIcon className="h-4 w-4" />
              Use selected
            </AdminButton>
          </div>
        </footer>
      </div>
    </div>
  )
}

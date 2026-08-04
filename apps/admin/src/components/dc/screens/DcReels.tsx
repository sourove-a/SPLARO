'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, type CSSProperties } from 'react'

import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcField, DcModal } from '@/components/dc/DcModal'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle } from '@/components/dc/tokens'
import {
  verifyBannerDeleteSuccess,
  verifyBooleanEquals,
  verifyStringEquals,
} from '@/lib/admin/mutation-verify'
import {
  createBanner,
  deleteBanner,
  fetchBanners,
  updateBanner,
  type BannerRow,
} from '@/lib/api/banners'
import { uploadAdminImage } from '@/lib/api/upload'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { resolveMediaUrl } from '@/lib/media-url'

const REELS_POSITION = 'reels'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

export function DcReels() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="reels" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcReelsBody />
    </DcScreenProvider>
  )
}

function DcReelsBody() {
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const { api } = useAdminConnection(25_000)
  const fileRef = useRef<HTMLInputElement>(null)

  const banners = useQuery({
    queryKey: ['banners', REELS_POSITION],
    queryFn: () => fetchBanners(REELS_POSITION),
    staleTime: 30_000,
  })

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['banners'] })

  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<BannerRow | null>(null)
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => banners.data?.banners ?? [], [banners.data])
  const active = rows.filter((b) => b.isActive)

  const pageStatus = dcPageStatus([banners], api.pulse)
  const skeleton: DcBlock[] = [{ t: 'cards', cardMin: '240px', items: [] } as DcBlock]

  const onPickFile = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    try {
      const uploaded = await uploadAdminImage(file)
      const url = uploaded.url
      if (!url) {
        toast('bad', 'Upload failed', 'No URL returned from /api/upload')
        return
      }
      setImageUrl(url)
      toast('ok', 'Media uploaded', 'URL ready — save the reel to attach it.')
    } catch (err) {
      toast('bad', 'Upload failed', err instanceof Error ? err.message : 'Upload error')
    } finally {
      setBusy(false)
    }
  }

  const runCreate = async () => {
    if (!imageUrl.trim()) {
      toast('warn', 'Image required', 'Upload or paste a media URL before saving.')
      return
    }
    setBusy(true)
    try {
      const payload: Parameters<typeof createBanner>[0] = {
        image: imageUrl.trim(),
        position: REELS_POSITION,
        isActive: true,
      }
      const t = title.trim()
      const link = linkUrl.trim()
      if (t) payload.title = t
      if (link) payload.linkUrl = link
      const saved = await createBanner(payload)
      if (!verifyStringEquals(saved.position, REELS_POSITION, 'Reel position')) return
      if (!verifyBooleanEquals(saved.isActive, true, 'Reel active')) return
      setFormOpen(false)
      setTitle('')
      setLinkUrl('')
      setImageUrl('')
      invalidate()
      toast('ok', 'Reel saved', 'Banner confirmed with position=reels.')
    } catch (err) {
      toast('bad', 'Save failed', err instanceof Error ? err.message : 'Check API')
    } finally {
      setBusy(false)
    }
  }

  const runToggle = async (row: BannerRow) => {
    const next = !row.isActive
    setBusy(true)
    try {
      const saved = await updateBanner(row.id, { isActive: next })
      if (!verifyBooleanEquals(saved.isActive, next, 'Reel active')) return
      invalidate()
      toast('ok', next ? 'Reel live' : 'Reel hidden', 'Server confirmed.')
    } catch (err) {
      toast('bad', 'Update failed', err instanceof Error ? err.message : 'Check API')
    } finally {
      setBusy(false)
    }
  }

  const runDelete = async () => {
    if (!confirmDelete) return
    setBusy(true)
    try {
      const res = await deleteBanner(confirmDelete.id)
      if (!verifyBannerDeleteSuccess(res)) return
      setConfirmDelete(null)
      invalidate()
      toast('ok', 'Reel deleted', 'Removed from banners API.')
    } catch (err) {
      toast('bad', 'Delete failed', err instanceof Error ? err.message : 'Check API')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Content"
        title="Reels"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          banners.isFetching ? 'syncing…' : `${rows.length} reel${rows.length === 1 ? '' : 's'}`
        }
        syncing={banners.isFetching}
        onSync={() => void banners.refetch()}
        actions={[
          {
            label: 'Add reel',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => {
              setTitle('')
              setLinkUrl('')
              setImageUrl('')
              setFormOpen(true)
            },
          },
        ]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 32px' }}>
        <DcContentNav active="reels" />
        <p style={{ margin: 0, font: `400 13px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
          Reels are banners with position <span style={{ fontFamily: MONO }}>reels</span>. Upload media,
          then save — green only after the banners API confirms.
        </p>

        {banners.isLoading ? (
          <DcLoadingState blocks={skeleton} />
        ) : banners.isError ? (
          <DcErrorState
            error={`GET /admin/banners?position=reels → ${banners.error instanceof Error ? banners.error.message : 'API error'}`}
            hint="Existing banners are unaffected — only this list failed."
            onRetry={() => void banners.refetch()}
          />
        ) : rows.length === 0 ? (
          <DcEmptyState
            icon="icon-clapperboard"
            title="No reels yet"
            body="Add a video or image banner tagged as reels."
            cta="Add reel"
            onCta={() => setFormOpen(true)}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {rows.map((row) => {
              const src = resolveMediaUrl(row.image)
              return (
                <div key={row.id} style={{ ...card, overflow: 'hidden' }}>
                  <div
                    style={{
                      aspectRatio: '9 / 16',
                      maxHeight: 280,
                      background: 'var(--bg)',
                      backgroundImage: src ? `url(${src})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                        {row.title || 'Untitled reel'}
                      </div>
                      <span
                        style={{
                          ...toneStyle(row.isActive ? 'ok' : 'warn'),
                          padding: '3px 8px',
                          borderRadius: 999,
                          font: `600 10px/1 ${FONT}`,
                          height: 'fit-content',
                        }}
                      >
                        {row.isActive ? 'Live' : 'Off'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" style={btn} disabled={busy} onClick={() => void runToggle(row)}>
                        {row.isActive ? 'Hide' : 'Show'}
                      </button>
                      <button
                        type="button"
                        style={{ ...btn, color: 'var(--bad)' }}
                        onClick={() => setConfirmDelete(row)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
          {active.length} live · {rows.length - active.length} hidden
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
      />

      <DcModal
        open={formOpen}
        title="Add reel"
        subtitle="Uploads media then creates a banner with position=reels."
        confirmLabel={busy ? 'Saving…' : 'Save reel'}
        busy={busy}
        onClose={() => !busy && setFormOpen(false)}
        onConfirm={() => void runCreate()}
      >
        <DcField label="Title" value={title} onChange={setTitle} />
        <DcField
          label="Link URL"
          value={linkUrl}
          onChange={setLinkUrl}
          placeholder="/shop or https://…"
        />
        <DcField
          label="Media URL"
          value={imageUrl}
          onChange={setImageUrl}
          placeholder="Upload or paste URL"
          mono
        />
        <button type="button" style={btn} disabled={busy} onClick={() => fileRef.current?.click()}>
          Upload media
        </button>
      </DcModal>

      <DcModal
        open={Boolean(confirmDelete)}
        title="Delete reel?"
        subtitle={confirmDelete ? `Remove “${confirmDelete.title || 'untitled'}”.` : undefined}
        confirmLabel="Delete"
        danger
        busy={busy}
        onClose={() => !busy && setConfirmDelete(null)}
        onConfirm={() => void runDelete()}
      />
    </>
  )
}

const btn: CSSProperties = {
  height: 30,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: `600 12px/1 ${FONT}`,
  color: 'var(--ink-2)',
  cursor: 'pointer',
}

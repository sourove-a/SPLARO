'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, toneStyle } from '@/components/dc/tokens'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import { verifyStringEquals } from '@/lib/admin/mutation-verify'
import { uploadAdminImage } from '@/lib/api/upload'
import {
  createWholesaleStockImage,
  deleteWholesaleStockImage,
  fetchWholesaleStock,
  updateWholesaleStockImage,
  type ApiWholesaleStockImage,
} from '@/lib/api/wholesale'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { resolveMediaUrl } from '@/lib/media-url'
import { revalidateWebCache } from '@/lib/api/revalidate'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

export function DcWholesaleStock() {
  const router = useRouter()
  return (
    <DcScreenProvider
      screen="wholesale-stock"
      onNavigate={(next) => router.push(`/dashboard/${next}`)}
    >
      <DcWholesaleStockBody />
    </DcScreenProvider>
  )
}

function DcWholesaleStockBody() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<ApiWholesaleStockImage | null>(null)
  const stock = useQuery({
    queryKey: ['wholesale-stock'],
    queryFn: fetchWholesaleStock,
    staleTime: 20_000,
  })
  const { api } = useAdminConnection(25_000)
  const images = stock.data?.images ?? []
  const pageStatus = dcPageStatus([stock], api.pulse)
  const skeleton: DcBlock[] = [{ t: 'list', title: '', items: [] }]
  const heroId = images.find((item) => item.isActive)?.id ?? null

  const afterWrite = () => {
    void qc.invalidateQueries({ queryKey: ['wholesale-stock'] })
    void revalidateWebCache(['wholesale-stock'])
  }

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadAdminImage(file, 'wholesale', { optimize: true, pipeline: false })
        await createWholesaleStockImage({ url: uploaded.url })
      }
      afterWrite()
      toastApiSaved(`${files.length} image${files.length === 1 ? '' : 's'} added to wholesale stock`)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const toggleActive = async (row: ApiWholesaleStockImage) => {
    setBusy(true)
    try {
      await updateWholesaleStockImage(row.id, { isActive: !row.isActive })
      afterWrite()
      toastApiSaved(row.isActive ? 'Hidden from storefront' : 'Visible on storefront')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not update')
    } finally {
      setBusy(false)
    }
  }

  const move = async (row: ApiWholesaleStockImage, dir: -1 | 1) => {
    const idx = images.findIndex((item) => item.id === row.id)
    const swap = images[idx + dir]
    if (!swap) return
    setBusy(true)
    try {
      await Promise.all([
        updateWholesaleStockImage(row.id, { sortOrder: swap.sortOrder }),
        updateWholesaleStockImage(swap.id, { sortOrder: row.sortOrder }),
      ])
      afterWrite()
      toastApiSaved('Gallery order updated')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not reorder')
    } finally {
      setBusy(false)
    }
  }

  const saveTitle = async (row: ApiWholesaleStockImage, title: string) => {
    const next = title.trim()
    if ((row.title ?? '') === next) return
    setBusy(true)
    try {
      const updated = await updateWholesaleStockImage(row.id, { title: next || null })
      if (!verifyStringEquals(updated.title ?? '', next, 'Title')) return
      afterWrite()
      toastApiSaved('Title saved')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not save title')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: ApiWholesaleStockImage) => {
    setBusy(true)
    try {
      await deleteWholesaleStockImage(row.id)
      afterWrite()
      setDeleting(null)
      toastApiSaved('Image removed')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not delete')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Wholesale"
        title="Wholesale Stock"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={stock.isFetching ? 'syncing…' : `${images.length} photo${images.length === 1 ? '' : 's'}`}
        syncing={stock.isFetching}
        onSync={() => void stock.refetch()}
      />

      {stock.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : stock.error ? (
        <DcErrorState
          error={`GET /admin/wholesale-stock → ${stock.error instanceof Error ? stock.error.message : 'failed'}`}
          hint="Only this wholesale gallery failed — leads and the rest of admin are separate."
          onRetry={() => void stock.refetch()}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              ...card,
              padding: '14px 16px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ font: `700 14px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                Storefront gallery
              </div>
              <p style={{ margin: '4px 0 0', font: `400 12.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
                These photos appear on /wholesale only. The first visible image is the hero. Main shop catalog is unchanged.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              style={{
                border: 'none',
                borderRadius: 10,
                background: 'var(--ink)',
                color: 'var(--surface)',
                padding: '10px 14px',
                font: `600 12.5px/1 ${FONT}`,
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Working…' : 'Add images'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(event) => void onUpload(event.target.files)}
            />
          </div>

          {images.length === 0 ? (
            <DcEmptyState
              icon="icon-image"
              title="No wholesale stock photos yet"
              body="Upload the looks you want B2B buyers to see on the wholesale page."
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 12,
              }}
            >
              {images.map((row, index) => {
                const src = resolveMediaUrl(row.url)
                const mute = toneStyle('mute')
                return (
                  <article key={row.id} style={{ ...card, overflow: 'hidden' }}>
                    <div style={{ position: 'relative', aspectRatio: '1', background: 'var(--bg)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={row.title ?? ''}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          opacity: row.isActive ? 1 : 0.45,
                        }}
                      />
                      {!row.isActive ? (
                        <span
                          style={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            ...mute,
                            borderRadius: 999,
                            padding: '3px 8px',
                            font: `600 10px/1 ${FONT}`,
                          }}
                        >
                          Hidden
                        </span>
                      ) : row.id === heroId ? (
                        <span
                          style={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            ...toneStyle('ok'),
                            borderRadius: 999,
                            padding: '3px 8px',
                            font: `600 10px/1 ${FONT}`,
                          }}
                        >
                          Hero
                        </span>
                      ) : null}
                    </div>
                    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        key={`${row.id}:${row.title ?? ''}`}
                        defaultValue={row.title ?? ''}
                        placeholder="Alt / title for storefront"
                        disabled={busy}
                        onBlur={(event) => void saveTitle(row, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur()
                          }
                        }}
                        style={{
                          border: '1px solid var(--line)',
                          borderRadius: 8,
                          background: 'var(--surface)',
                          padding: '6px 8px',
                          font: `400 12px/1.3 ${FONT}`,
                          color: 'var(--ink)',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <MiniBtn disabled={busy || index === 0} onClick={() => void move(row, -1)}>
                          Up
                        </MiniBtn>
                        <MiniBtn
                          disabled={busy || index === images.length - 1}
                          onClick={() => void move(row, 1)}
                        >
                          Down
                        </MiniBtn>
                        <MiniBtn disabled={busy} onClick={() => void toggleActive(row)}>
                          {row.isActive ? 'Hide' : 'Show'}
                        </MiniBtn>
                        <MiniBtn disabled={busy} danger onClick={() => setDeleting(row)}>
                          Delete
                        </MiniBtn>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}

      {deleting ? (
        <DcModal
          open
          danger
          title="Remove this stock photo?"
          subtitle="The storefront gallery updates after this is deleted."
          confirmLabel="Remove photo"
          busy={busy}
          busyLabel="Removing…"
          onClose={() => setDeleting(null)}
          onConfirm={() => void remove(deleting)}
        >
          <span style={{ font: `400 12.5px/1.6 ${FONT}`, color: 'var(--ink-2)' }}>
            This image will leave /wholesale. Buyer enquiry photos are not affected.
          </span>
        </DcModal>
      ) : null}
    </>
  )
}

function MiniBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        border: '1px solid var(--line)',
        borderRadius: 8,
        background: danger ? 'var(--bad-soft, transparent)' : 'var(--surface)',
        color: danger ? 'var(--bad)' : 'var(--ink-2)',
        padding: '5px 8px',
        font: `600 11px/1 ${FONT}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  )
}

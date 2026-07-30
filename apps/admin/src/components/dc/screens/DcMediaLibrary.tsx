'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { useMedia } from '@/lib/api/hooks'
import { resolveMediaUrl } from '@/lib/media-url'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `600 11px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

/** Asset source → chip tone. Violet stays out of chips (rule 1). */
const SOURCE_TONE: Record<string, DcTone> = {
  product: 'info',
  banner: 'ok',
  category: 'warn',
}

const FILTERS = ['All', 'Product', 'Banner', 'Category'] as const
type Filter = (typeof FILTERS)[number]

export function DcMediaLibrary() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="media" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcMediaLibraryBody />
    </DcScreenProvider>
  )
}

function DcMediaLibraryBody() {
  const router = useRouter()
  const { toast } = useDcScreen()
  const media = useMedia()
  const { api } = useAdminConnection(25_000)

  const [filter, setFilter] = useState<Filter>('All')
  const [query, setQuery] = useState('')

  const stats = media.data?.stats
  const assets = useMemo(() => media.data?.assets ?? [], [media.data])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return assets.filter((a) => {
      if (filter !== 'All' && (a.type ?? '').toLowerCase() !== filter.toLowerCase()) return false
      if (!q) return true
      return (
        a.name.toLowerCase().includes(q) ||
        (a.altText ?? '').toLowerCase().includes(q) ||
        (a.url ?? '').toLowerCase().includes(q)
      )
    })
  }, [assets, filter, query])

  const missingAlt = useMemo(() => assets.filter((a) => !a.altText?.trim()).length, [assets])
  const pageStatus = dcPageStatus([media], api.pulse)

  const skeleton: DcBlock[] = [
    { t: 'tabs', group: 'nav', items: [] } as DcBlock,
    { t: 'kpis' } as DcBlock,
    { t: 'media', title: '', slots: [] } as DcBlock,
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Content"
        title="Media Library"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          media.isFetching
            ? 'syncing…'
            : `${stats?.total ?? assets.length} asset${(stats?.total ?? assets.length) === 1 ? '' : 's'}`
        }
        syncing={media.isFetching}
        onSync={() => void media.refetch()}
        actions={[
          {
            label: 'Upload',
            icon: 'icon-upload',
            variant: 'primary',
            onClick: () =>
              toast(
                'info',
                'Upload happens where the image is used',
                'Images attach from the product editor, Hero Slider or a category — there is no standalone upload endpoint.',
              ),
          },
        ]}
      />

      <DcContentNav active="media" />

      {media.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : media.error ? (
        <DcErrorState
          error={`GET /admin/platform/media → ${media.error instanceof Error ? media.error.message : '500 Internal Server Error'}`}
          hint="Images already on the storefront are unaffected — only this index failed to load."
          onRetry={() => void media.refetch()}
        />
      ) : assets.length === 0 ? (
        <DcEmptyState
          icon="icon-image"
          title="Media library is empty"
          body="Assets appear here once an image is attached to a product, a hero slide or a category. Nothing is uploaded from this screen directly."
          cta="Open Products"
          onCta={() => router.push('/dashboard/products')}
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi
              label="Total assets"
              value={String(stats?.total ?? assets.length)}
              sub="indexed across the store"
            />
            <Kpi
              label="Product images"
              value={String(stats?.products ?? 0)}
              sub="attached to a product"
            />
            <Kpi label="Banners" value={String(stats?.banners ?? 0)} sub="hero and offer strips" />
            <Kpi
              label="Missing alt text"
              value={String(missingAlt)}
              sub="hurts SEO and screen readers"
              color={missingAlt > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              padding: '11px 14px',
              ...card,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 34,
                padding: '0 11px',
                borderRadius: 9,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                minWidth: 230,
              }}
            >
              <DcIcon name="icon-search" size={14} color="var(--ink-3)" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filename, alt text or path…"
                aria-label="Search media"
                style={{
                  flex: 1,
                  border: 0,
                  background: 'transparent',
                  outline: 'none',
                  color: 'var(--ink)',
                  font: `400 13px/1 ${FONT}`,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {FILTERS.map((f) => {
                const on = f === filter
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    style={{
                      height: 30,
                      padding: '0 11px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      font: `600 12px/1 ${FONT}`,
                      border: `1px solid ${on ? 'var(--violet-solid)' : 'var(--line)'}`,
                      background: on ? 'var(--violet-solid)' : 'var(--surface-2)',
                      color: on ? 'var(--on-violet)' : 'var(--ink-2)',
                    }}
                  >
                    {f}
                  </button>
                )
              })}
            </div>

            <div style={{ flex: 1 }} />
            <span style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
              {rows.length} of {assets.length}
            </span>
          </div>

          {rows.length === 0 ? (
            <div style={{ ...card, padding: '48px 20px', textAlign: 'center' }}>
              <span style={{ font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-3)' }}>
                Nothing matches that filter.
              </span>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                gap: 12,
              }}
            >
              {rows.map((a) => {
                const tone = toneStyle(SOURCE_TONE[(a.type ?? '').toLowerCase()] ?? 'mute')
                const url = a.url ? resolveMediaUrl(a.url) : null
                const noAlt = !a.altText?.trim()
                return (
                  <div
                    key={a.id}
                    style={{
                      ...card,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 9,
                      minWidth: 0,
                    }}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- R2/upload URLs; next/image is not wired for these
                      <img
                        src={url}
                        alt={a.altText || ''}
                        style={{
                          display: 'block',
                          width: '100%',
                          height: 132,
                          objectFit: 'cover',
                          borderRadius: 9,
                          border: '1px solid var(--line)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          display: 'grid',
                          placeItems: 'center',
                          height: 132,
                          borderRadius: 9,
                          border: '1px dashed var(--line-2)',
                          background:
                            'repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 6px, var(--surface-3) 6px, var(--surface-3) 12px)',
                          color: 'var(--ink-3)',
                        }}
                      >
                        <DcIcon name="icon-image-off" size={16} />
                      </div>
                    )}

                    <span
                      style={{
                        font: `500 12px/1.35 ${FONT}`,
                        color: 'var(--ink)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {a.name}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 8px',
                          borderRadius: 6,
                          font: `600 10px/1 ${FONT}`,
                          letterSpacing: '.05em',
                          textTransform: 'uppercase',
                          border: `1px solid ${tone.bd}`,
                          background: tone.bg,
                          color: tone.fg,
                        }}
                      >
                        {a.type || 'asset'}
                      </span>
                      {noAlt ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: 6,
                            font: `600 10px/1 ${FONT}`,
                            letterSpacing: '.05em',
                            border: '1px solid var(--warn-bd)',
                            background: 'var(--warn-soft)',
                            color: 'var(--warn)',
                          }}
                        >
                          NO ALT
                        </span>
                      ) : null}
                    </div>

                    <span
                      style={{
                        font: `400 10.5px/1.4 ${MONO}`,
                        color: 'var(--ink-3)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {a.url}
                    </span>

                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingTop: 2 }}>
                      {a.productId ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/products/${a.productId}/edit`)}
                          className="dc-hover-ink"
                          style={{
                            height: 28,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: '1px solid var(--line)',
                            background: 'var(--surface-2)',
                            color: 'var(--ink-2)',
                            cursor: 'pointer',
                            font: `600 11.5px/1 ${FONT}`,
                          }}
                        >
                          Open product
                        </button>
                      ) : null}
                      {url ? (
                        <button
                          type="button"
                          onClick={() => window.open(url, '_blank', 'noopener')}
                          className="dc-hover-ink"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            height: 28,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: '1px solid var(--line)',
                            background: 'var(--surface-2)',
                            color: 'var(--ink-2)',
                            cursor: 'pointer',
                            font: `600 11.5px/1 ${FONT}`,
                          }}
                        >
                          <DcIcon name="icon-external-link" size={12} />
                          <span>Full size</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* The design shows drop slots here. There is no standalone upload
              endpoint — images attach where they are used — so the screen says
              that rather than offering a drop target that writes nowhere. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '11px 14px',
              borderRadius: 11,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
            }}
          >
            <DcIcon name="icon-info" size={14} color="var(--ink-3)" />
            <span
              style={{
                flex: 1,
                font: `400 12px/1.5 ${FONT}`,
                color: 'var(--ink-3)',
                textWrap: 'pretty',
              }}
            >
              This screen is an index, not an uploader. Images enter the library from the product
              editor, Hero Slider or a category — there is no{' '}
              <span style={{ fontFamily: 'var(--mono)' }}>POST /admin/media</span> to drop onto.
            </span>
          </div>
        </>
      )}
    </>
  )
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color?: string
}) {
  return (
    <div
      style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span style={capsLabel}>{label}</span>
      <span
        style={{ font: `700 25px/1 ${FONT}`, letterSpacing: '-.025em', color: color ?? 'var(--ink)' }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}

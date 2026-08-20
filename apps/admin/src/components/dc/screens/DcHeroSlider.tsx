'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcField, DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle } from '@/components/dc/tokens'
import {
  createBanner,
  deleteBanner,
  fetchBanners,
  sortBanners,
  updateBanner,
  type BannerRow,
} from '@/lib/api/banners'
import { revalidateWebCache } from '@/lib/api/revalidate'
import { resolveMediaUrl } from '@/lib/media-url'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { DcMediaPickModal } from '@/components/dc/product/DcMediaPickModal'
import { canonicalizeHeroMediaUrl, classifyHeroMedia, heroMediaPreviewSrc, isHeroVideoUrl } from '@splaro/config'
import { arrayMove, DcDragHandle, DcSortableList, useDcSortable, type DcSortHandle } from '@/components/dc/DcSortableList'

const HERO_POSITION = 'hero'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

interface Form {
  title: string
  subtitle: string
  image: string
  mobileImage: string
  linkUrl: string
}

const EMPTY_FORM: Form = { title: '', subtitle: '', image: '', mobileImage: '', linkUrl: '' }

export function DcHeroSlider() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="hero" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcHeroSliderBody />
    </DcScreenProvider>
  )
}

function DcHeroSliderBody() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const { api } = useAdminConnection(25_000)

  const [editing, setEditing] = useState<BannerRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [removing, setRemoving] = useState<BannerRow | null>(null)
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const consumedImage = useRef<string | null>(null)

  useEffect(() => {
    const image = searchParams.get('image')?.trim()
    if (!image || consumedImage.current === image) return
    consumedImage.current = image
    setForm({ ...EMPTY_FORM, image })
    setCreateOpen(true)
    router.replace('/dashboard/hero-slider', { scroll: false })
  }, [router, searchParams])

  const banners = useQuery({
    queryKey: ['banners', HERO_POSITION],
    queryFn: () => fetchBanners(HERO_POSITION),
    staleTime: 30_000,
  })

  const rows = useMemo(() => banners.data?.banners ?? [], [banners.data])
  const live = rows.filter((b) => b.isActive)
  const pageStatus = dcPageStatus([banners], api.pulse)

  const afterWrite = () => {
    void qc.invalidateQueries({ queryKey: ['banners'] })
    void revalidateWebCache(['storefront-banners', 'hero-banners', 'storefront-settings'])
  }

  const toggle = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await updateBanner(id, { isActive })
      const fresh = await fetchBanners(HERO_POSITION)
      if (fresh.banners.find((row) => row.id === id)?.isActive !== isActive) {
        throw new Error('Slide visibility did not persist on server')
      }
      return { isActive }
    },
    onSuccess: (_r, vars) => {
      afterWrite()
      toast(
        vars.isActive ? 'ok' : 'info',
        vars.isActive ? 'Slide published' : 'Slide hidden',
        vars.isActive
          ? 'Server confirmed active; storefront refresh is queued.'
          : 'Server confirmed hidden; the record is kept.',
      )
    },
    onError: (err) => {
      afterWrite()
      toast(
        'bad',
        'Could not update the slide',
        err instanceof Error ? err.message : 'PATCH /admin/banners/:id failed',
      )
    },
  })

  const reorder = useMutation({
    mutationFn: async (ordered: BannerRow[]) => {
      const items = ordered.map((row, sortOrder) => ({ id: row.id, sortOrder }))
      await sortBanners(items)
      const fresh = await fetchBanners(HERO_POSITION)
      if (fresh.banners.map((row) => row.id).join() !== ordered.map((row) => row.id).join()) {
        throw new Error('Slide order did not persist on server')
      }
    },
    onSuccess: () => {
      afterWrite()
      toast('ok', 'Order saved and verified', 'Server returned the slides in this order.')
    },
    onError: (err) => {
      afterWrite()
      toast(
        'bad',
        'Could not save the order',
        err instanceof Error ? err.message : 'Slide order was not fully verified; refresh and retry.',
      )
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const expected = {
        image: canonicalizeHeroMediaUrl(form.image.trim()),
        mobileImage: form.mobileImage.trim(),
        position: HERO_POSITION,
        isActive: false,
        ...(form.title.trim() ? { title: form.title.trim() } : {}),
        ...(form.subtitle.trim() ? { subtitle: form.subtitle.trim() } : {}),
        ...(form.linkUrl.trim() ? { linkUrl: form.linkUrl.trim() } : {}),
      }
      const saved = await createBanner(expected)
      const fresh = await fetchBanners(HERO_POSITION)
      const row = fresh.banners.find((item) => item.id === saved.id)
      if (
        !row ||
        row.image !== expected.image ||
        String(row.mobileImage ?? '') !== expected.mobileImage ||
        row.isActive !== false
      ) {
        throw new Error('Created slide did not persist on server')
      }
      return row
    },
    onSuccess: () => {
      afterWrite()
      setCreateOpen(false)
      toast('ok', 'Slide created and verified', 'Created hidden — publish it once the image is right.')
    },
    onError: (err) => {
      afterWrite()
      toast(
        'bad',
        'Could not create the slide',
        err instanceof Error ? err.message : 'POST /admin/banners failed',
      )
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error('No slide selected')
      const expected = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        linkUrl: form.linkUrl.trim(),
        image: canonicalizeHeroMediaUrl(form.image.trim()),
        mobileImage: form.mobileImage.trim(),
      }
      await updateBanner(editing.id, expected)
      const fresh = await fetchBanners(HERO_POSITION)
      const row = fresh.banners.find((item) => item.id === editing.id)
      if (
        !row ||
        String(row.title ?? '') !== expected.title ||
        String(row.subtitle ?? '') !== expected.subtitle ||
        String(row.linkUrl ?? '') !== expected.linkUrl ||
        row.image !== expected.image ||
        String(row.mobileImage ?? '') !== expected.mobileImage
      ) {
        throw new Error('Slide changes did not persist on server')
      }
      return row
    },
    onSuccess: () => {
      afterWrite()
      setEditing(null)
      toast('ok', 'Saved and verified', 'Server confirmed changes; storefront refresh is queued.')
    },
    onError: (err) => {
      afterWrite()
      toast(
        'bad',
        'Could not save the slide',
        err instanceof Error ? err.message : 'PATCH /admin/banners/:id failed',
      )
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteBanner(id)
      if (result.deleted !== true) throw new Error('Slide delete was not confirmed by server')
      const fresh = await fetchBanners(HERO_POSITION)
      if (fresh.banners.some((item) => item.id === id)) {
        throw new Error('Slide still exists after delete')
      }
      return id
    },
    onSuccess: () => {
      afterWrite()
      setRemoving(null)
      toast('ok', 'Slide deleted and verified', 'Fresh server read confirms it no longer exists.')
    },
    onError: (err) => {
      afterWrite()
      toast(
        'bad',
        'Could not delete the slide',
        err instanceof Error ? err.message : 'DELETE /admin/banners/:id failed',
      )
    },
  })

  const busy =
    toggle.isPending || reorder.isPending || create.isPending || save.isPending || remove.isPending

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    reorder.mutate(arrayMove(rows, index, target))
  }

  const skeleton: DcBlock[] = [
    { t: 'tabs', group: 'nav', items: [] } as DcBlock,
    { t: 'pub', title: '', rows: [] } as DcBlock,
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Content"
        title="Hero Slider"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          banners.isFetching
            ? 'syncing…'
            : `${live.length} live · ${rows.length - live.length} hidden`
        }
        syncing={banners.isFetching}
        onSync={() => void banners.refetch()}
        actions={[
          {
            label: 'Add slide',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => {
              setForm(EMPTY_FORM)
              setCreateOpen(true)
            },
          },
        ]}
      />

      <DcContentNav active="hero" />

      {banners.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : banners.error ? (
        <DcErrorState
          error={`GET /admin/banners?position=hero → ${banners.error instanceof Error ? banners.error.message : '500 Internal Server Error'}`}
          hint="Slides already live are unaffected — only this editor failed to load."
          onRetry={() => void banners.refetch()}
        />
      ) : rows.length === 0 ? (
        <DcEmptyState
          icon="icon-sliders-horizontal"
          title="No slides yet"
          body="The hero area collapses when there are no slides, so the storefront opens straight into the product rails."
          cta="Add first slide"
          onCta={() => {
            setForm(EMPTY_FORM)
            setCreateOpen(true)
          }}
        />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '11px 14px',
              borderRadius: 11,
              border: '1px solid var(--info-bd)',
              background: 'var(--info-soft)',
            }}
          >
            <DcIcon name="icon-info" size={15} color="var(--info)" />
            <span
              style={{
                flex: 1,
                font: `500 12.5px/1.5 ${FONT}`,
                color: 'var(--ink-2)',
                textWrap: 'pretty',
              }}
            >
              Order is the list order. Drag the handle or use the arrows; the server is checked after each move. Publish and hide apply immediately; text edits need an explicit save.
            </span>
          </div>

          <div style={{ ...card, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                padding: '12px 15px',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 140,
                  font: `600 13.5px/1.3 ${FONT}`,
                  color: 'var(--ink)',
                }}
              >
                Hero banners
              </span>
              <Dot color="var(--ok)" label={`${live.length} live`} />
              <Dot color="var(--ink-3)" label={`${rows.length - live.length} hidden`} />
            </div>

            <DcSortableList
              ids={rows.map((row) => row.id)}
              disabled={busy}
              onReorder={(from, to) => reorder.mutate(arrayMove(rows, from, to))}
            >
            {rows.map((b, i) => {
              const tone = toneStyle(b.isActive ? 'ok' : 'mute')
              const cover = b.image ? resolveMediaUrl(b.image) : null
              return (
                <HeroSortableRow key={b.id} id={b.id} disabled={busy}>
                  {(handle) => (
                    <>
                  <DcDragHandle {...handle} disabled={busy} />
                  <HeroMediaPreview url={cover} width={82} height={54} label={`${b.title || 'Hero'} preview`} />

                  <span
                    style={{
                      flex: 1,
                      minWidth: 150,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}
                  >
                    <span
                      style={{
                        font: `600 13px/1.3 ${FONT}`,
                        color: b.isActive ? 'var(--ink)' : 'var(--ink-3)',
                        textWrap: 'pretty',
                      }}
                    >
                      {b.title?.trim() || 'Untitled slide'}
                    </span>
                    {b.subtitle ? (
                      <span
                        style={{
                          font: `400 11.5px/1.4 ${FONT}`,
                          color: 'var(--ink-3)',
                          textWrap: 'pretty',
                        }}
                      >
                        {b.subtitle}
                      </span>
                    ) : null}
                    <span style={{ font: `400 11px/1.3 ${MONO}`, color: 'var(--ink-3)' }}>
                      {b.linkUrl?.trim() || 'no link'}
                    </span>
                  </span>

                  <IconBtn
                    icon="icon-chevron-up"
                    title="Move up"
                    disabled={busy}
                    onClick={() => move(i, -1)}
                  />
                  <IconBtn
                    icon="icon-chevron-down"
                    title="Move down"
                    disabled={busy}
                    onClick={() => move(i, 1)}
                  />

                  <span
                    style={{
                      flex: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      height: 24,
                      padding: '0 9px',
                      borderRadius: 6,
                      font: `600 10.5px/1 ${FONT}`,
                      letterSpacing: '.05em',
                      border: `1px solid ${tone.bd}`,
                      background: tone.bg,
                      color: tone.fg,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }}
                    />
                    {b.isActive ? 'VISIBLE' : 'HIDDEN'}
                  </span>

                  <span style={{ flex: 'none', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({
                          title: b.title ?? '',
                          subtitle: b.subtitle ?? '',
                          image: b.image ?? '',
                          mobileImage: b.mobileImage ?? '',
                          linkUrl: b.linkUrl ?? '',
                        })
                        setEditing(b)
                      }}
                      className="dc-hover-ink"
                      style={{
                        height: 30,
                        padding: '0 11px',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink-2)',
                        cursor: 'pointer',
                        font: `600 12px/1 ${FONT}`,
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggle.mutate({ id: b.id, isActive: !b.isActive })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 30,
                        padding: '0 12px',
                        borderRadius: 8,
                        cursor: busy ? 'not-allowed' : 'pointer',
                        font: `600 12px/1 ${FONT}`,
                        border: `1px solid ${b.isActive ? 'var(--line)' : 'var(--violet-solid)'}`,
                        background: b.isActive ? 'var(--surface-2)' : 'var(--violet-solid)',
                        color: b.isActive ? 'var(--ink-2)' : 'var(--on-violet)',
                      }}
                    >
                      <DcIcon name={b.isActive ? 'icon-eye-off' : 'icon-globe'} size={13} />
                      <span>{b.isActive ? 'Hide from hero' : 'Publish to hero'}</span>
                    </button>
                    <IconBtn
                      icon="icon-trash-2"
                      title="Delete slide"
                      danger
                      disabled={busy}
                      onClick={() => setRemoving(b)}
                    />
                  </span>
                    </>
                  )}
                </HeroSortableRow>
              )
            })}
            </DcSortableList>
          </div>
        </>
      )}

      <DcModal
        open={createOpen}
        title="Add hero slide"
        subtitle="Created hidden. Publish it once the image or video and copy are right."
        confirmLabel="Create slide"
        busy={create.isPending}
        onClose={() => setCreateOpen(false)}
        onConfirm={() => {
          if (!form.image.trim()) {
            toast('warn', 'Media is required', 'Paste an image, .mp4, YouTube, or Vimeo link.')
            return
          }
          create.mutate()
        }}
      >
        <SlideFields form={form} setForm={setForm} />
      </DcModal>

      <DcModal
        open={editing !== null}
        title={editing ? `Edit ${editing.title?.trim() || 'slide'}` : 'Edit slide'}
        subtitle="Visibility is changed from the row, not here."
        confirmLabel="Save changes"
        busy={save.isPending}
        onClose={() => setEditing(null)}
        onConfirm={() => {
          if (!form.image.trim()) {
            toast('warn', 'Media is required', 'Paste an image, .mp4, YouTube, or Vimeo link.')
            return
          }
          save.mutate()
        }}
      >
        <SlideFields form={form} setForm={setForm} />
      </DcModal>

      <DcModal
        open={removing !== null}
        title={removing ? `Delete ${removing.title?.trim() || 'this slide'}?` : 'Delete slide'}
        subtitle="The slide record is removed permanently. The image itself stays in the media library."
        confirmLabel="Delete slide"
        danger
        busy={remove.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </>
  )
}

function HeroSortableRow({
  id,
  disabled,
  children,
}: {
  id: string
  disabled?: boolean
  children: (handle: DcSortHandle) => ReactNode
}) {
  const drag = useDcSortable(id, disabled)
  return (
    <div
      ref={drag.setNodeRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        flexWrap: 'wrap',
        padding: '13px 15px',
        borderBottom: '1px solid var(--line)',
        ...drag.style,
      }}
    >
      {children({ listeners: drag.listeners, attributes: drag.attributes })}
    </div>
  )
}

function SlideFields({
  form,
  setForm,
}: {
  form: Form
  setForm: (f: Form | ((prev: Form) => Form)) => void
}) {
  const [pickerTarget, setPickerTarget] = useState<'image' | 'mobileImage' | null>(null)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: form.mobileImage.trim() ? '2fr 1fr' : '1fr', gap: 10 }}>
        <HeroMediaPreview
          url={form.image.trim() ? resolveMediaUrl(form.image.trim()) : null}
          width="100%"
          height={150}
          label="Desktop hero preview"
        />
        {form.mobileImage.trim() ? (
          <HeroMediaPreview
            url={resolveMediaUrl(form.mobileImage.trim())}
            width="100%"
            height={150}
            label="Mobile poster preview"
          />
        ) : null}
      </div>
      <DcField
        label="Image or video URL"
        value={form.image}
        onChange={(v) => setForm((f) => ({ ...f, image: v }))}
        placeholder="https://youtu.be/…  or  /uploads/hero/eid.mp4"
        mono
        hint={
          isHeroVideoUrl(form.image)
            ? classifyHeroMedia(form.image).kind === 'pexels-page'
              ? 'Pexels page detected — poster will show. For playback paste the direct .mp4 (video-files) link.'
              : 'Video link detected — homepage will play this (YouTube / Vimeo / mp4). Add a mobile image as the loading poster.'
            : 'Paste a photo, .mp4 / .webm, YouTube, Vimeo, or Pexels video-files URL.'
        }
      />
      <button type="button" onClick={() => setPickerTarget('image')} style={pickerButton}>
        <DcIcon name="icon-image" size={13} /> Pick desktop image from library
      </button>
      <DcField
        label="Mobile image URL (optional)"
        value={form.mobileImage}
        onChange={(v) => setForm((f) => ({ ...f, mobileImage: v }))}
        placeholder="/uploads/hero/eid-edit-mobile.webp"
        mono
        hint="Optional poster while video loads. 16:9 still (828 × 466) works best on phones."
      />
      <button type="button" onClick={() => setPickerTarget('mobileImage')} style={pickerButton}>
        <DcIcon name="icon-smartphone" size={13} /> Pick mobile image from library
      </button>
      <DcField
        label="Headline"
        value={form.title}
        onChange={(v) => setForm((f) => ({ ...f, title: v }))}
        placeholder="The Eid Edit — hand-finished in Dhaka"
      />
      <DcField
        label="Subtitle"
        value={form.subtitle}
        onChange={(v) => setForm((f) => ({ ...f, subtitle: v }))}
        area
      />
      <DcField
        label="Link"
        value={form.linkUrl}
        onChange={(v) => setForm((f) => ({ ...f, linkUrl: v }))}
        placeholder="/collections/eid-edit"
        mono
      />
      <DcMediaPickModal
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onPick={(url) => {
          if (!pickerTarget) return
          setForm((current) => ({ ...current, [pickerTarget]: url }))
        }}
      />
    </>
  )
}

function HeroMediaPreview({
  url,
  width,
  height,
  label,
}: {
  url: string | null
  width: number | string
  height: number
  label: string
}) {
  const [failed, setFailed] = useState(false)
  const classified = classifyHeroMedia(url ?? '')
  const poster = classified.poster ?? null
  const isVideo = classified.kind !== 'image'

  useEffect(() => setFailed(false), [url])

  const frameStyle = {
    position: 'relative' as const,
    display: 'grid',
    placeItems: 'center',
    width,
    height,
    minWidth: typeof width === 'number' ? width : 0,
    flex: 'none',
    overflow: 'hidden',
    borderRadius: 8,
    border: failed ? '1px dashed var(--bad)' : '1px solid var(--line)',
    background:
      'repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 6px, var(--surface-3) 6px, var(--surface-3) 12px)',
    color: failed ? 'var(--bad)' : 'var(--ink-3)',
  } as const

  const badge =
    isVideo && !failed ? (
      <span
        style={{
          position: 'absolute',
          left: 6,
          bottom: 6,
          zIndex: 1,
          padding: '2px 6px',
          borderRadius: 4,
          background: 'rgba(10,10,12,.78)',
          color: 'var(--on-violet)',
          font: `700 9px/1 ${FONT}`,
          letterSpacing: '.06em',
        }}
      >
        {classified.kind === 'youtube'
          ? 'YOUTUBE'
          : classified.kind === 'vimeo'
            ? 'VIMEO'
            : 'VIDEO'}
      </span>
    ) : null

  if (!url || failed) {
    return (
      <span role="img" aria-label={failed ? `${label} unavailable` : `${label} not selected`} style={frameStyle}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 11px/1 ${FONT}` }}>
          <DcIcon name={isVideo ? 'icon-play' : 'icon-image'} size={14} />{' '}
          {failed ? 'Preview unavailable' : isVideo ? 'Video URL' : 'Choose image'}
        </span>
      </span>
    )
  }

  if (classified.kind === 'file-video') {
    return (
      <span style={frameStyle}>
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          poster={poster ?? undefined}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
        />
        {badge}
      </span>
    )
  }

  const imgSrc = classified.poster || heroMediaPreviewSrc(url)
  return (
    <span style={frameStyle}>
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic storefront/upload URLs */}
      <img
        src={imgSrc}
        alt={label}
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
      />
      {badge}
    </span>
  )
}

const pickerButton = {
  alignSelf: 'flex-start',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  minHeight: 32,
  padding: '0 11px',
  marginTop: -5,
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  color: 'var(--ink-2)',
  cursor: 'pointer',
  font: `600 11.5px/1 ${FONT}`,
} as const

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{ display: 'flex', alignItems: 'center', gap: 6, font: `600 11px/1 ${FONT}`, color }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 99, background: color }} />
      {label}
    </span>
  )
}

function IconBtn({
  icon,
  title,
  onClick,
  disabled,
  danger,
}: {
  icon: string
  title: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="dc-hover-ink"
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 30,
        height: 30,
        flex: 'none',
        borderRadius: 8,
        border: `1px solid ${danger ? 'var(--bad-bd)' : 'var(--line)'}`,
        background: danger ? 'var(--bad-soft)' : 'var(--surface-2)',
        color: danger ? 'var(--bad)' : 'var(--ink-3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <DcIcon name={icon} size={13} />
    </button>
  )
}

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

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
  updateBanner,
  type BannerRow,
} from '@/lib/api/banners'
import { revalidateWebCache } from '@/lib/api/revalidate'
import { resolveMediaUrl } from '@/lib/media-url'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

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
  linkUrl: string
}

const EMPTY_FORM: Form = { title: '', subtitle: '', image: '', linkUrl: '' }

export function DcHeroSlider() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="hero" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcHeroSliderBody />
    </DcScreenProvider>
  )
}

function DcHeroSliderBody() {
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const { api } = useAdminConnection(25_000)

  const [editing, setEditing] = useState<BannerRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [removing, setRemoving] = useState<BannerRow | null>(null)
  const [form, setForm] = useState<Form>(EMPTY_FORM)

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
    void revalidateWebCache(['storefront-settings'])
  }

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateBanner(id, { isActive }),
    onSuccess: (_r, vars) => {
      afterWrite()
      toast(
        vars.isActive ? 'ok' : 'info',
        vars.isActive ? 'Slide published' : 'Slide hidden',
        vars.isActive
          ? 'Live in the storefront hero now.'
          : 'Removed from the hero — the record is kept.',
      )
    },
    onError: (err) =>
      toast(
        'bad',
        'Could not update the slide',
        err instanceof Error ? err.message : 'PATCH /admin/banners/:id failed',
      ),
  })

  const reorder = useMutation({
    mutationFn: ({ id, sortOrder }: { id: string; sortOrder: number }) =>
      updateBanner(id, { sortOrder }),
    onSuccess: () => {
      afterWrite()
      toast('ok', 'Order saved', 'The hero reads this order on the next render.')
    },
    onError: (err) =>
      toast(
        'bad',
        'Could not save the order',
        err instanceof Error ? err.message : 'PATCH /admin/banners/:id failed',
      ),
  })

  const create = useMutation({
    mutationFn: () =>
      createBanner({
        image: form.image.trim(),
        position: HERO_POSITION,
        isActive: false,
        ...(form.title.trim() ? { title: form.title.trim() } : {}),
        ...(form.subtitle.trim() ? { subtitle: form.subtitle.trim() } : {}),
        ...(form.linkUrl.trim() ? { linkUrl: form.linkUrl.trim() } : {}),
      }),
    onSuccess: () => {
      afterWrite()
      setCreateOpen(false)
      toast('ok', 'Slide created', 'Created hidden — publish it once the image is right.')
    },
    onError: (err) =>
      toast(
        'bad',
        'Could not create the slide',
        err instanceof Error ? err.message : 'POST /admin/banners failed',
      ),
  })

  const save = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('No slide selected')
      return updateBanner(editing.id, {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        linkUrl: form.linkUrl.trim(),
        image: form.image.trim(),
      })
    },
    onSuccess: () => {
      afterWrite()
      setEditing(null)
      toast('ok', 'Saved', 'The storefront picked the change up.')
    },
    onError: (err) =>
      toast(
        'bad',
        'Could not save the slide',
        err instanceof Error ? err.message : 'PATCH /admin/banners/:id failed',
      ),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteBanner(id),
    onSuccess: () => {
      afterWrite()
      setRemoving(null)
      toast('ok', 'Slide deleted', 'Removed permanently — this cannot be undone.')
    },
    onError: (err) =>
      toast(
        'bad',
        'Could not delete the slide',
        err instanceof Error ? err.message : 'DELETE /admin/banners/:id failed',
      ),
  })

  const busy =
    toggle.isPending || reorder.isPending || create.isPending || save.isPending || remove.isPending

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    // sortOrder is relative, so swapping two rows means writing both.
    reorder.mutate({ id: rows[index]!.id, sortOrder: target })
    reorder.mutate({ id: rows[target]!.id, sortOrder: index })
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
              Order is the list order — there is no drag-and-drop yet, so do not promise it to the
              team. Publish and hide apply immediately; text edits need an explicit save.
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

            {rows.map((b, i) => {
              const tone = toneStyle(b.isActive ? 'ok' : 'mute')
              const cover = b.image ? resolveMediaUrl(b.image) : null
              return (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 13,
                    flexWrap: 'wrap',
                    padding: '13px 15px',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- R2/upload URLs, next/image is not wired for these
                    <img
                      src={cover}
                      alt=""
                      style={{
                        width: 82,
                        height: 54,
                        flex: 'none',
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 82,
                        height: 54,
                        flex: 'none',
                        borderRadius: 8,
                        border: '1px dashed var(--line-2)',
                        background:
                          'repeating-linear-gradient(135deg, var(--surface-2), var(--surface-2) 6px, var(--surface-3) 6px, var(--surface-3) 12px)',
                        color: 'var(--ink-3)',
                      }}
                    >
                      <DcIcon name="icon-image" size={14} />
                    </span>
                  )}

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
                    {b.isActive ? 'LIVE' : 'HIDDEN'}
                  </span>

                  <span style={{ flex: 'none', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({
                          title: b.title ?? '',
                          subtitle: b.subtitle ?? '',
                          image: b.image ?? '',
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
                </div>
              )
            })}
          </div>
        </>
      )}

      <DcModal
        open={createOpen}
        title="Add hero slide"
        subtitle="Created hidden. Publish it once the image and copy are right."
        confirmLabel="Create slide"
        busy={create.isPending}
        onClose={() => setCreateOpen(false)}
        onConfirm={() => {
          if (!form.image.trim()) {
            toast('warn', 'Image is required', 'A hero slide is the image — it cannot be empty.')
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
            toast('warn', 'Image is required', 'A hero slide is the image — it cannot be empty.')
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

function SlideFields({
  form,
  setForm,
}: {
  form: Form
  setForm: (f: Form | ((prev: Form) => Form)) => void
}) {
  return (
    <>
      <DcField
        label="Image URL"
        value={form.image}
        onChange={(v) => setForm((f) => ({ ...f, image: v }))}
        placeholder="/uploads/hero/eid-edit.webp"
        mono
        hint="Upload in Media Library first, then paste the path here."
      />
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
    </>
  )
}

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

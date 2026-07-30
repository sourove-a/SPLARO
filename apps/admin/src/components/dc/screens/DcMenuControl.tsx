'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcSaveBar } from '@/components/dc/DcSaveBar'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcField, DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle } from '@/components/dc/tokens'
import type { CategoryTreeNode } from '@/lib/api/categories'
import { useCategoryTree, useSettings, useUpdateSettings } from '@/lib/api/hooks'
import type { DepartmentMenuOverride, NavLink } from '@/lib/api/settings'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

interface Draft {
  headerNav: NavLink[]
  autoSync: boolean
  departments: DepartmentMenuOverride[]
}

const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b)

export function DcMenuControl() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="menu" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcMenuControlBody />
    </DcScreenProvider>
  )
}

function DcMenuControlBody() {
  const { toast } = useDcScreen()
  const settings = useSettings()
  const tree = useCategoryTree()
  const update = useUpdateSettings()
  const { api } = useAdminConnection(25_000)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newLink, setNewLink] = useState({ label: '', href: '' })

  const baseline: Draft | null = useMemo(() => {
    const d = settings.data
    if (!d) return null
    return {
      headerNav: (d.navigation?.headerNav ?? []).map((l) => ({ ...l })),
      autoSync: d.menuOverrides?.autoSync ?? true,
      departments: (d.menuOverrides?.departments ?? []).map((x) => ({ ...x })),
    }
  }, [settings.data])

  useEffect(() => {
    if (baseline) setDraft(baseline)
  }, [baseline])

  const roots: CategoryTreeNode[] = useMemo(() => {
    const d = tree.data as { categories?: CategoryTreeNode[] } | CategoryTreeNode[] | undefined
    if (Array.isArray(d)) return d
    return d?.categories ?? []
  }, [tree.data])

  const dirty = !!draft && !!baseline && !same(draft, baseline)
  const pageStatus = dcPageStatus([settings, tree], api.pulse)

  const patch = (next: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...next } : d))

  const moveLink = (index: number, direction: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d
      const target = index + direction
      if (target < 0 || target >= d.headerNav.length) return d
      const headerNav = [...d.headerNav]
      const held = headerNav[index]!
      headerNav[index] = headerNav[target]!
      headerNav[target] = held
      return { ...d, headerNav }
    })

  const overrideFor = (slug: string) => draft?.departments.find((x) => x.departmentSlug === slug)

  const setDepartment = (slug: string, next: Partial<DepartmentMenuOverride>) =>
    setDraft((d) => {
      if (!d) return d
      const exists = d.departments.some((x) => x.departmentSlug === slug)
      const departments = exists
        ? d.departments.map((x) => (x.departmentSlug === slug ? { ...x, ...next } : x))
        : [...d.departments, { departmentSlug: slug, ...next }]
      return { ...d, departments }
    })

  const toggleCategory = (slug: string, categoryId: string) => {
    const hidden = new Set(overrideFor(slug)?.hiddenCategoryIds ?? [])
    if (hidden.has(categoryId)) hidden.delete(categoryId)
    else hidden.add(categoryId)
    setDepartment(slug, { hiddenCategoryIds: [...hidden] })
  }

  const runSave = () => {
    if (!draft) return
    update.mutate(
      {
        navigation: {
          headerNav: draft.headerNav,
          footerGroups: settings.data?.navigation?.footerGroups ?? [],
        },
        menuOverrides: { autoSync: draft.autoSync, departments: draft.departments },
      },
      {
        onSuccess: () =>
          toast('ok', 'Saved and verified', 'The storefront menu reads this order now.'),
        onError: (err) =>
          toast(
            'bad',
            'Could not save the menu',
            err instanceof Error ? err.message : 'PATCH /admin/settings failed',
          ),
      },
    )
  }

  const skeleton: DcBlock[] = [
    { t: 'tabs', group: 'nav', items: [] } as DcBlock,
    { t: 'vis', w: 'main', title: '', rows: [] } as DcBlock,
    { t: 'vis', w: 'side', title: '', rows: [] } as DcBlock,
  ]

  const visibleCount = draft?.headerNav.filter((l) => !l.hidden).length ?? 0
  const hiddenCount = (draft?.headerNav.length ?? 0) - visibleCount

  return (
    <>
      <DcPageHead
        crumbGroup="Content"
        title="Menu Control"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          settings.isFetching
            ? 'syncing…'
            : `${visibleCount} visible · ${hiddenCount} hidden`
        }
        syncing={settings.isFetching}
        onSync={() => {
          void settings.refetch()
          void tree.refetch()
        }}
      />

      <DcContentNav active="menu" />

      {settings.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : settings.error ? (
        <DcErrorState
          error={`GET /admin/settings → ${settings.error instanceof Error ? settings.error.message : '500 Internal Server Error'}`}
          hint="The live storefront menu is unaffected — only this editor failed to load."
          onRetry={() => void settings.refetch()}
        />
      ) : !draft ? (
        <DcErrorState
          error="GET /admin/settings → 200 without a navigation block"
          hint="The payload has no navigation.headerNav, so there is nothing to edit."
          onRetry={() => void settings.refetch()}
        />
      ) : (
        <>
          <DcSaveBar
            dirty={dirty}
            saving={update.isPending}
            hint="Header order, visibility and mega-menu rules all save together."
            cleanNote="No unsaved changes. The storefront is reading exactly what is below."
            onReset={() => baseline && setDraft(baseline)}
            onSave={runSave}
          />

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'flex-start',
              width: '100%',
            }}
          >
            <div style={{ flex: '1 1 56%', minWidth: 340, maxWidth: '100%' }}>
              <div style={{ ...card, padding: '6px 16px 12px' }}>
                <SectionHead
                  title="Header links"
                  meta={`${visibleCount} visible · ${hiddenCount} hidden`}
                />
                <p
                  style={{
                    margin: 0,
                    font: `400 12px/1.55 ${FONT}`,
                    color: 'var(--ink-3)',
                    paddingBottom: 10,
                    textWrap: 'pretty',
                  }}
                >
                  Each row is one link in the storefront header. Arrows set the order the storefront
                  reads.
                </p>

                {draft.headerNav.length === 0 ? (
                  <EmptyRow text="No header links. The storefront header renders empty." />
                ) : (
                  draft.headerNav.map((link, i) => (
                    <VisRow
                      key={`${link.href}-${i}`}
                      label={link.label}
                      sub={link.href}
                      on={!link.hidden}
                      badge={link.hidden ? 'HIDDEN' : 'VISIBLE'}
                      buttonLabel={link.hidden ? 'Show on site' : 'Hide from site'}
                      onToggle={() =>
                        patch({
                          headerNav: draft.headerNav.map((l, idx) =>
                            idx === i ? { ...l, hidden: !l.hidden } : l,
                          ),
                        })
                      }
                      before={
                        <>
                          <IconBtn
                            icon="icon-chevron-up"
                            title="Move up"
                            onClick={() => moveLink(i, -1)}
                          />
                          <IconBtn
                            icon="icon-chevron-down"
                            title="Move down"
                            onClick={() => moveLink(i, 1)}
                          />
                        </>
                      }
                    />
                  ))
                )}

                <div style={{ paddingTop: 12, borderTop: '1px solid var(--line)', marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setNewLink({ label: '', href: '' })
                      setAddOpen(true)
                    }}
                    className="dc-hover-violet"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      height: 31,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: '1px dashed var(--line-2)',
                      background: 'transparent',
                      color: 'var(--ink-2)',
                      cursor: 'pointer',
                      font: `600 12px/1 ${FONT}`,
                    }}
                  >
                    <DcIcon name="icon-plus" size={13} />
                    <span>Add header link</span>
                  </button>
                </div>
              </div>
            </div>

            <div style={{ flex: '1 1 28%', minWidth: 290, maxWidth: '100%' }}>
              <div style={{ ...card, padding: '6px 16px 12px' }}>
                <SectionHead title="Mega menu behaviour" meta="" />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '11px 0',
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <span
                    style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}
                  >
                    <span style={{ font: `500 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                      Auto-sync categories from Catalog
                    </span>
                    <span
                      style={{
                        font: `400 11.5px/1.4 ${FONT}`,
                        color: 'var(--ink-3)',
                        textWrap: 'pretty',
                      }}
                    >
                      New categories arrive visible; anything you hid stays hidden.
                    </span>
                  </span>
                  <span
                    style={{
                      flex: 'none',
                      font: `600 11px/1 ${FONT}`,
                      letterSpacing: '.06em',
                      color: draft.autoSync ? 'var(--violet)' : 'var(--ink-3)',
                    }}
                  >
                    {draft.autoSync ? 'ON' : 'OFF'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.autoSync}
                    aria-label="Auto-sync categories from Catalog"
                    onClick={() => patch({ autoSync: !draft.autoSync })}
                    style={{
                      position: 'relative',
                      display: 'block',
                      width: 38,
                      height: 21,
                      flex: 'none',
                      padding: 0,
                      border: 0,
                      cursor: 'pointer',
                      borderRadius: 99,
                      background: draft.autoSync ? 'var(--violet-solid)' : 'var(--surface-3)',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 2,
                        ...(draft.autoSync ? { right: 2 } : { left: 2 }),
                        width: 17,
                        height: 17,
                        borderRadius: 99,
                        background: draft.autoSync ? 'var(--on-violet)' : 'var(--ink-3)',
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>

            {roots.map((dept) => {
              const override = overrideFor(dept.slug)
              const deptHidden = override?.hidden === true
              const forced = override?.forceVisible === true
              const hiddenIds = new Set(override?.hiddenCategoryIds ?? [])
              const children = dept.children ?? []
              return (
                <div key={dept.id} style={{ flex: '1 1 56%', minWidth: 340, maxWidth: '100%' }}>
                  <div style={{ ...card, padding: '6px 16px 12px' }}>
                    <SectionHead
                      title={`Mega menu · ${dept.name}`}
                      meta={`${children.length} categor${children.length === 1 ? 'y' : 'ies'}`}
                    />
                    <p
                      style={{
                        margin: 0,
                        font: `400 12px/1.55 ${FONT}`,
                        color: 'var(--ink-3)',
                        paddingBottom: 10,
                        textWrap: 'pretty',
                      }}
                    >
                      Departments come from Categories. Force visible keeps one in the menu even
                      when it has no products. Hidden categories stay reachable by direct link.
                    </p>

                    <VisRow
                      label={`${dept.name} department`}
                      sub={
                        deptHidden
                          ? 'hidden from the header mega menu'
                          : 'shown in the header mega menu'
                      }
                      on={!deptHidden}
                      badge={forced ? 'FORCE VISIBLE' : deptHidden ? 'HIDDEN' : 'VISIBLE'}
                      buttonLabel={deptHidden ? 'Show department' : 'Hide department'}
                      onToggle={() => setDepartment(dept.slug, { hidden: !deptHidden })}
                      before={
                        <button
                          type="button"
                          onClick={() => setDepartment(dept.slug, { forceVisible: !forced })}
                          className="dc-hover-ink"
                          style={{
                            flex: 'none',
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
                          {forced ? 'Unforce' : 'Force visible'}
                        </button>
                      }
                    />

                    {children.length === 0 ? (
                      <EmptyRow text="No child categories — this department renders as a single link." />
                    ) : (
                      children.map((cat) => {
                        const count = cat._count?.products ?? 0
                        const hidden = hiddenIds.has(cat.id)
                        return (
                          <VisRow
                            key={cat.id}
                            label={cat.name}
                            sub={`/${dept.slug}/${cat.slug} · ${count} product${count === 1 ? '' : 's'}`}
                            note={count === 0 ? 'empty category' : undefined}
                            on={!hidden}
                            badge={hidden ? 'HIDDEN' : 'VISIBLE'}
                            buttonLabel={hidden ? 'Show in menu' : 'Hide from menu'}
                            onToggle={() => toggleCategory(dept.slug, cat.id)}
                          />
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <DcModal
            open={addOpen}
            title="Add header link"
            subtitle="Added hidden. Show it on the site once the target page exists."
            confirmLabel="Add link"
            onClose={() => setAddOpen(false)}
            onConfirm={() => {
              const label = newLink.label.trim()
              const href = newLink.href.trim()
              if (!label || !href) {
                toast('warn', 'Label and URL are required', 'A header link needs both to render.')
                return
              }
              patch({ headerNav: [...draft.headerNav, { label, href, hidden: true }] })
              setAddOpen(false)
            }}
          >
            <DcField
              label="Label"
              value={newLink.label}
              onChange={(v) => setNewLink((n) => ({ ...n, label: v }))}
              placeholder="New In"
            />
            <DcField
              label="URL"
              value={newLink.href}
              onChange={(v) => setNewLink((n) => ({ ...n, href: v }))}
              placeholder="/collections/new-in"
              mono
              hint="Relative paths stay on the storefront; full URLs open externally."
            />
          </DcModal>
        </>
      )}
    </>
  )
}

/* ── shared bits ─────────────────────────────────────────────────── */

function SectionHead({ title, meta }: { title: string; meta: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '12px 0 10px',
      }}
    >
      <span style={{ flex: 1, minWidth: 150, font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
        {title}
      </span>
      {meta ? (
        <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{meta}</span>
      ) : null}
    </div>
  )
}

/** Triple-labelled visibility row: eye icon, badge and a worded button. */
function VisRow({
  label,
  sub,
  note,
  on,
  badge,
  buttonLabel,
  onToggle,
  before,
}: {
  label: string
  sub: string
  note?: string | undefined
  on: boolean
  badge: string
  buttonLabel: string
  onToggle: () => void
  before?: React.ReactNode
}) {
  const t = toneStyle(on ? 'ok' : 'mute')
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        flexWrap: 'wrap',
        padding: '11px 0',
        borderTop: '1px solid var(--line)',
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 26,
          height: 26,
          flex: 'none',
          borderRadius: 8,
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
          color: on ? 'var(--ok)' : 'var(--ink-3)',
        }}
      >
        <DcIcon name={on ? 'icon-eye' : 'icon-eye-off'} size={12} />
      </span>
      <span style={{ flex: 1, minWidth: 130, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span
            style={{
              font: `500 12.5px/1.3 ${FONT}`,
              color: on ? 'var(--ink)' : 'var(--ink-3)',
            }}
          >
            {label}
          </span>
          {note ? (
            <span
              style={{
                padding: '2px 6px',
                borderRadius: 5,
                font: `600 9.5px/1 ${FONT}`,
                letterSpacing: '.05em',
                border: '1px solid var(--warn-bd)',
                background: 'var(--warn-soft)',
                color: 'var(--warn)',
              }}
            >
              {note}
            </span>
          ) : null}
        </span>
        <span style={{ font: `400 11.5px/1.4 ${MONO}`, color: 'var(--ink-3)' }}>{sub}</span>
      </span>
      {before}
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
          border: `1px solid ${t.bd}`,
          background: t.bg,
          color: t.fg,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
        {badge}
      </span>
      <button
        type="button"
        onClick={onToggle}
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 12px',
          borderRadius: 8,
          cursor: 'pointer',
          font: `600 12px/1 ${FONT}`,
          border: `1px solid ${on ? 'var(--line)' : 'var(--violet-solid)'}`,
          background: on ? 'var(--surface-2)' : 'var(--violet-solid)',
          color: on ? 'var(--ink-2)' : 'var(--on-violet)',
        }}
      >
        <DcIcon name={on ? 'icon-eye-off' : 'icon-eye'} size={13} />
        <span>{buttonLabel}</span>
      </button>
    </div>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '26px 0',
        textAlign: 'center',
        font: `400 12.5px/1.55 ${FONT}`,
        color: 'var(--ink-3)',
        borderTop: '1px solid var(--line)',
      }}
    >
      {text}
    </div>
  )
}

function IconBtn({
  icon,
  title,
  onClick,
}: {
  icon: string
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="dc-hover-ink"
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 28,
        height: 28,
        flex: 'none',
        borderRadius: 8,
        border: '1px solid var(--line)',
        background: 'var(--surface-2)',
        color: 'var(--ink-3)',
        cursor: 'pointer',
      }}
    >
      <DcIcon name={icon} size={13} />
    </button>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, ImageIcon } from 'lucide-react'
import { DEPARTMENT_SLUGS } from '@splaro/config'
import { AdminButton } from '@/components/ui/AdminButton'
import { MediaPickerModal } from '@/components/media/MediaPickerModal'
import { useCategoryTree } from '@/lib/api/hooks'
import type { MenuHeroOverride, MenuOverridesConfig } from '@/lib/api/settings'

interface MenuBuilderPanelProps {
  menuOverrides: MenuOverridesConfig
  onChange: (next: MenuOverridesConfig) => void
  onSave: () => void
  saving?: boolean
}

function deptSlugFromHref(href: string): string | null {
  const match = href.match(/^\/(?:c|collections)\/([^/?#]+)/)
  return match?.[1] ?? null
}

export function MenuBuilderPanel({ menuOverrides, onChange, onSave, saving }: MenuBuilderPanelProps) {
  const { data: treeData } = useCategoryTree()
  const [heroPicker, setHeroPicker] = useState<{ dept: string; index: number } | null>(null)

  const departments = useMemo(() => {
    const tree = treeData?.tree ?? []
    return DEPARTMENT_SLUGS.filter((slug) => slug !== 'accessories' && slug !== 'new-arrivals').map((slug) => {
      const node = tree.find((n) => n.slug === slug)
      const override = menuOverrides.departments?.find((d) => d.departmentSlug === slug)
      const children = node?.children ?? []
      const hidden = new Set(override?.hiddenCategoryIds ?? [])
      return { slug, node, override, children, hidden }
    })
  }, [menuOverrides.departments, treeData?.tree])

  const patchDept = (slug: string, patch: Partial<NonNullable<MenuOverridesConfig['departments']>[number]>) => {
    const existing = menuOverrides.departments ?? []
    const index = existing.findIndex((d) => d.departmentSlug === slug)
    const base = index >= 0 ? existing[index]! : { departmentSlug: slug }
    const nextDept = { ...base, ...patch, departmentSlug: slug }
    const next = [...existing]
    if (index >= 0) next[index] = nextDept
    else next.push(nextDept)
    onChange({ ...menuOverrides, departments: next })
  }

  const toggleHiddenCategory = (deptSlug: string, categoryId: string) => {
    const dept = menuOverrides.departments?.find((d) => d.departmentSlug === deptSlug)
    const hidden = new Set(dept?.hiddenCategoryIds ?? [])
    if (hidden.has(categoryId)) hidden.delete(categoryId)
    else hidden.add(categoryId)
    patchDept(deptSlug, { hiddenCategoryIds: [...hidden] })
  }

  const moveCategory = (deptSlug: string, categoryId: string, direction: -1 | 1) => {
    const dept = departments.find((d) => d.slug === deptSlug)
    if (!dept?.children.length) return
    const order = dept.override?.categoryOrder?.length
      ? [...dept.override.categoryOrder]
      : dept.children.map((c) => c.id)
    const idx = order.indexOf(categoryId)
    if (idx < 0) return
    const swap = idx + direction
    if (swap < 0 || swap >= order.length) return
    ;[order[idx], order[swap]] = [order[swap]!, order[idx]!]
    patchDept(deptSlug, { categoryOrder: order })
  }

  const updateHero = (deptSlug: string, index: number, patch: Partial<MenuHeroOverride>) => {
    const dept = menuOverrides.departments?.find((d) => d.departmentSlug === deptSlug)
    const heroes = [...(dept?.heroes ?? [{ label: '', href: `/c/${deptSlug}`, image: '' }, { label: '', href: `/c/${deptSlug}`, image: '' }, { label: '', href: `/c/${deptSlug}`, image: '' }])]
    heroes[index] = { ...heroes[index]!, ...patch }
    patchDept(deptSlug, { heroes: heroes.slice(0, 3) })
  }

  return (
    <section className="admin-module-card space-y-5">
      <div>
        <h3 className="admin-module-card__title">Mega menu builder</h3>
        <p className="admin-module-card__text mt-1">
          Categories with published products auto-appear in mega menus. Hide, reorder, or override hero cards per department.
        </p>
        <label className="admin-check-row mt-3">
          <span className="text-sm font-semibold">Auto-sync new categories with products</span>
          <input
            type="checkbox"
            checked={menuOverrides.autoSync !== false}
            onChange={() => onChange({ ...menuOverrides, autoSync: menuOverrides.autoSync === false })}
            className="h-4 w-4 accent-[#5E7CFF]"
          />
        </label>
      </div>

      {departments.map(({ slug, node, override, children, hidden }) => (
        <div key={slug} className="rounded-[16px] border border-black/6 bg-white/70 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-black capitalize">{slug}</h4>
            <div className="flex flex-wrap gap-2">
              <AdminButton
                size="sm"
                variant="ghost"
                onClick={() => patchDept(slug, { hidden: !override?.hidden })}
              >
                {override?.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {override?.hidden ? 'Show dept' : 'Hide dept'}
              </AdminButton>
              <AdminButton
                size="sm"
                variant="ghost"
                onClick={() => patchDept(slug, { forceVisible: !override?.forceVisible })}
              >
                {override?.forceVisible ? 'Auto hide when empty' : 'Force visible'}
              </AdminButton>
            </div>
          </div>

          <p className="mb-2 text-[11px] font-semibold text-[var(--admin-text-muted)]">
            Columns ({children.length} subcategories · {(node?._count?.products ?? 0)} dept products)
          </p>
          <div className="space-y-2">
            {(override?.categoryOrder?.length
              ? override.categoryOrder
                  .map((id) => children.find((c) => c.id === id))
                  .filter(Boolean)
              : children
            ).map((child) => {
              if (!child) return null
              const isHidden = hidden.has(child.id)
              return (
                <div
                  key={child.id}
                  className="flex flex-wrap items-center gap-2 rounded-[12px] border border-black/5 bg-white px-3 py-2"
                >
                  <span className={isHidden ? 'text-[var(--admin-text-muted)] line-through' : 'font-semibold'}>
                    {child.name}
                  </span>
                  <span className="text-[10px] text-[var(--admin-text-muted)]">{child._count?.products ?? 0} products</span>
                  <div className="ml-auto flex gap-1">
                    <AdminButton size="sm" variant="ghost" onClick={() => moveCategory(slug, child.id, -1)}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </AdminButton>
                    <AdminButton size="sm" variant="ghost" onClick={() => moveCategory(slug, child.id, 1)}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </AdminButton>
                    <AdminButton size="sm" variant="ghost" onClick={() => toggleHiddenCategory(slug, child.id)}>
                      {isHidden ? 'Unhide' : 'Hide'}
                    </AdminButton>
                  </div>
                </div>
              )
            })}
            {!children.length ? (
              <p className="text-xs font-semibold text-[var(--admin-text-secondary)]">No subcategories — seed category tree in Catalog.</p>
            ) : null}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--admin-text-muted)]">Hero cards</p>
            <div className="grid gap-3 md:grid-cols-3">
              {[0, 1, 2].map((index) => {
                const hero = override?.heroes?.[index] ?? { label: '', href: `/c/${slug}`, image: '' }
                return (
                  <div key={index} className="space-y-2 rounded-[12px] border border-black/5 p-3">
                    <input
                      className="admin-input"
                      placeholder="Label"
                      value={hero.label}
                      onChange={(e) => updateHero(slug, index, { label: e.target.value })}
                    />
                    <input
                      className="admin-input"
                      placeholder="/c/..."
                      value={hero.href}
                      onChange={(e) => updateHero(slug, index, { href: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <input
                        className="admin-input min-w-0 flex-1"
                        placeholder="Image URL"
                        value={hero.image}
                        onChange={(e) => updateHero(slug, index, { image: e.target.value })}
                      />
                      <AdminButton size="sm" onClick={() => setHeroPicker({ dept: slug, index })}>
                        <ImageIcon className="h-3.5 w-3.5" />
                      </AdminButton>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ))}

      <AdminButton variant="gold" loading={Boolean(saving)} onClick={onSave}>
        Save menu builder
      </AdminButton>

      <MediaPickerModal
        open={Boolean(heroPicker)}
        onClose={() => setHeroPicker(null)}
        title="Hero card image"
        onSelect={(url) => {
          if (heroPicker) updateHero(heroPicker.dept, heroPicker.index, { image: url })
          setHeroPicker(null)
        }}
      />
    </section>
  )
}

export { deptSlugFromHref }

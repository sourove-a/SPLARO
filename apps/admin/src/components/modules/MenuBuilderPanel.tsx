'use client'

import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImageIcon,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { DEPARTMENT_SLUGS } from '@splaro/config'
import { AdminButton } from '@/components/ui/AdminButton'
import { MediaPickerModal } from '@/components/media/MediaPickerModal'
import { toastWarn } from '@/lib/admin/feedback'
import { useCategoryTree } from '@/lib/api/hooks'
import type { CategoryTreeNode } from '@/lib/api/categories'
import type { MenuHeroOverride, MenuOverridesConfig, NavLink } from '@/lib/api/settings'
import { isHrefBlockedByCatalogChannels, type CatalogChannel } from '@splaro/types'

interface MenuBuilderPanelProps {
  menuOverrides: MenuOverridesConfig
  persistedOverrides: MenuOverridesConfig
  catalogChannels: CatalogChannel[]
  headerNav: NavLink[]
  onChange: (next: MenuOverridesConfig) => void
  onSave: (overrides?: MenuOverridesConfig, label?: string) => void
  saving?: boolean
}

function deptSlugFromHref(href: string): string | null {
  const match = href.match(/^\/(?:c|collections)\/([^/?#]+)/)
  if (match?.[1]) return match[1]
  const path = href.split(/[?#]/, 1)[0]?.replace(/\/$/, '')
  if (path === '/accessories') return 'accessories'
  if (path === '/new-arrivals') return 'new-arrivals'
  return null
}

function totalProducts(node: CategoryTreeNode): number {
  return (node._count?.products ?? 0) + node.children.reduce((sum, child) => sum + totalProducts(child), 0)
}

function heroDrafts(overrides: MenuOverridesConfig): Array<[string, MenuHeroOverride[]]> {
  return (overrides.departments ?? []).map((dept) => [dept.departmentSlug, dept.heroes ?? []])
}

function isSafeMenuHref(value: string): boolean {
  const href = value.trim()
  return (
    href.startsWith('/') ||
    href.startsWith('https://') ||
    href.startsWith('http://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  )
}

export function MenuBuilderPanel({
  menuOverrides,
  persistedOverrides,
  catalogChannels,
  headerNav,
  onChange,
  onSave,
  saving,
}: MenuBuilderPanelProps) {
  const categoryTree = useCategoryTree()
  const [heroPicker, setHeroPicker] = useState<{ dept: string; index: number } | null>(null)
  const [expandedDepartment, setExpandedDepartment] = useState<string | null>('women')

  const heroDirty = JSON.stringify(heroDrafts(menuOverrides)) !== JSON.stringify(heroDrafts(persistedOverrides))

  const departments = useMemo(() => {
    const tree = categoryTree.data?.tree ?? []
    return DEPARTMENT_SLUGS.map((slug) => {
      const node = tree.find((entry) => entry.slug === slug)
      const override = menuOverrides.departments?.find((dept) => dept.departmentSlug === slug)
      const children = node?.children ?? []
      const hidden = new Set(override?.hiddenCategoryIds ?? [])
      const orderedChildren = override?.categoryOrder?.length
        ? [
            ...override.categoryOrder
              .map((id) => children.find((child) => child.id === id))
              .filter((child): child is NonNullable<typeof child> => Boolean(child)),
            ...children.filter((child) => !override.categoryOrder?.includes(child.id)),
          ]
        : children
      const productCount = node ? totalProducts(node) : null
      const headerLink = headerNav.find((item) => deptSlugFromHref(item.href) === slug)
      const catalogBlocked = isHrefBlockedByCatalogChannels(`/c/${slug}`, catalogChannels)
      const liveColumnCount = orderedChildren.filter(
        (child) => child.isActive !== false && totalProducts(child) > 0 && !hidden.has(child.id),
      ).length
      const linkVisible =
        Boolean(headerLink) &&
        !headerLink?.hidden &&
        !catalogBlocked &&
        !override?.hidden
      const megaVisible = linkVisible && Boolean(override?.forceVisible || liveColumnCount > 0)
      return {
        slug,
        node,
        headerLink,
        override,
        children: orderedChildren,
        hidden,
        productCount,
        catalogBlocked,
        liveColumnCount,
        linkVisible,
        megaVisible,
      }
    })
  }, [catalogChannels, categoryTree.data?.tree, headerNav, menuOverrides.departments])

  const patchDept = (
    slug: string,
    patch: Partial<NonNullable<MenuOverridesConfig['departments']>[number]>,
    autoSave = false,
    label = 'Mega menu',
  ) => {
    const existing = menuOverrides.departments ?? []
    const index = existing.findIndex((dept) => dept.departmentSlug === slug)
    const base = index >= 0 ? existing[index]! : { departmentSlug: slug }
    const nextDept = { ...base, ...patch, departmentSlug: slug }
    const departmentsNext = [...existing]
    if (index >= 0) departmentsNext[index] = nextDept
    else departmentsNext.push(nextDept)
    const next = { ...menuOverrides, departments: departmentsNext }
    onChange(next)
    if (autoSave) onSave(next, label)
  }

  const requireCleanHeroes = () => {
    if (!heroDirty) return true
    toastWarn('Save hero card edits first — visibility/order was not changed.')
    return false
  }

  const toggleAutoSync = () => {
    if (!requireCleanHeroes()) return
    const next = { ...menuOverrides, autoSync: menuOverrides.autoSync === false }
    onChange(next)
    onSave(next, 'Category auto-sync')
  }

  const toggleHiddenCategory = (deptSlug: string, categoryId: string) => {
    if (!requireCleanHeroes()) return
    const dept = menuOverrides.departments?.find((entry) => entry.departmentSlug === deptSlug)
    const hidden = new Set(dept?.hiddenCategoryIds ?? [])
    if (hidden.has(categoryId)) hidden.delete(categoryId)
    else hidden.add(categoryId)
    patchDept(deptSlug, { hiddenCategoryIds: [...hidden] }, true, 'Category visibility')
  }

  const moveCategory = (deptSlug: string, categoryId: string, direction: -1 | 1) => {
    if (!requireCleanHeroes()) return
    const dept = departments.find((entry) => entry.slug === deptSlug)
    if (!dept?.children.length) return
    const order = dept.children.map((child) => child.id)
    const index = order.indexOf(categoryId)
    const swapIndex = index + direction
    if (index < 0 || swapIndex < 0 || swapIndex >= order.length) return
    ;[order[index], order[swapIndex]] = [order[swapIndex]!, order[index]!]
    patchDept(deptSlug, { categoryOrder: order }, true, 'Category order')
  }

  const setDepartmentVisibility = (slug: string, mode: 'hidden' | 'auto' | 'visible') => {
    if (!requireCleanHeroes()) return
    const patch =
      mode === 'hidden'
        ? { hidden: true, forceVisible: false }
        : mode === 'visible'
          ? { hidden: false, forceVisible: true }
          : { hidden: false, forceVisible: false }
    patchDept(slug, patch, true, 'Department visibility')
  }

  const updateHero = (deptSlug: string, index: number, patch: Partial<MenuHeroOverride>) => {
    const dept = menuOverrides.departments?.find((entry) => entry.departmentSlug === deptSlug)
    const empty = { label: '', href: '', image: '' }
    const heroes = [...(dept?.heroes ?? [empty, empty, empty])]
    heroes[index] = { ...empty, ...heroes[index], ...patch }
    patchDept(deptSlug, { heroes: heroes.slice(0, 3) })
  }

  const saveHeroes = () => {
    const invalid = (menuOverrides.departments ?? []).flatMap((dept) =>
      (dept.heroes ?? []).filter((hero) => {
        const hasAny = Boolean(hero.label.trim() || hero.href.trim() || hero.image.trim())
        const image = hero.image.trim()
        const imageInvalid =
          Boolean(image) &&
          !image.startsWith('/') &&
          !image.startsWith('https://') &&
          !image.startsWith('http://')
        return (
          hasAny &&
          (!hero.label.trim() || !hero.href.trim() || !isSafeMenuHref(hero.href) || imageInvalid)
        )
      }),
    )
    if (invalid.length) {
      toastWarn('Hero card needs label + valid URL. Nothing was saved.')
      return
    }
    onSave(menuOverrides, 'Mega-menu hero cards')
  }

  if (categoryTree.isError) {
    return (
      <section className="menu-builder menu-builder--error">
        <div>
          <h3>Mega menu unavailable</h3>
          <p>Category API failed. No category count or visibility shown.</p>
        </div>
        <AdminButton onClick={() => void categoryTree.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry categories
        </AdminButton>
      </section>
    )
  }

  return (
    <section className="menu-builder">
      <div className="menu-builder__head">
        <span className="menu-builder__head-icon">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h3>Mega menu departments</h3>
          <p>Only active categories with published storefront products appear. Counts below come from catalog API.</p>
        </div>
        <label className="menu-builder__sync">
          <span>
            <strong>Auto-sync categories</strong>
            <small>New live categories join automatically</small>
          </span>
          <input
            type="checkbox"
            checked={menuOverrides.autoSync !== false}
            disabled={Boolean(saving || categoryTree.isLoading)}
            onChange={toggleAutoSync}
          />
        </label>
      </div>

      {categoryTree.isLoading ? <p className="menu-builder__loading">Loading verified category tree…</p> : null}

      <div className="menu-builder__departments">
        {departments.map(({
          slug,
          node,
          headerLink,
          override,
          children,
          hidden,
          productCount,
          catalogBlocked,
          liveColumnCount,
          linkVisible,
          megaVisible,
        }) => (
          <article key={slug} className="menu-department">
            <header className="menu-department__head">
              <span className="menu-department__identity">
                <span className="menu-department__monogram">{slug.slice(0, 2).toUpperCase()}</span>
                <span>
                  <strong>{slug.replaceAll('-', ' ')}</strong>
                  <small>
                    {node
                      ? `${liveColumnCount}/${children.length} live columns · ${productCount ?? 0} published products`
                      : 'Department missing from category tree'}
                  </small>
                </span>
              </span>
              <span className={linkVisible ? 'menu-state menu-state--live' : 'menu-state menu-state--hidden'}>
                {!headerLink
                  ? 'NOT IN HEADER'
                  : headerLink.hidden
                    ? 'HEADER HIDDEN'
                  : catalogBlocked
                    ? 'CATALOG BLOCKED'
                    : override?.hidden
                      ? 'HIDDEN BY ADMIN'
                      : megaVisible
                        ? 'LIVE MEGA'
                        : 'LIVE LINK · NO MEGA'}
              </span>
              <button
                type="button"
                className="menu-department__expand"
                aria-expanded={expandedDepartment === slug}
                aria-label={`${expandedDepartment === slug ? 'Collapse' : 'Expand'} ${slug} menu editor`}
                onClick={() => setExpandedDepartment((current) => (current === slug ? null : slug))}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <div className="menu-department__modes" aria-label={`${slug} storefront visibility`}>
                <button
                  type="button"
                  className={override?.hidden ? 'is-active' : ''}
                  disabled={Boolean(saving)}
                  onClick={() => setDepartmentVisibility(slug, 'hidden')}
                >
                  <EyeOff className="h-3.5 w-3.5" /> Hidden
                </button>
                <button
                  type="button"
                  className={!override?.hidden && !override?.forceVisible ? 'is-active' : ''}
                  disabled={Boolean(saving)}
                  onClick={() => setDepartmentVisibility(slug, 'auto')}
                >
                  Auto
                </button>
                <button
                  type="button"
                  className={!override?.hidden && override?.forceVisible ? 'is-active' : ''}
                  disabled={Boolean(saving)}
                  onClick={() => setDepartmentVisibility(slug, 'visible')}
                >
                  <Eye className="h-3.5 w-3.5" /> Force live
                </button>
              </div>
            </header>

            {expandedDepartment === slug ? <div className="menu-department__body">
              <div className="menu-department__columns">
                <div className="menu-builder__section-label">
                  <span>Storefront columns</span>
                  <span>visibility + order save instantly</span>
                </div>
                {children.map((child, index) => {
                  const isHidden = hidden.has(child.id)
                  const childProducts = totalProducts(child)
                  const childInactive = child.isActive === false
                  const childLive = !isHidden && !childInactive && childProducts > 0
                  return (
                    <div key={child.id} className={childLive ? 'menu-category-row' : 'menu-category-row is-hidden'}>
                      <span className="menu-category-row__index">{String(index + 1).padStart(2, '0')}</span>
                      <span className="menu-category-row__name">
                        <strong>{child.name}</strong>
                        <small>
                          {childProducts} published products
                          {childProducts !== (child._count?.products ?? 0) ? ' incl. nested' : ''}
                        </small>
                      </span>
                      <span className={childLive ? 'menu-state menu-state--live' : 'menu-state menu-state--hidden'}>
                        {isHidden
                          ? 'MENU HIDDEN'
                          : childInactive
                            ? 'INACTIVE'
                            : childProducts === 0
                              ? 'NO LIVE PRODUCTS'
                              : 'VISIBLE'}
                      </span>
                      <span className="menu-category-row__actions">
                        <button
                          type="button"
                          aria-label={`Move ${child.name} up`}
                          disabled={Boolean(saving || index === 0)}
                          onClick={() => moveCategory(slug, child.id, -1)}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${child.name} down`}
                          disabled={Boolean(saving || index === children.length - 1)}
                          onClick={() => moveCategory(slug, child.id, 1)}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(saving)}
                          onClick={() => toggleHiddenCategory(slug, child.id)}
                        >
                          {isHidden ? 'Show' : 'Hide'}
                        </button>
                      </span>
                    </div>
                  )
                })}
                {node && children.length === 0 ? (
                  <p className="menu-builder__empty">No child categories. Add them under Catalog → Categories.</p>
                ) : null}
                {!node ? (
                  <p className="menu-builder__empty">Create “{slug}” department in Catalog before storefront mega menu can go live.</p>
                ) : null}
              </div>

              <div className="menu-department__heroes">
                <div className="menu-builder__section-label">
                  <span>Department hero cards</span>
                  <span>up to 3 · image optional</span>
                </div>
                <div className="menu-hero-grid">
                  {[0, 1, 2].map((index) => {
                    const hero = override?.heroes?.[index] ?? { label: '', href: '', image: '' }
                    return (
                      <div key={index} className="menu-hero-card">
                        <span className="menu-hero-card__number">{String(index + 1).padStart(2, '0')}</span>
                        <input
                          className="admin-input"
                          aria-label={`${slug} hero ${index + 1} label`}
                          placeholder="Card label"
                          value={hero.label}
                          onChange={(event) => updateHero(slug, index, { label: event.target.value })}
                        />
                        <input
                          className="admin-input"
                          aria-label={`${slug} hero ${index + 1} destination`}
                          placeholder={`/c/${slug}`}
                          value={hero.href}
                          onChange={(event) => updateHero(slug, index, { href: event.target.value })}
                        />
                        <div className="menu-hero-card__image">
                          <input
                            className="admin-input"
                            aria-label={`${slug} hero ${index + 1} image`}
                            placeholder="Image URL (optional)"
                            value={hero.image}
                            onChange={(event) => updateHero(slug, index, { image: event.target.value })}
                          />
                          <AdminButton
                            size="sm"
                            iconOnly
                            aria-label={`Choose ${slug} hero ${index + 1} image`}
                            onClick={() => setHeroPicker({ dept: slug, index })}
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                          </AdminButton>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div> : null}
          </article>
        ))}
      </div>

      <div className="menu-builder__savebar">
        <span>
          {heroDirty
            ? 'Unsaved hero text/media changes. Instant controls pause until saved.'
            : 'Visibility, auto-sync, and order use verified immediate saves.'}
        </span>
        <AdminButton variant="gold" loading={Boolean(saving)} disabled={!heroDirty} onClick={saveHeroes}>
          Save hero cards
        </AdminButton>
      </div>

      <MediaPickerModal
        open={Boolean(heroPicker)}
        onClose={() => setHeroPicker(null)}
        title="Mega-menu hero image"
        onSelect={(url) => {
          if (heroPicker) updateHero(heroPicker.dept, heroPicker.index, { image: url })
          setHeroPicker(null)
        }}
      />
    </section>
  )
}

export { deptSlugFromHref }

'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcInput } from '@/components/dc/product/DcProductFormPrimitives'
import { FONT, formatTaka } from '@/components/dc/tokens'
import { buildCategoryPicker, menuIconFor, type CategoryPickerRow } from '@/lib/admin/category-picker'
import { useCategoryTree, useProducts } from '@/lib/api/hooks'
import type { ApiProduct } from '@/lib/api/products'
import { resolveMediaUrl } from '@/lib/media-url'
import {
  DEFAULT_HOMEPAGE_CATALOG,
  HOMEPAGE_CATALOG_DEPARTMENTS,
  isHomepageCatalogDepartment,
  type HomepageCatalogConfig,
  type HomepageCatalogDepartment,
} from '@splaro/config'

const DEPT_STORAGE = 'splaro-home-tile-dept'
const TILE_DRAG = 'application/x-splaro-home-tile'

const DEPT_LABEL: Record<HomepageCatalogDepartment, string> = {
  men: 'Men',
  women: 'Women',
  kids: 'Kids',
  footwear: 'Footwear',
  accessories: 'Accessories',
}

function productThumb(p: ApiProduct): string | null {
  const imgs = p.images ?? []
  const preferred = imgs.find((i) => i.isDefault) ?? imgs[0]
  const raw = preferred?.url ?? p.variants?.find((v) => v.image)?.image ?? null
  return raw ? resolveMediaUrl(raw) : null
}

function matchedInCategory(products: ApiProduct[], cat: CategoryPickerRow): ApiProduct[] {
  const name = cat.name.trim().toLowerCase()
  const slug = cat.slug.trim().toLowerCase()
  return products.filter((p) => {
    if (p.categoryId === cat.id) return true
    if (p.category?.id === cat.id) return true
    if (p.category?.slug && p.category.slug.trim().toLowerCase() === slug) return true
    const catName = (p.category?.name ?? '').trim().toLowerCase()
    if (name && catName === name) return true
    if (slug && catName.replace(/\s+/g, '-') === slug) return true
    return false
  })
}

function productsInCategory(products: ApiProduct[], cat: CategoryPickerRow): {
  items: ApiProduct[]
  tagged: number
} {
  const matched = matchedInCategory(products, cat)
  return { items: matched, tagged: matched.length }
}

function variantStock(p: ApiProduct): number {
  if (!p.variants?.length) return 0
  return p.variants.reduce((sum, v) => sum + (v.stockQuantity ?? v.stock ?? 0), 0)
}

function tileKey(department: HomepageCatalogDepartment, categorySlug: string) {
  return `${department}::${categorySlug.trim().toLowerCase()}`
}

export function DcHomepageCatalogTiles({
  value,
  onChange,
}: {
  value: HomepageCatalogConfig
  onChange: (next: HomepageCatalogConfig) => void
}) {
  const tree = useCategoryTree()
  const productsQuery = useProducts({ status: 'published', limit: 300 })
  const picker = useMemo(
    () => buildCategoryPicker(tree.data?.categories ?? [], tree.data?.tree),
    [tree.data?.categories, tree.data?.tree],
  )
  const products = useMemo(
    () => productsQuery.data?.products ?? [],
    [productsQuery.data?.products],
  )
  const tiles = value.tiles ?? DEFAULT_HOMEPAGE_CATALOG.tiles
  const curated = value.curated === true

  const [department, setDepartment] = useState<HomepageCatalogDepartment>('men')
  const [categorySlug, setCategorySlug] = useState<string>('')
  const [catQuery, setCatQuery] = useState('')
  const [prodQuery, setProdQuery] = useState('')
  const [browseAll, setBrowseAll] = useState(false)
  const [dropSlug, setDropSlug] = useState<string | null>(null)

  useEffect(() => {
    void tree.refetch()
    void productsQuery.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const stored = sessionStorage.getItem(DEPT_STORAGE)
    if (stored && isHomepageCatalogDepartment(stored)) setDepartment(stored)
  }, [])
  useEffect(() => {
    sessionStorage.setItem(DEPT_STORAGE, department)
  }, [department])

  const deptRow = useMemo(() => {
    const dTarget = department.toLowerCase().trim()
    return (
      picker.departments.find((d) => d.slug.toLowerCase().trim() === dTarget) ??
      picker.departments.find((d) => d.name.toLowerCase().trim() === dTarget) ??
      picker.departments.find((d) => {
        const s = d.slug.toLowerCase()
        const n = d.name.toLowerCase()
        if (dTarget === 'men') return (s === 'men' || n === 'men' || s.startsWith('men') || n.startsWith('men')) && !s.includes('women') && !n.includes('women')
        if (dTarget === 'women') return s.includes('women') || n.includes('women')
        if (dTarget === 'kids') return s.includes('kid') || n.includes('kid') || s.includes('child') || n.includes('child')
        if (dTarget === 'footwear') return s.includes('foot') || n.includes('foot') || s.includes('shoe') || n.includes('shoe')
        if (dTarget === 'accessories') return s.includes('accessor') || n.includes('accessor')
        return false
      })
    )
  }, [picker, department])

  const subcats = useMemo(() => {
    if (deptRow) {
      return picker.allSubcategoriesForDepartment(deptRow.id)
    }
    const all = tree.data?.categories ?? []
    return all.filter((c) => {
      const s = c.slug.toLowerCase()
      const n = c.name.toLowerCase()
      if (department === 'men') return (s.includes('men') || n.includes('men')) && !s.includes('women') && !n.includes('women')
      if (department === 'women') return s.includes('women') || n.includes('women')
      if (department === 'kids') return s.includes('kid') || n.includes('kid') || s.includes('child') || n.includes('child')
      if (department === 'footwear') return s.includes('foot') || n.includes('foot') || s.includes('shoe') || n.includes('shoe')
      if (department === 'accessories') return s.includes('accessor') || n.includes('accessor')
      return false
    })
  }, [deptRow, picker, tree.data?.categories, department])

  const deptTiles = useMemo(
    () => tiles.filter((tile) => tile.department === department),
    [tiles, department],
  )
  const taggedBySlug = useMemo(() => {
    const map = new Map<string, number>()
    for (const cat of subcats) map.set(cat.slug, matchedInCategory(products, cat).length)
    return map
  }, [subcats, products])

  const orderedSubcats = useMemo(() => {
    const q = catQuery.trim().toLowerCase()
    const live = deptTiles
      .map((t) => subcats.find((c) => c.slug === t.categorySlug))
      .filter((c): c is CategoryPickerRow => Boolean(c))
    const rest = subcats.filter((c) => !deptTiles.some((t) => t.categorySlug === c.slug))
    const list = [...live, ...rest]
    return q ? list.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q)) : list
  }, [subcats, deptTiles, catQuery])

  const selectedCat =
    orderedSubcats.find((c) => c.slug === categorySlug) ??
    orderedSubcats.find((c) => deptTiles.some((t) => t.categorySlug === c.slug)) ??
    orderedSubcats[0] ??
    null
  const activeSlug = selectedCat?.slug ?? ''
  const activeTile = deptTiles.find((t) => t.categorySlug === activeSlug)
  const categoryMatch = useMemo(
    () => (selectedCat ? productsInCategory(products, selectedCat) : null),
    [products, selectedCat],
  )
  const categoryProducts = useMemo(() => categoryMatch?.items ?? [], [categoryMatch])
  const candidateProducts = useMemo(() => {
    if (browseAll || categoryProducts.length === 0) return products
    return categoryProducts
  }, [browseAll, categoryProducts, products])

  const visibleProducts = useMemo(() => {
    const q = prodQuery.trim().toLowerCase()
    if (!q) return candidateProducts
    return candidateProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q) ||
        (p.variants ?? []).some(
          (v) =>
            (v.sku ?? '').toLowerCase().includes(q) || (v.barcode ?? '').toLowerCase().includes(q),
        ),
    )
  }, [candidateProducts, prodQuery])
  const selectedProduct = products.find((p) => p.id === activeTile?.productId) ?? null

  const setCurated = (next: boolean) => onChange({ ...value, curated: next })

  const selectProduct = (productId: string) => {
    if (!selectedCat) return
    const slug = selectedCat.slug.trim().toLowerCase()
    const existing = tiles.find((t) => tileKey(t.department, t.categorySlug) === tileKey(department, slug))
    const nextTiles = existing
      ? tiles.map((t) => (t.id === existing.id ? { ...t, productId } : t))
      : [
          ...tiles,
          {
            id: `tile-${department}-${slug}`,
            department,
            categorySlug: slug,
            productId,
          },
        ]
    onChange({ curated: true, tiles: nextTiles })
  }

  const removeCategory = (slug: string) => {
    onChange({
      ...value,
      tiles: tiles.filter((t) => !(t.department === department && t.categorySlug === slug)),
    })
  }

  const moveCategory = (slug: string, direction: -1 | 1) => {
    const indexes = tiles
      .map((t, i) => (t.department === department ? i : -1))
      .filter((i) => i >= 0)
    const currentPos = tiles.findIndex((t) => t.department === department && t.categorySlug === slug)
    const orderPos = indexes.indexOf(currentPos)
    const swapPos = orderPos + direction
    if (currentPos < 0 || swapPos < 0 || swapPos >= indexes.length) return
    const targetIndex = indexes[swapPos]
    if (targetIndex == null) return
    const next = [...tiles]
    const a = next[currentPos]
    const b = next[targetIndex]
    if (!a || !b) return
    next[currentPos] = b
    next[targetIndex] = a
    onChange({ ...value, tiles: next })
  }

  const dropOnCategory = (fromSlug: string, toSlug: string) => {
    setDropSlug(null)
    if (!fromSlug || fromSlug === toSlug) return
    const deptOnly = tiles.filter((t) => t.department === department)
    const from = deptOnly.findIndex((t) => t.categorySlug === fromSlug)
    const to = deptOnly.findIndex((t) => t.categorySlug === toSlug)
    if (from < 0 || to < 0) return
    const reordered = [...deptOnly]
    const [moved] = reordered.splice(from, 1)
    if (!moved) return
    reordered.splice(to, 0, moved)
    let i = 0
    onChange({
      ...value,
      tiles: tiles.map((t) => (t.department === department ? reordered[i++] ?? t : t)),
    })
  }

  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 14,
        background: 'var(--surface)',
        backgroundImage: 'var(--card-sheen)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          padding: '14px 16px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span style={{ flex: 1, minWidth: 220 }}>
          <span style={{ display: 'block', font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
            Homepage tiles
          </span>
          <span style={{ display: 'block', marginTop: 6, font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
            Menu → category → product photo. Drag the rail to reorder. Save to go live on the
            storefront.
          </span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            title="Refresh categories and products"
            onClick={() => {
              void tree.refetch()
              void productsQuery.refetch()
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink-2)',
              cursor: 'pointer',
              font: `600 12px/1 ${FONT}`,
            }}
          >
            <DcIcon name="icon-refresh" size={12} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setCurated(!curated)}
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 8,
              cursor: 'pointer',
              font: `600 12px/1 ${FONT}`,
              border: `1px solid ${curated ? 'var(--violet-solid)' : 'var(--line)'}`,
              background: curated ? 'var(--violet-solid)' : 'var(--surface-2)',
              color: curated ? 'var(--on-violet)' : 'var(--ink-2)',
            }}
          >
            {curated ? 'Custom on homepage' : 'Auto (all categories)'}
          </button>
        </div>
      </div>

      {!curated ? (
        <p style={{ margin: 0, padding: '16px', font: `400 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
          Storefront is automatic right now. Turn custom on, then pick a menu, a category, and the
          exact product photo for that tile.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            minHeight: 420,
          }}
        >
          <nav style={{ borderRight: '1px solid var(--line)', padding: 12, background: 'var(--surface-2)' }}>
            <span
              style={{
                display: 'block',
                margin: '2px 8px 10px',
                font: `600 10.5px/1 ${FONT}`,
                letterSpacing: '.09em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              Menu
            </span>
            {HOMEPAGE_CATALOG_DEPARTMENTS.map((slug) => {
              const on = department === slug
              const count = tiles.filter((t) => t.department === slug).length
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => {
                    setDepartment(slug)
                    setCategorySlug('')
                    setProdQuery('')
                    setCatQuery('')
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    height: 40,
                    padding: '0 10px',
                    borderRadius: 10,
                    border: `1px solid ${on ? 'var(--violet-bd)' : 'transparent'}`,
                    background: on ? 'var(--violet-soft)' : 'transparent',
                    color: on ? 'var(--violet)' : 'var(--ink-2)',
                    cursor: 'pointer',
                    font: `600 13px/1 ${FONT}`,
                    marginBottom: 4,
                  }}
                >
                  <DcIcon name={menuIconFor(DEPT_LABEL[slug])} size={14} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{DEPT_LABEL[slug]}</span>
                  <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>{count}</span>
                </button>
              )
            })}
          </nav>

          <div style={{ borderRight: '1px solid var(--line)', padding: 12 }}>
            <span
              style={{
                display: 'block',
                margin: '2px 8px 10px',
                font: `600 10.5px/1 ${FONT}`,
                letterSpacing: '.09em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              Categories · {DEPT_LABEL[department]}
            </span>
            <DcInput
              placeholder="Search categories…"
              value={catQuery}
              onChange={(e) => setCatQuery(e.target.value)}
              style={{ height: 32, marginBottom: 10 }}
            />
            {subcats.length === 0 ? (
              <p style={{ margin: '8px', font: `400 12.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
                No categories under this menu yet. Add them in Categories first.
              </p>
            ) : orderedSubcats.length === 0 ? (
              <p style={{ margin: '8px', font: `400 12.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
                No categories match that search.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {orderedSubcats.map((cat) => {
                  const on = activeSlug === cat.slug
                  const live = deptTiles.some((t) => t.categorySlug === cat.slug)
                  const liveIndex = deptTiles.findIndex((t) => t.categorySlug === cat.slug)
                  const tagged = taggedBySlug.get(cat.slug) ?? 0
                  return (
                    <div
                      key={cat.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        borderRadius: 10,
                        border: `1px solid ${on ? 'var(--violet-bd)' : 'var(--line)'}`,
                        background: on ? 'var(--violet-soft)' : 'var(--surface-2)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCategorySlug(cat.slug)
                          setProdQuery('')
                          setBrowseAll(false)
                        }}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          minWidth: 0,
                          height: 42,
                          padding: '0 10px',
                          border: 0,
                          background: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            font: `600 12.5px/1.2 ${FONT}`,
                            color: on ? 'var(--violet)' : 'var(--ink)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cat.name}
                        </span>
                        <span style={{ flex: 'none', font: `600 10.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                          {tagged}
                        </span>
                        {live ? (
                          <span
                            style={{
                              flex: 'none',
                              padding: '2px 7px',
                              borderRadius: 99,
                              background: 'var(--ok-soft)',
                              color: 'var(--ok)',
                              font: `600 10px/1.4 ${FONT}`,
                            }}
                          >
                            Live
                          </span>
                        ) : null}
                      </button>
                      {live ? (
                        <>
                          <button
                            type="button"
                            title="Move left on homepage"
                            disabled={liveIndex <= 0}
                            onClick={() => moveCategory(cat.slug, -1)}
                            style={{
                              width: 28,
                              height: 28,
                              border: 0,
                              background: 'transparent',
                              color: 'var(--ink-3)',
                              cursor: liveIndex <= 0 ? 'not-allowed' : 'pointer',
                              opacity: liveIndex <= 0 ? 0.35 : 1,
                            }}
                          >
                            <DcIcon name="icon-chevron-up" size={14} />
                          </button>
                          <button
                            type="button"
                            title="Move right on homepage"
                            disabled={liveIndex < 0 || liveIndex >= deptTiles.length - 1}
                            onClick={() => moveCategory(cat.slug, 1)}
                            style={{
                              width: 28,
                              height: 28,
                              border: 0,
                              background: 'transparent',
                              color: 'var(--ink-3)',
                              cursor:
                                liveIndex < 0 || liveIndex >= deptTiles.length - 1
                                  ? 'not-allowed'
                                  : 'pointer',
                              opacity: liveIndex < 0 || liveIndex >= deptTiles.length - 1 ? 0.35 : 1,
                            }}
                          >
                            <DcIcon name="icon-chevron-down" size={14} />
                          </button>
                          <button
                            type="button"
                            title="Remove from homepage"
                            onClick={() => removeCategory(cat.slug)}
                            style={{
                              width: 28,
                              height: 28,
                              border: 0,
                              background: 'transparent',
                              color: 'var(--ink-3)',
                              cursor: 'pointer',
                            }}
                          >
                            <DcIcon name="icon-x" size={14} />
                          </button>
                        </>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ padding: 14 }}>
            {selectedCat ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ flex: 1, minWidth: 140, font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                    {selectedCat.name}
                  </span>
                  {visibleProducts[0] ? (
                    <button
                      type="button"
                      onClick={() => selectProduct(visibleProducts[0]!.id)}
                      style={{
                        height: 30,
                        padding: '0 10px',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink-2)',
                        cursor: 'pointer',
                        font: `600 11.5px/1 ${FONT}`,
                      }}
                    >
                      Use first product
                    </button>
                  ) : null}
                </div>
                {categoryProducts.length > 0 ? (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setBrowseAll(false)}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 7,
                        border: `1px solid ${!browseAll ? 'var(--violet-bd)' : 'var(--line)'}`,
                        background: !browseAll ? 'var(--violet-soft)' : 'var(--surface-2)',
                        color: !browseAll ? 'var(--violet)' : 'var(--ink-2)',
                        font: `600 11.5px/1 ${FONT}`,
                        cursor: 'pointer',
                      }}
                    >
                      Tagged in {selectedCat.name} ({categoryProducts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBrowseAll(true)}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 7,
                        border: `1px solid ${browseAll ? 'var(--violet-bd)' : 'var(--line)'}`,
                        background: browseAll ? 'var(--violet-soft)' : 'var(--surface-2)',
                        color: browseAll ? 'var(--violet)' : 'var(--ink-2)',
                        font: `600 11.5px/1 ${FONT}`,
                        cursor: 'pointer',
                      }}
                    >
                      All catalog products ({products.length})
                    </button>
                  </div>
                ) : (
                  <p style={{ margin: '0 0 10px', font: `400 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
                    No products tagged to <strong>{selectedCat.name}</strong> yet. You can pick any published product below to use its photo for this homepage tile:
                  </p>
                )}
                {selectedProduct && categoryProducts.length > 0 && !categoryProducts.some((p) => p.id === selectedProduct.id) ? (
                  <p style={{ margin: '0 0 10px', font: `500 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
                    Tile photo is set from another product in the catalog.
                  </p>
                ) : null}
                <DcInput
                  placeholder="Search products or SKU…"
                  value={prodQuery}
                  onChange={(e) => setProdQuery(e.target.value)}
                  style={{ height: 34, marginBottom: 12, maxWidth: 320 }}
                />
                {selectedProduct ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '88px 1fr',
                      gap: 12,
                      alignItems: 'center',
                      marginBottom: 14,
                      padding: 10,
                      borderRadius: 12,
                      border: '1px solid var(--violet-bd)',
                      background: 'var(--violet-soft)',
                    }}
                  >
                    <span style={{ position: 'relative', display: 'block', aspectRatio: '4 / 5', borderRadius: 10, overflow: 'hidden', background: 'var(--surface-3)' }}>
                      {productThumb(selectedProduct) ? (
                        <Image
                          src={productThumb(selectedProduct)!}
                          alt=""
                          fill
                          sizes="88px"
                          unoptimized
                          style={{ objectFit: 'cover' }}
                        />
                      ) : null}
                    </span>
                    <span>
                      <span style={{ display: 'block', font: `600 13px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                        On homepage · {selectedProduct.name}
                      </span>
                      <span style={{ display: 'block', marginTop: 4, font: `500 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                        {formatTaka(Number(selectedProduct.basePrice) || 0)} · {variantStock(selectedProduct)} in stock
                      </span>
                    </span>
                  </div>
                ) : null}
                {visibleProducts.length === 0 ? (
                  <p style={{ margin: 0, font: `400 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
                    {candidateProducts.length === 0
                      ? 'No published products found in catalog.'
                      : 'No products match that search.'}
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
                      gap: 10,
                    }}
                  >
                    {visibleProducts.map((product) => {
                      const selected = activeTile?.productId === product.id
                      const thumb = productThumb(product)
                      const stock = variantStock(product)
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => selectProduct(product.id)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            padding: 0,
                            overflow: 'hidden',
                            borderRadius: 12,
                            border: `2px solid ${selected ? 'var(--violet)' : 'var(--line)'}`,
                            background: 'var(--surface-2)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            boxShadow: selected ? '0 0 0 3px var(--violet-soft)' : 'none',
                          }}
                        >
                          <span
                            style={{
                              position: 'relative',
                              display: 'block',
                              aspectRatio: '4 / 5',
                              background: 'var(--surface-3)',
                            }}
                          >
                            {thumb ? (
                              <Image
                                src={thumb}
                                alt=""
                                fill
                                sizes="160px"
                                unoptimized
                                style={{ objectFit: 'cover' }}
                              />
                            ) : null}
                            {selected ? (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: 8,
                                  left: 8,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '3px 8px',
                                  borderRadius: 99,
                                  background: 'var(--violet-solid)',
                                  color: 'var(--on-violet)',
                                  font: `600 10px/1 ${FONT}`,
                                }}
                              >
                                <DcIcon name="icon-check" size={11} />
                                Homepage
                              </span>
                            ) : null}
                            {stock < 5 ? (
                              <span
                                style={{
                                  position: 'absolute',
                                  right: 8,
                                  bottom: 8,
                                  padding: '3px 7px',
                                  borderRadius: 99,
                                  background: stock <= 0 ? 'var(--bad-soft)' : 'var(--warn-soft)',
                                  color: stock <= 0 ? 'var(--bad)' : 'var(--warn)',
                                  font: `600 10px/1 ${FONT}`,
                                }}
                              >
                                {stock <= 0 ? 'Out' : 'Low'}
                              </span>
                            ) : null}
                          </span>
                          <span style={{ padding: '8px 9px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span
                              style={{
                                font: `600 12px/1.3 ${FONT}`,
                                color: 'var(--ink)',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {product.name}
                            </span>
                            <span style={{ font: `600 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                              {formatTaka(Number(product.basePrice) || 0)}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <p style={{ margin: 0, font: `400 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
                Choose a category on the left.
              </p>
            )}
          </div>
        </div>
      )}

      {curated && deptTiles.length > 0 ? (
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--line)' }}>
          <span
            style={{
              display: 'block',
              marginBottom: 10,
              font: `600 10.5px/1 ${FONT}`,
              letterSpacing: '.09em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            {DEPT_LABEL[department]} rail · drag to reorder
          </span>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {deptTiles.map((tile) => {
              const cat = subcats.find((c) => c.slug === tile.categorySlug)
              const product = products.find((p) => p.id === tile.productId)
              const thumb = product ? productThumb(product) : null
              const over = dropSlug === tile.categorySlug
              return (
                <button
                  key={tile.id}
                  type="button"
                  draggable
                  onClick={() => setCategorySlug(tile.categorySlug)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TILE_DRAG, tile.categorySlug)
                    e.dataTransfer.effectAllowed = 'move'
                    setDropSlug(tile.categorySlug)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (dropSlug !== tile.categorySlug) setDropSlug(tile.categorySlug)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const from = e.dataTransfer.getData(TILE_DRAG)
                    if (from) dropOnCategory(from, tile.categorySlug)
                    else setDropSlug(null)
                  }}
                  onDragEnd={() => setDropSlug(null)}
                  style={{
                    flex: 'none',
                    width: 132,
                    padding: 0,
                    border: `2px solid ${over ? 'var(--violet)' : activeSlug === tile.categorySlug ? 'var(--violet-bd)' : 'var(--line)'}`,
                    borderRadius: 14,
                    overflow: 'hidden',
                    background: 'var(--surface-2)',
                    cursor: 'grab',
                    textAlign: 'left',
                    opacity: dropSlug && dropSlug !== tile.categorySlug && over ? 0.85 : 1,
                  }}
                >
                  <span style={{ display: 'block', aspectRatio: '4 / 5', background: 'var(--surface-3)', position: 'relative' }}>
                    {thumb ? (
                      <Image src={thumb} alt="" fill sizes="132px" unoptimized style={{ objectFit: 'cover' }} />
                    ) : null}
                    <span
                      style={{
                        position: 'absolute',
                        left: 8,
                        bottom: 8,
                        maxWidth: 'calc(100% - 16px)',
                        padding: '5px 10px',
                        borderRadius: 99,
                        background: 'color-mix(in srgb, var(--ink) 72%, transparent)',
                        color: 'var(--surface)',
                        font: `600 11px/1 ${FONT}`,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {cat?.name ?? tile.categorySlug}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

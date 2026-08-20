import { Injectable } from '@nestjs/common'
import { DEPARTMENT_SLUGS, departmentHref, LOCAL_EDITORIAL } from '@splaro/config'
import { buildCategoryTree, type CategoryTreeNode } from '../../common/category-tree.util'
import { PrismaService } from '../../common/prisma.service'
import { storefrontVisibleProductWhere } from '../../common/storefront-product.util'
import type {
  DepartmentMenuOverride,
  MegaMenuCategory,
  MegaMenuConfig,
  MegaMenuHero,
  MenuOverridesConfig,
  NavLink,
  StorefrontConfig,
} from './storefront-config'
import { ensureEssentialHeaderDepartments, isAlwaysOnMenuDepartment, shouldHideEmptyNavNode } from './storefront-config'

type CategoryRow = {
  id: string
  name: string
  slug: string
  parentId: string | null
  sortOrder: number
  isActive: boolean
  _count: { products: number }
}

const EDITORIAL_HEROES: Record<string, MegaMenuHero[]> = {
  men: [
    {
      label: 'New Arrivals',
      href: '/new-arrivals?dept=men',
      image: LOCAL_EDITORIAL.menNew,
    },
    {
      label: 'Best Sellers',
      href: '/best-sellers?dept=men',
      image: LOCAL_EDITORIAL.menBest,
    },
    {
      label: 'Panjabi',
      href: '/c/panjabi',
      image: LOCAL_EDITORIAL.menSummer,
    },
  ],
  women: [
    {
      label: 'New Arrivals',
      href: '/new-arrivals?dept=women',
      image: LOCAL_EDITORIAL.womenNew,
    },
    {
      label: 'Best Sellers',
      href: '/best-sellers?dept=women',
      image: LOCAL_EDITORIAL.womenBest,
    },
    {
      label: 'Sarees',
      href: '/c/sarees',
      image: LOCAL_EDITORIAL.womenPremium,
    },
  ],
  kids: [
    {
      label: 'Girls Wear',
      href: '/c/girls-wear',
      image: LOCAL_EDITORIAL.kidsDresses,
    },
    {
      label: 'Boys Wear',
      href: '/c/boys-wear',
      image: LOCAL_EDITORIAL.kidsPanjabi,
    },
    {
      label: 'Party Wear',
      href: '/c/kids-party-wear',
      image: LOCAL_EDITORIAL.kidsSchool,
    },
  ],
  footwear: [
    {
      label: 'Sneakers',
      href: '/c/sneakers',
      image: LOCAL_EDITORIAL.footwearSneakers,
    },
    {
      label: 'Sandals',
      href: '/c/sandals',
      image: LOCAL_EDITORIAL.footwearSandals,
    },
    {
      label: 'Shop all',
      href: '/c/footwear',
      image: LOCAL_EDITORIAL.footwearLoafers,
    },
  ],
}

function isBlankHeroImage(url: string | undefined): boolean {
  const value = url?.trim() ?? ''
  if (!value) return true
  // Placeholder only — keep real product photos (incl. Unsplash CDN) for dept megas
  return /placeholder-product|placehold\.co/i.test(value)
}

/** Shared homepage heroes — never use as a mega-menu card the owner did not upload. */
function isSharedHomepageHero(url: string | undefined): boolean {
  return /\/images\/hero\/(new-season|summer|women-collection)(-|_|\.)?/i.test(url?.trim() ?? '')
}

/** Normalize mislabeled mega-menu hero links (seed defaults pointed at department roots). */
function normalizeHeroHref(label: string, href: string, deptSlug: string): string {
  const clean = href.trim()
  const lower = label.trim().toLowerCase()
  if (lower === 'new arrivals' || lower === 'new arrival') {
    if (
      clean === `/c/${deptSlug}` ||
      clean === `/shop?dept=${deptSlug}` ||
      clean === `/c/${deptSlug}-new` ||
      clean.startsWith(`/c/${deptSlug}-new`)
    ) {
      return `/new-arrivals?dept=${deptSlug}`
    }
  }
  if (lower === 'best sellers' || lower === 'bestsellers' || lower === 'best seller') {
    if (
      clean === `/c/${deptSlug}` ||
      clean === `/shop?dept=${deptSlug}` ||
      clean === `/c/${deptSlug}-bestsellers` ||
      clean.startsWith(`/c/${deptSlug}-best`)
    ) {
      return `/best-sellers?dept=${deptSlug}`
    }
  }
  return clean
}

function collectCategoryIds(node: CategoryTreeNode<CategoryRow>): string[] {
  return [node.id, ...node.children.flatMap((child) => collectCategoryIds(child))]
}

function deptSlugFromHref(href: string): string | null {
  const match = href.match(/^\/(?:c|collections)\/([^/?#]+)/)
  if (match?.[1]) return match[1]
  const path = href.split(/[?#]/, 1)[0]?.replace(/\/$/, '')
  if (path === '/accessories') return 'accessories'
  if (path === '/new-arrivals') return 'new-arrivals'
  return null
}

function totalVisibleProducts(node: CategoryTreeNode<CategoryRow>): number {
  let count = node._count.products
  for (const child of node.children) count += totalVisibleProducts(child)
  return count
}

function sortByOrder<T extends { id: string }>(items: T[], order?: string[]): T[] {
  if (!order?.length) return items
  const rank = new Map(order.map((id, index) => [id, index]))
  return [...items].sort((a, b) => {
    const ar = rank.get(a.id)
    const br = rank.get(b.id)
    if (ar !== undefined && br !== undefined) return ar - br
    if (ar !== undefined) return -1
    if (br !== undefined) return 1
    return 0
  })
}

@Injectable()
export class NavBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async buildStorefrontNav(storeId: string, config: StorefrontConfig): Promise<NavLink[]> {
    const headerNav = ensureEssentialHeaderDepartments(config.headerNav)
    const overrides = config.menuOverrides ?? { autoSync: true, hideEmptyCategories: true }
    const hideEmpty = overrides.hideEmptyCategories !== false

    const flat = await this.prisma.category.findMany({
      where: { storeId, isActive: true },
      include: {
        _count: {
          select: {
            products: { where: storefrontVisibleProductWhere() },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const tree = buildCategoryTree(flat)
    const deptBySlug = new Map(tree.filter((n) => !n.parentId).map((n) => [n.slug, n]))
    const accessoriesCount = deptBySlug.get('accessories')
      ? totalVisibleProducts(deptBySlug.get('accessories')!)
      : 0

    const departments = (overrides.departments ?? []).map((d) => {
      if (d.departmentSlug !== 'accessories' || !d.hidden) return d
      if (shouldHideEmptyNavNode({ hideEmptyCategories: hideEmpty, forceVisible: d.forceVisible, productCount: accessoriesCount })) {
        return d
      }
      return { ...d, hidden: false, forceVisible: true }
    })

    return Promise.all(
      headerNav.map(async (item) => {
        const slug = deptSlugFromHref(item.href)
        if (!slug || !DEPARTMENT_SLUGS.includes(slug as (typeof DEPARTMENT_SLUGS)[number])) {
          return item
        }

        const deptOverride = departments.find((d) => d.departmentSlug === slug)
        if (deptOverride?.hidden) return { ...item, hidden: true }

        const deptNode = deptBySlug.get(slug)
        const productCount = deptNode ? totalVisibleProducts(deptNode) : 0
        const forceVisible = Boolean(deptOverride?.forceVisible) || isAlwaysOnMenuDepartment(slug)
        if (
          shouldHideEmptyNavNode({
            hideEmptyCategories: hideEmpty,
            forceVisible,
            productCount,
          })
        ) {
          return { ...item, hidden: true, megaMenu: undefined }
        }

        if (!deptNode) return item

        const megaMenu = await this.buildDepartmentMegaMenu(
          storeId,
          deptNode,
          deptOverride,
          overrides,
        )
        const hasCategories = megaMenu.categories.length > 0
        if (!hasCategories && !forceVisible) {
          return { ...item, megaMenu: undefined }
        }

        return { ...item, megaMenu }
      }),
    )
  }

  private async buildDepartmentMegaMenu(
    storeId: string,
    dept: CategoryTreeNode<CategoryRow>,
    override: DepartmentMenuOverride | undefined,
    menuOverrides: MenuOverridesConfig,
  ): Promise<MegaMenuConfig> {
    const hidden = new Set(override?.hiddenCategoryIds ?? [])
    const autoSync = menuOverrides.autoSync !== false
    const hideEmpty = menuOverrides.hideEmptyCategories !== false

    let columns = dept.children
      .filter((child) => child.isActive)
      .filter((child) => !hideEmpty || totalVisibleProducts(child) > 0)
      .filter((child) => !hidden.has(child.id))

    if (!autoSync && override?.pinnedCategoryIds?.length) {
      const pinned = new Set(override.pinnedCategoryIds)
      columns = columns.filter((c) => pinned.has(c.id))
    }

    columns = sortByOrder(columns, override?.categoryOrder)

    const categories: MegaMenuCategory[] = columns.map((col) => {
      const subs = col.children
        .filter((c) => c.isActive)
        .filter((c) => !hideEmpty || totalVisibleProducts(c) > 0)
        .filter((c) => !hidden.has(c.id))
        .map((c) => ({ label: c.name, href: departmentHref(c.slug) }))

      return {
        label: col.name,
        href: departmentHref(col.slug),
        ...(subs.length ? { subcategories: subs } : {}),
      }
    })

    const baseHeroes =
      override?.heroes?.filter((h) => h.label && h.href).slice(0, 3) ??
      EDITORIAL_HEROES[dept.slug]?.slice(0, 3) ??
      []

    const liveImages = await this.pickDepartmentProductImages(
      storeId,
      collectCategoryIds(dept),
      Math.max(baseHeroes.length, 3),
    )

    const usedImages = new Set<string>()
    const heroes: MegaMenuHero[] = []
    for (const [index, hero] of baseHeroes.entries()) {
      const configured =
        hero.image && !isBlankHeroImage(hero.image) && !isSharedHomepageHero(hero.image)
          ? hero.image
          : undefined
      const image = [liveImages[index], configured].find((url): url is string => {
        if (!url) return false
        if (usedImages.has(url)) return false
        if (isBlankHeroImage(url) || isSharedHomepageHero(url)) return false
        return true
      })
      if (!image) continue
      usedImages.add(image)
      heroes.push({
        ...hero,
        href: normalizeHeroHref(hero.label, hero.href, dept.slug),
        image,
      })
    }

    return { categories, heroes }
  }

  private async pickDepartmentProductImages(
    storeId: string,
    categoryIds: string[],
    limit: number,
  ): Promise<string[]> {
    if (!categoryIds.length || limit <= 0) return []

    const products = await this.prisma.product.findMany({
      where: storefrontVisibleProductWhere({
        storeId,
        categoryId: { in: categoryIds },
      }),
      select: {
        images: {
          orderBy: { position: 'asc' },
          take: 1,
          select: { url: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: Math.max(limit * 3, 8),
    })

    const urls: string[] = []
    for (const product of products) {
      const url = product.images[0]?.url?.trim()
      if (!url || isBlankHeroImage(url)) continue
      if (urls.includes(url)) continue
      urls.push(url)
      if (urls.length >= limit) break
    }
    return urls
  }
}

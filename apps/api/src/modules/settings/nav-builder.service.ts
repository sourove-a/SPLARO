import { Injectable } from '@nestjs/common'
import { DEPARTMENT_SLUGS, departmentHref } from '@splaro/config'
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
      image:
        'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=900&q=80&auto=format',
    },
    {
      label: 'Best Sellers',
      href: '/best-sellers?dept=men',
      image:
        'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=900&q=80&auto=format',
    },
    {
      label: 'Panjabi',
      href: '/c/panjabi',
      image:
        'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=900&q=80&auto=format',
    },
  ],
  women: [
    {
      label: 'New Arrivals',
      href: '/new-arrivals?dept=women',
      image:
        'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80&auto=format',
    },
    {
      label: 'Best Sellers',
      href: '/best-sellers?dept=women',
      image:
        'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=80&auto=format',
    },
    {
      label: 'Sarees',
      href: '/c/sarees',
      image:
        'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&q=80&auto=format',
    },
  ],
  kids: [
    {
      label: 'Girls Wear',
      href: '/c/girls-wear',
      image:
        'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=900&q=80&auto=format',
    },
    {
      label: 'Boys Wear',
      href: '/c/boys-wear',
      image:
        'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=900&q=80&auto=format',
    },
    {
      label: 'Party Wear',
      href: '/c/kids-party-wear',
      image:
        'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=900&q=80&auto=format',
    },
  ],
  footwear: [
    {
      label: 'Sneakers',
      href: '/c/sneakers',
      image:
        'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=900&q=80&auto=format',
    },
    {
      label: 'Sandals',
      href: '/c/sandals',
      image:
        'https://images.unsplash.com/photo-1562273138-f46be4ebdf33?w=900&q=80&auto=format',
    },
    {
      label: 'Shop all',
      href: '/c/footwear',
      image:
        'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=900&q=80&auto=format',
    },
  ],
}

function isBlankHeroImage(url: string | undefined): boolean {
  const value = url?.trim() ?? ''
  if (!value) return true
  return /placeholder-product|placehold\.co/i.test(value)
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
  return match?.[1] ?? null
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
    const headerNav = config.headerNav ?? []
    const overrides = config.menuOverrides ?? { autoSync: true }

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

    return Promise.all(
      headerNav.map(async (item) => {
        const slug = deptSlugFromHref(item.href)
        if (!slug || !DEPARTMENT_SLUGS.includes(slug as (typeof DEPARTMENT_SLUGS)[number])) {
          return item
        }

        const deptOverride = overrides.departments?.find((d) => d.departmentSlug === slug)
        if (deptOverride?.hidden) return { ...item, hidden: true }

        const deptNode = deptBySlug.get(slug)
        if (!deptNode) return item

        const megaMenu = await this.buildDepartmentMegaMenu(
          storeId,
          deptNode,
          deptOverride,
          overrides,
        )
        const hasCategories = megaMenu.categories.length > 0
        if (!hasCategories && !deptOverride?.forceVisible) {
          return { ...item, megaMenu: undefined }
        }

        return { ...item, href: departmentHref(slug), megaMenu }
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

    let columns = dept.children
      .filter((child) => child.isActive && totalVisibleProducts(child) > 0)
      .filter((child) => !hidden.has(child.id))

    if (!autoSync && override?.pinnedCategoryIds?.length) {
      const pinned = new Set(override.pinnedCategoryIds)
      columns = columns.filter((c) => pinned.has(c.id))
    }

    columns = sortByOrder(columns, override?.categoryOrder)

    const categories: MegaMenuCategory[] = columns.map((col) => {
      const subs = col.children
        .filter((c) => c.isActive && totalVisibleProducts(c) > 0)
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

    const heroes: MegaMenuHero[] = baseHeroes.map((hero, index) => ({
      ...hero,
      href: normalizeHeroHref(hero.label, hero.href, dept.slug),
      image:
        (!isBlankHeroImage(hero.image) ? hero.image : undefined) ||
        liveImages[index] ||
        EDITORIAL_HEROES[dept.slug]?.[index]?.image ||
        liveImages[0] ||
        '',
    })).filter((hero) => Boolean(hero.image))

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

/**
 * Category picker for the product form: department menu → category → optional
 * third level.
 *
 * The rule that matters: **every category the operator can see on the
 * Categories screen must be reachable here.** A category created in the
 * dashboard used to vanish from the product form whenever it did not match the
 * hard-coded department list, which made "create a category, then tag a
 * product with it" impossible. Structure now decides: a root category is a
 * menu, its children are the categories under it. The keyword lists survive
 * only as a fallback that files a loose, childless root (a legacy store where
 * "Saree" sits at the top level) under the department it obviously belongs to.
 */

export const DEPARTMENT_SLUGS = [
  'women',
  'men',
  'kids',
  'footwear',
  'accessories',
  'new-arrivals',
] as const

export type DepartmentSlug = (typeof DEPARTMENT_SLUGS)[number]

export interface CategoryPickerRow {
  id: string
  name: string
  slug: string
  parentId?: string | null
  isActive?: boolean
  sortOrder?: number
  children?: CategoryPickerRow[]
}

const WOMEN_KEYWORDS = [
  'saree',
  'ethnic',
  'bridal',
  'kurti',
  'kurta',
  'dress',
  'legging',
  'denim',
  'western',
  'blouse',
  'tops',
  'women',
  'woman',
  'lehenga',
  'shalwar',
  'hijab',
  'abaya',
]

const MEN_KEYWORDS = [
  'panjabi',
  'polo',
  'formal',
  'men',
  'man',
  'shirt',
  'pant',
  'trouser',
]

const KIDS_KEYWORDS = [
  'kid',
  'baby',
  'child',
  'girl',
  'boy',
  'toddler',
  'infant',
  'ghagra',
  'choli',
  'frock',
  'school',
  'newborn',
]

const FOOTWEAR_KEYWORDS = ['foot', 'shoe', 'sandal', 'sneaker', 'boot', 'loafer', 'heel']

const ACCESSORY_KEYWORDS = [
  'accessor',
  'glass',
  'watch',
  'bag',
  'handbag',
  'jewel',
  'wallet',
  'scarf',
  'belt',
  'clutch',
  'cap',
  'hat',
  'cardholder',
  'decor',
]

function isMenuDepartment(cat: CategoryPickerRow): boolean {
  if (cat.parentId) return false
  if (DEPARTMENT_SLUGS.includes(cat.slug as DepartmentSlug)) return true
  const n = cat.name.toLowerCase().trim()
  return (
    n === 'women' ||
    n === 'men' ||
    n === 'kids' ||
    n === 'footwear' ||
    n === 'accessories' ||
    n === 'new arrivals'
  )
}

function sortCats(a: CategoryPickerRow, b: CategoryPickerRow) {
  const aKnown = isMenuDepartment(a)
  const bKnown = isMenuDepartment(b)
  if (aKnown && !bKnown) return -1
  if (!aKnown && bKnown) return 1
  if (aKnown && bKnown) {
    const order =
      (DEPARTMENT_SLUGS as readonly string[]).indexOf(a.slug) -
      (DEPARTMENT_SLUGS as readonly string[]).indexOf(b.slug)
    if (order !== 0) return order
  }
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
}

function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k))
}

/** Best-guess department for a top-level category that isn't a department itself. */
function inferredDepartmentSlug(cat: CategoryPickerRow): DepartmentSlug | null {
  const slug = cat.slug.toLowerCase()
  const name = cat.name.toLowerCase()

  // Women before men — "women" contains "men"
  if (slug === 'women' || name === 'women' || hasKeyword(slug, WOMEN_KEYWORDS) || hasKeyword(name, WOMEN_KEYWORDS)) {
    return 'women'
  }
  if (hasKeyword(slug, KIDS_KEYWORDS) || hasKeyword(name, KIDS_KEYWORDS)) return 'kids'
  if (hasKeyword(slug, FOOTWEAR_KEYWORDS) || hasKeyword(name, FOOTWEAR_KEYWORDS)) return 'footwear'
  if (hasKeyword(slug, ACCESSORY_KEYWORDS) || hasKeyword(name, ACCESSORY_KEYWORDS)) return 'accessories'
  if (slug === 'men' || name === 'men' || hasKeyword(slug, MEN_KEYWORDS) || hasKeyword(name, MEN_KEYWORDS)) {
    return 'men'
  }
  if (slug.includes('new') || name.includes('arrival')) return 'new-arrivals'

  return null
}

interface CategoryIndex {
  rows: Map<string, CategoryPickerRow>
  parentOf: Map<string, string | null>
  childrenOf: Map<string, CategoryPickerRow[]>
  roots: CategoryPickerRow[]
}

/**
 * One index over both shapes the API returns (flat list + nested tree). Rows
 * present in only one of them still land in the index, and a row whose parent
 * is missing or hidden is promoted to a root rather than dropped — an
 * unreachable category is worse than a misplaced one.
 */
function indexCategories(
  categories: CategoryPickerRow[],
  treeRoots?: CategoryPickerRow[],
  keepIds?: Set<string>,
): CategoryIndex {
  const rows = new Map<string, CategoryPickerRow>()
  const parentOf = new Map<string, string | null>()
  const include = (row: CategoryPickerRow) => row.isActive !== false || keepIds?.has(row.id) === true

  const visit = (nodes: CategoryPickerRow[] | undefined, parentId: string | null) => {
    for (const node of nodes ?? []) {
      // A hidden branch is walked anyway: a product already filed inside it
      // must still show its own category, or the form silently reassigns it.
      visit(node.children, node.id)
      if (!include(node)) continue
      rows.set(node.id, node)
      parentOf.set(node.id, parentId)
    }
  }
  visit(treeRoots, null)

  for (const row of categories) {
    if (!include(row)) continue
    if (!rows.has(row.id)) rows.set(row.id, row)
    if (!parentOf.has(row.id)) parentOf.set(row.id, row.parentId ?? null)
  }

  const childrenOf = new Map<string, CategoryPickerRow[]>()
  const roots: CategoryPickerRow[] = []
  for (const [id, row] of rows) {
    const parentId = parentOf.get(id) ?? null
    if (parentId && rows.has(parentId)) {
      const siblings = childrenOf.get(parentId)
      if (siblings) siblings.push(row)
      else childrenOf.set(parentId, [row])
    } else {
      roots.push(row)
    }
  }

  for (const siblings of childrenOf.values()) siblings.sort(sortCats)
  roots.sort(sortCats)

  return { rows, parentOf, childrenOf, roots }
}

export function buildCategoryPicker(
  categories: CategoryPickerRow[],
  treeRoots?: CategoryPickerRow[],
  options?: {
    /** Categories to keep even when hidden — the one a product already carries. */
    keepIds?: (string | null | undefined)[]
  },
) {
  const keepIds = new Set((options?.keepIds ?? []).filter(Boolean) as string[])
  const index = indexCategories(categories, treeRoots, keepIds)
  const { rows, parentOf, childrenOf, roots } = index

  const knownDeptRoots = roots.filter(isMenuDepartment)
  const knownDeptBySlug = new Map<string, CategoryPickerRow>()
  for (const dept of knownDeptRoots) {
    const slug = DEPARTMENT_SLUGS.includes(dept.slug as DepartmentSlug)
      ? dept.slug
      : dept.name.toLowerCase().trim().replace(/\s+/g, '-')
    if (!knownDeptBySlug.has(slug)) knownDeptBySlug.set(slug, dept)
  }

  /**
   * Legacy stores keep department-less categories at the top level ("Saree"
   * next to "Women"). Those are filed under the department their name implies
   * so the menu stays short; anything else keeps its own menu tile.
   */
  const looseByDept = new Map<string, CategoryPickerRow[]>()
  for (const root of roots) {
    if (isMenuDepartment(root)) continue
    if ((childrenOf.get(root.id)?.length ?? 0) > 0) continue
    const slug = inferredDepartmentSlug(root)
    if (!slug) continue
    const dept = knownDeptBySlug.get(slug)
    if (!dept || dept.id === root.id) continue
    const siblings = looseByDept.get(dept.id)
    if (siblings) siblings.push(root)
    else looseByDept.set(dept.id, [root])
  }
  const looseIds = new Set(
    [...looseByDept.values()].flatMap((list) => list.map((row) => row.id)),
  )

  // Every root is a menu, minus the loose ones now shown inside a department.
  const departments = roots.filter((root) => !looseIds.has(root.id))
  const deptIds = new Set(departments.map((d) => d.id))
  const deptById = new Map(departments.map((d) => [d.id, d]))

  function childrenOfCategory(parentId: string): CategoryPickerRow[] {
    return childrenOf.get(parentId) ?? []
  }

  function subcategoriesForDepartment(deptId: string): CategoryPickerRow[] {
    const dept = rows.get(deptId)
    if (!dept) return []

    const seen = new Set<string>()
    const list: CategoryPickerRow[] = []
    for (const row of [...childrenOfCategory(deptId), ...(looseByDept.get(deptId) ?? [])]) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      list.push(row)
    }
    // A menu with nothing under it is still a valid home for a product.
    if (list.length === 0) return [dept]
    return list.sort(sortCats)
  }

  /** Walk up to the root, then map that root onto the menu that renders it. */
  function departmentForCategory(categoryId: string): string {
    if (!rows.has(categoryId)) return ''

    let current: string | null = categoryId
    const guard = new Set<string>()
    while (current && !guard.has(current)) {
      guard.add(current)
      if (deptIds.has(current)) return current
      const parentId: string | null = parentOf.get(current) ?? null
      if (!parentId || !rows.has(parentId)) break
      current = parentId
    }

    // Loose root filed under a department by name, or a row whose parent is gone.
    const rootId = current ?? categoryId
    for (const [deptId, list] of looseByDept) {
      if (list.some((row) => row.id === rootId)) return deptId
    }
    const row = rows.get(rootId)
    const slug = row ? inferredDepartmentSlug(row) : null
    if (slug) return knownDeptBySlug.get(slug)?.id ?? ''
    return ''
  }

  return {
    departments,
    subcategoriesForDepartment,
    departmentForCategory,
    childrenOf: childrenOfCategory,
    deptIds,
    deptById,
  }
}

/**
 * Storefront menus read faster with their own icon — every tile carrying the
 * same generic glyph made the menu row scan as one undifferentiated block.
 * Returns a `DcIcon` name; "women" is tested before "men" so it wins the
 * substring match.
 */
export function menuIconFor(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('women') || n.includes('girl')) return 'icon-gem'
  if (n.includes('men') || n.includes('boy')) return 'icon-shirt'
  if (n.includes('kid') || n.includes('child') || n.includes('baby')) return 'icon-baby'
  if (n.includes('footwear') || n.includes('shoe') || n.includes('sneaker')) return 'icon-footprints'
  if (n.includes('accessor') || n.includes('bag') || n.includes('watch')) return 'icon-watch'
  if (n.includes('new') || n.includes('arrival')) return 'icon-sparkles'
  return 'icon-layers'
}

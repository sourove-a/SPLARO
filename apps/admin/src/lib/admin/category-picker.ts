/** Two-step category picker: department menu → filtered subcategory. */

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
  const order =
    (DEPARTMENT_SLUGS as readonly string[]).indexOf(a.slug) -
    (DEPARTMENT_SLUGS as readonly string[]).indexOf(b.slug)
  if (order !== 0) return order
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
}

function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k))
}

function departmentSlugForCategory(
  cat: CategoryPickerRow,
  deptById: Map<string, CategoryPickerRow>,
): DepartmentSlug | null {
  if (cat.parentId) {
    const parentRow = deptById.get(cat.parentId)
    if (parentRow && DEPARTMENT_SLUGS.includes(parentRow.slug as DepartmentSlug)) {
      return parentRow.slug as DepartmentSlug
    }
  }

  if (isMenuDepartment(cat)) {
    if (DEPARTMENT_SLUGS.includes(cat.slug as DepartmentSlug)) return cat.slug as DepartmentSlug
    return null
  }

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

export function buildCategoryPicker(categories: CategoryPickerRow[]) {
  const active = categories.filter((c) => c.isActive !== false)

  const departments = active.filter((c) => isMenuDepartment(c)).sort(sortCats)

  const deptBySlug = new Map(departments.map((d) => [d.slug, d]))
  const deptById = new Map(departments.map((d) => [d.id, d]))
  const deptIds = new Set(departments.map((d) => d.id))

  function subcategoriesForDepartment(deptId: string): CategoryPickerRow[] {
    const dept = active.find((c) => c.id === deptId)
    if (!dept) return []

    const deptSlug = dept.slug as DepartmentSlug

    const children = active.filter((c) => c.parentId === deptId).sort(sortCats)
    if (children.length) return children

    const inferred = active
      .filter((c) => {
        if (c.id === deptId) return false
        if (isMenuDepartment(c)) return false
        return departmentSlugForCategory(c, deptById) === deptSlug
      })
      .sort(sortCats)

    if (inferred.length) return inferred

    return [dept]
  }

  function departmentForCategory(categoryId: string): string {
    const cat = active.find((c) => c.id === categoryId)
    if (!cat) return ''
    if (deptIds.has(cat.id)) return cat.id
    if (cat.parentId && deptIds.has(cat.parentId)) return cat.parentId

    const slug = departmentSlugForCategory(cat, deptById)
    if (slug) return deptBySlug.get(slug)?.id ?? ''

    return ''
  }

  /** Plain direct children of any category (used for a 3rd cascade level, e.g. Kids → Girls Wear → Frocks). */
  function childrenOf(parentId: string): CategoryPickerRow[] {
    return active.filter((c) => c.parentId === parentId).sort(sortCats)
  }

  return { departments, subcategoriesForDepartment, departmentForCategory, childrenOf, deptIds, deptById }
}

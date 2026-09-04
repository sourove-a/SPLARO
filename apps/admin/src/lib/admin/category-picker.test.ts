import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildCategoryPicker, type CategoryPickerRow } from './category-picker'

function tree(rows: CategoryPickerRow[]): CategoryPickerRow[] {
  const nodes = new Map(rows.map((row) => [row.id, { ...row, children: [] as CategoryPickerRow[] }]))
  const roots: CategoryPickerRow[] = []
  for (const row of rows) {
    const node = nodes.get(row.id)!
    if (row.parentId && nodes.has(row.parentId)) nodes.get(row.parentId)!.children!.push(node)
    else roots.push(node)
  }
  return roots
}

const WOMEN: CategoryPickerRow = { id: 'women', name: 'Women', slug: 'women', parentId: null }
const MEN: CategoryPickerRow = { id: 'men', name: 'Men', slug: 'men', parentId: null }

describe('buildCategoryPicker', () => {
  it('lists a freshly created child under its department', () => {
    const rows = [WOMEN, { id: 'kameez', name: 'Kameez', slug: 'kameez', parentId: 'women' }]
    const picker = buildCategoryPicker(rows, tree(rows))

    assert.deepEqual(
      picker.subcategoriesForDepartment('women').map((c) => c.slug),
      ['kameez'],
    )
    assert.equal(picker.departmentForCategory('kameez'), 'women')
  })

  it('gives a freshly created top-level category its own menu', () => {
    const rows = [
      WOMEN,
      { id: 'gift', name: 'Gift Hampers', slug: 'gift-hampers', parentId: null },
      { id: 'kameez', name: 'Kameez', slug: 'kameez', parentId: 'women' },
    ]
    const picker = buildCategoryPicker(rows, tree(rows))

    assert.ok(picker.departments.some((d) => d.id === 'gift'))
    // Nothing under it yet — the menu itself is the category you can tag.
    assert.deepEqual(
      picker.subcategoriesForDepartment('gift').map((c) => c.id),
      ['gift'],
    )
    assert.equal(picker.departmentForCategory('gift'), 'gift')
  })

  it('keeps a new department reachable together with its children', () => {
    const rows = [
      MEN,
      { id: 'home', name: 'Home Living', slug: 'home-living', parentId: null },
      { id: 'bedding', name: 'Bedding', slug: 'bedding', parentId: 'home' },
    ]
    const picker = buildCategoryPicker(rows, tree(rows))

    assert.ok(picker.departments.some((d) => d.id === 'home'))
    assert.deepEqual(
      picker.subcategoriesForDepartment('home').map((c) => c.id),
      ['bedding'],
    )
    assert.equal(picker.departmentForCategory('bedding'), 'home')
  })

  it('still files a loose legacy top-level category under its department', () => {
    const rows = [
      WOMEN,
      { id: 'saree', name: 'Saree', slug: 'sarees', parentId: null },
      { id: 'kameez', name: 'Kameez', slug: 'kameez', parentId: 'women' },
    ]
    const picker = buildCategoryPicker(rows, tree(rows))

    // Not a menu of its own — it belongs to Women, and it shows there even
    // though Women already has real children.
    assert.equal(picker.departments.some((d) => d.id === 'saree'), false)
    assert.deepEqual(
      picker.subcategoriesForDepartment('women').map((c) => c.id).sort(),
      ['kameez', 'saree'],
    )
    assert.equal(picker.departmentForCategory('saree'), 'women')
  })

  it('resolves a third-level category to its department', () => {
    const rows = [
      { id: 'kids', name: 'Kids', slug: 'kids', parentId: null },
      { id: 'girls', name: 'Girls Wear', slug: 'girls-wear', parentId: 'kids' },
      { id: 'frock', name: 'Frocks', slug: 'frocks', parentId: 'girls' },
    ]
    const picker = buildCategoryPicker(rows, tree(rows))

    assert.deepEqual(
      picker.childrenOf('girls').map((c) => c.id),
      ['frock'],
    )
    assert.equal(picker.departmentForCategory('frock'), 'kids')
  })

  it('promotes a category whose parent is hidden instead of dropping it', () => {
    const rows: CategoryPickerRow[] = [
      { id: 'archive', name: 'Archive', slug: 'archive', parentId: null, isActive: false },
      { id: 'vintage', name: 'Vintage', slug: 'vintage', parentId: 'archive' },
    ]
    const picker = buildCategoryPicker(rows, tree(rows))

    assert.deepEqual(
      picker.departments.map((d) => d.id),
      ['vintage'],
    )
  })

  it('works from the flat list alone when the tree is missing', () => {
    const rows = [WOMEN, { id: 'kameez', name: 'Kameez', slug: 'kameez', parentId: 'women' }]
    const picker = buildCategoryPicker(rows)

    assert.deepEqual(
      picker.subcategoriesForDepartment('women').map((c) => c.id),
      ['kameez'],
    )
  })

  it('orders the known departments first', () => {
    const rows = [
      { id: 'gift', name: 'Gift Hampers', slug: 'gift-hampers', parentId: null, sortOrder: 0 },
      { id: 'men', name: 'Men', slug: 'men', parentId: null, sortOrder: 9 },
      { id: 'women', name: 'Women', slug: 'women', parentId: null, sortOrder: 8 },
    ]
    const picker = buildCategoryPicker(rows, tree(rows))

    assert.deepEqual(
      picker.departments.map((d) => d.id),
      ['women', 'men', 'gift'],
    )
  })

  it('hides an inactive category', () => {
    const rows: CategoryPickerRow[] = [
      WOMEN,
      { id: 'kameez', name: 'Kameez', slug: 'kameez', parentId: 'women' },
      { id: 'retired', name: 'Retired', slug: 'retired', parentId: 'women', isActive: false },
    ]
    const picker = buildCategoryPicker(rows, tree(rows))

    assert.deepEqual(
      picker.subcategoriesForDepartment('women').map((c) => c.id),
      ['kameez'],
    )
  })

  it('keeps a hidden category the product is already filed under', () => {
    const rows: CategoryPickerRow[] = [
      WOMEN,
      { id: 'kameez', name: 'Kameez', slug: 'kameez', parentId: 'women' },
      { id: 'retired', name: 'Retired', slug: 'retired', parentId: 'women', isActive: false },
    ]
    const picker = buildCategoryPicker(rows, tree(rows), { keepIds: ['retired'] })

    assert.deepEqual(
      picker.subcategoriesForDepartment('women').map((c) => c.id).sort(),
      ['kameez', 'retired'],
    )
    assert.equal(picker.departmentForCategory('retired'), 'women')
  })

  it('keeps a product filed deep inside a hidden branch reachable', () => {
    const rows: CategoryPickerRow[] = [
      WOMEN,
      { id: 'archive', name: 'Archive', slug: 'archive', parentId: 'women', isActive: false },
      { id: 'vintage', name: 'Vintage', slug: 'vintage', parentId: 'archive' },
    ]
    const picker = buildCategoryPicker(rows, tree(rows), { keepIds: ['vintage'] })

    // Its hidden parent is gone, so it stands on its own rather than vanishing.
    assert.ok(picker.departments.some((d) => d.id === 'vintage'))
  })

  it('includes all descendants in allSubcategoriesForDepartment', () => {
    const rows: CategoryPickerRow[] = [
      { id: 'footwear', name: 'Footwear', slug: 'footwear', parentId: null },
      { id: 'shoes', name: 'Shoes', slug: 'shoes', parentId: 'footwear' },
      { id: 'sneakers', name: 'Sneakers', slug: 'sneakers', parentId: 'shoes' },
      { id: 'loafers', name: 'Loafers', slug: 'loafers', parentId: 'shoes' },
    ]
    const picker = buildCategoryPicker(rows, tree(rows))

    const all = picker.allSubcategoriesForDepartment('footwear').map((c) => c.id)
    assert.ok(all.includes('shoes'))
    assert.ok(all.includes('sneakers'))
    assert.ok(all.includes('loafers'))
  })

  it('resolves flexible department names like Footwear or Mens', () => {
    const rows: CategoryPickerRow[] = [
      { id: 'fw', name: "Men's Footwear", slug: 'footwear-men', parentId: null },
      { id: 'boots', name: 'Boots', slug: 'boots', parentId: 'fw' },
    ]
    const picker = buildCategoryPicker(rows, tree(rows))
    assert.ok(picker.departments.some((d) => d.id === 'fw'))
    const subs = picker.allSubcategoriesForDepartment('fw').map((c) => c.id)
    assert.deepEqual(subs, ['boots'])
  })
})

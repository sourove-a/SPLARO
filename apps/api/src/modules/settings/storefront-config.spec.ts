import {
  ensureEssentialHeaderDepartments,
  mergeHeaderNav,
  mergeStorefrontConfig,
} from './storefront-config'

describe('storefront header navigation', () => {
  it('keeps admin order, removals, and visibility exactly', () => {
    const current = [
      {
        label: 'Kids',
        href: '/c/kids',
        megaMenu: { categories: [{ label: 'Fixture', href: '/fixture' }], heroes: [] },
      },
      { label: 'Shop', href: '/shop' },
    ]
    const incoming = [
      { label: 'Journal', href: '/editorial', hidden: true },
      { label: 'Shop all', href: '/shop' },
    ]

    expect(mergeHeaderNav(current, incoming)).toEqual(incoming)
  })

  it('does not restore removed default links while merging stored settings', () => {
    const config = mergeStorefrontConfig({
      headerNav: [{ label: 'Only shop', href: '/shop' }],
    })

    expect(config.headerNav).toEqual([{ label: 'Only shop', href: '/shop' }])
  })

  it('heal-on-read re-injects Accessories after Footwear', () => {
    const healed = ensureEssentialHeaderDepartments([
      { label: 'Shop', href: '/shop' },
      { label: 'Men', href: '/collections/men' },
      { label: 'Footwear', href: '/collections/footwear' },
    ])
    const accessoriesIdx = healed.findIndex((l) => l.href === '/accessories')
    const footwearIdx = healed.findIndex((l) => /footwear/i.test(l.href) || l.label === 'Footwear')
    expect(accessoriesIdx).toBeGreaterThan(-1)
    expect(accessoriesIdx).toBe(footwearIdx + 1)
    expect(healed[accessoriesIdx]?.label).toBe('Accessories')
  })

  it('heal-on-read unhides Accessories and accepts /c/accessories alias', () => {
    const healed = ensureEssentialHeaderDepartments([
      { label: 'Shop', href: '/shop' },
      { label: 'Accessories', href: '/c/accessories', hidden: true },
    ])
    const acc = healed.find((l) => l.label === 'Accessories')
    expect(acc?.hidden).toBeUndefined()
    expect(acc?.href).toBe('/accessories')
  })
})

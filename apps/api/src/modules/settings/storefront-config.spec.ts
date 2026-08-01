import { mergeHeaderNav, mergeStorefrontConfig } from './storefront-config'

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
})

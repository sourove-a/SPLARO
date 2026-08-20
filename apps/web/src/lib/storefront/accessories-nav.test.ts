import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { healAccessoriesHeaderNav } from './accessories-nav.ts'

describe('healAccessoriesHeaderNav', () => {
  it('does not unhide Accessories or invent empty mega columns', () => {
    const nav = [
      { label: 'Footwear', href: '/c/footwear' },
      { label: 'Accessories', href: '/accessories', hidden: true },
    ]
    assert.deepEqual(healAccessoriesHeaderNav(nav), nav)
  })

  it('does not refill an empty mega menu with hardcoded categories', () => {
    const nav = [
      {
        label: 'Accessories',
        href: '/accessories',
        megaMenu: { categories: [], heroes: [] },
      },
    ]
    assert.deepEqual(healAccessoriesHeaderNav(nav), nav)
  })

  it('canonicalizes /c/accessories without adding fake categories', () => {
    const healed = healAccessoriesHeaderNav([
      { label: 'Accessories', href: '/c/accessories' },
    ])
    assert.equal(healed[0]?.href, '/accessories')
    assert.equal(healed[0]?.megaMenu, undefined)
  })

  it('strips invented /accessories?cat= mega columns', () => {
    const healed = healAccessoriesHeaderNav([
      {
        label: 'Accessories',
        href: '/accessories',
        megaMenu: {
          categories: [
            { label: 'Glasses', href: '/accessories?cat=glasses' },
            { label: 'Bags', href: '/accessories?cat=bags' },
          ],
        },
      },
    ])
    assert.equal(healed[0]?.megaMenu, undefined)
  })

  it('keeps live /c/ category mega columns', () => {
    const nav = [
      {
        label: 'Accessories',
        href: '/accessories',
        megaMenu: {
          categories: [{ label: 'Glasses', href: '/c/glasses' }],
        },
      },
    ]
    assert.deepEqual(healAccessoriesHeaderNav(nav), nav)
  })
})

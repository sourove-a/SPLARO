import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  META_CATALOG_COMMENT_LINE,
  META_CATALOG_HEADERS,
  buildFacebookCatalogCsvFromStorefront,
  resolveFacebookImageUrl,
  storefrontProductToMetaCatalogRow,
} from './facebook-catalog-feed'
import type { StorefrontProduct } from '@/data/storefront'

const sampleStorefrontProduct: StorefrontProduct = {
  id: 'prod-456',
  name: 'Onitsuka Tiger Mexico 66 - White/Blue',
  code: '223-0005-01',
  slug: 'onitsuka-tiger-mexico-66-white-blue',
  category: 'Footwear',
  categorySlug: 'footwear',
  categoryName: 'Footwear',
  price: 4200,
  compareAtPrice: 4800,
  image: '/uploads/media/tiger-main.webp',
  hoverImage: '/uploads/media/tiger-hover.webp',
  colors: ['White', 'Blue'],
  sizes: ['40', '41', '42'],
  status: 'Ready',
  inStock: true,
  stockUnits: 15,
  brand: { id: 'b-2', name: 'Onitsuka Tiger', slug: 'onitsuka-tiger' },
}

describe('facebook-catalog-feed', () => {
  it('has 31 required Meta Commerce Manager headers', () => {
    assert.equal(META_CATALOG_HEADERS.length, 31)
  })

  it('generates a row with exactly 31 columns matching the headers', () => {
    const row = storefrontProductToMetaCatalogRow(sampleStorefrontProduct)
    assert.equal(row.length, META_CATALOG_HEADERS.length)
    assert.equal(row[0], 'prod-456')
    assert.equal(row[1], 'Onitsuka Tiger Mexico 66 - White/Blue')
    assert.equal(row[3], 'in stock')
    assert.equal(row[4], 'new')
    assert.equal(
      row[5],
      'https://splaro.co/products/onitsuka-tiger-mexico-66-white-blue',
    )
    assert.equal(row[6], 'https://splaro.co/uploads/media/tiger-main.webp')
    assert.equal(row[7], 'Onitsuka Tiger')
    assert.equal(row[8], '4800.00 BDT')
    assert.equal(row[9], 'Apparel & Accessories > Shoes')
    assert.equal(row[10], 'Clothing & Accessories > Shoes')
    assert.equal(row[11], '15')
    assert.equal(row[12], '4200.00 BDT')
    assert.equal(row[21], 'BD::Standard:0.00 BDT')
  })

  it('resolves relative image url to splaro.co production origin', () => {
    assert.equal(
      resolveFacebookImageUrl('/uploads/shoe.webp'),
      'https://splaro.co/uploads/shoe.webp',
    )
    assert.equal(
      resolveFacebookImageUrl('http://localhost:3000/uploads/shoe.webp'),
      'https://splaro.co/uploads/shoe.webp',
    )
  })

  it('builds full CSV starting with official comment line and header row', () => {
    const csv = buildFacebookCatalogCsvFromStorefront([sampleStorefrontProduct])
    const lines = csv.split('\r\n')
    assert.ok(lines.length >= 3)
    assert.equal(lines[0], META_CATALOG_COMMENT_LINE)
    assert.equal(lines[1], META_CATALOG_HEADERS.join(','))
    const row = lines[2] || ''
    assert.ok(row.includes('prod-456'))
    assert.ok(row.includes('https://splaro.co/uploads/media/tiger-main.webp'))
    assert.ok(row.includes('4200.00 BDT'))
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  META_CATALOG_HEADERS,
  META_CATALOG_COMMENT_LINE,
  buildFacebookCatalogCsv,
  productToMetaCatalogRow,
  resolveFacebookImageUrl,
} from './facebook-catalog-export'
import type { ApiProduct } from '@/lib/api/products'

const sampleProduct: ApiProduct = {
  id: 'prod-123',
  name: 'Louis Vuitton LV Trainer Sneaker - Black/White',
  slug: 'louis-vuitton-lv-trainer-sneaker-black-white',
  description: 'Premium calf leather sneaker with monogram denim.',
  basePrice: '4600',
  compareAtPrice: '5100',
  isPublished: true,
  status: 'published',
  category: { id: 'cat-1', name: 'Fashion', slug: 'fashion' },
  brand: { id: 'b-1', name: 'Louis Vuitton', slug: 'louis-vuitton' },
  images: [
    { url: '/uploads/media/first-main.webp', position: 0, isDefault: true },
    { url: '/uploads/media/second-angle.webp', position: 1, isDefault: false },
    { url: '/uploads/media/third-angle.webp', position: 2, isDefault: false },
  ],
  variants: [
    {
      id: 'var-1',
      sku: '223-0004-01-40',
      size: '40',
      colorName: 'Black',
      stockQuantity: 10,
    },
    {
      id: 'var-2',
      sku: '223-0004-01-41',
      size: '41',
      colorName: 'Black',
      stockQuantity: 5,
    },
  ],
  tags: ['LV Sneaker', 'Footwear'],
  fitType: 'Regular',
  fabricContent: 'Leather & Denim',
  weight: 900,
}

describe('facebook-catalog-export', () => {
  it('has 31 required Meta Commerce Manager headers', () => {
    assert.equal(META_CATALOG_HEADERS.length, 31)
    assert.equal(META_CATALOG_HEADERS[0], 'id')
    assert.equal(META_CATALOG_HEADERS[1], 'title')
    assert.equal(META_CATALOG_HEADERS[5], 'link')
    assert.equal(META_CATALOG_HEADERS[6], 'image_link')
    assert.equal(META_CATALOG_HEADERS[8], 'price')
    assert.equal(META_CATALOG_HEADERS[12], 'sale_price')
  })

  it('generates a row with exactly 31 columns matching the headers', () => {
    const row = productToMetaCatalogRow(sampleProduct)
    assert.equal(row.length, 31)
    assert.equal(row[0], 'prod-123')
    assert.equal(row[1], 'Louis Vuitton LV Trainer Sneaker - Black/White')
    assert.equal(row[3], 'in stock')
    assert.equal(row[4], 'new')
    assert.equal(
      row[5],
      'https://splaro.co/products/louis-vuitton-lv-trainer-sneaker-black-white',
    )
    // Primary main image only
    assert.equal(row[6], 'https://splaro.co/uploads/media/first-main.webp')
    assert.equal(row[7], 'Louis Vuitton')
    assert.equal(row[8], '5100.00 BDT')
    assert.equal(row[12], '4600.00 BDT')
  })

  it('resolves image url to full production origin', () => {
    assert.equal(
      resolveFacebookImageUrl('/uploads/media/test.webp'),
      'https://splaro.co/uploads/media/test.webp',
    )
    assert.equal(
      resolveFacebookImageUrl('https://cdn.splaro.co/uploads/test.jpg'),
      'https://cdn.splaro.co/uploads/test.jpg',
    )
    assert.equal(
      resolveFacebookImageUrl('http://localhost:3000/uploads/test.webp'),
      'https://splaro.co/uploads/test.webp',
    )
  })

  it('builds full CSV string starting with official comment line and header row', () => {
    const csv = buildFacebookCatalogCsv([sampleProduct])
    const lines = csv.split('\r\n')
    assert.ok(lines.length >= 3)
    assert.equal(lines[0], META_CATALOG_COMMENT_LINE)
    assert.equal(lines[1], META_CATALOG_HEADERS.join(','))
    const dataRow = lines[2] || ''
    assert.ok(dataRow.includes('prod-123'))
    assert.ok(dataRow.includes('https://splaro.co/uploads/media/first-main.webp'))
    assert.ok(dataRow.includes('4600.00 BDT'))
  })
})

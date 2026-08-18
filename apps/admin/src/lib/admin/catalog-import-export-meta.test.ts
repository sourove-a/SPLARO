import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  BULK_CSV_OPEN_LABEL,
  BULK_CSV_WORKSPACE_LABEL,
  formatCatalogBulkIntro,
  formatCatalogBulkTemplateSubtitle,
  formatCatalogProductsSyncLabel,
  formatCatalogPublishedSub,
} from './catalog-import-export-meta'

describe('catalog import/export copy', () => {
  it('labels catalog totals as products, not SKUs', () => {
    assert.equal(formatCatalogProductsSyncLabel(0), '0 products')
    assert.equal(formatCatalogProductsSyncLabel(1), '1 product')
    assert.equal(formatCatalogPublishedSub(12), '12 live on store')
  })

  it('keeps the product page action aligned with the workspace name', () => {
    assert.equal(BULK_CSV_WORKSPACE_LABEL, 'Bulk & CSV')
    assert.equal(BULK_CSV_OPEN_LABEL, 'Open Bulk & CSV')
  })

  it('explains catalog dry-run and API batching honestly', () => {
    assert.match(formatCatalogBulkIntro('Catalog', true), /One row per variant/i)
    assert.match(formatCatalogBulkIntro('Catalog', true), /200-row API batches/i)
    assert.match(formatCatalogBulkTemplateSubtitle('sku · stock'), /200 rows/i)
  })
})

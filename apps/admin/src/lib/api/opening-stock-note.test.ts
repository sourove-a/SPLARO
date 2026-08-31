import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { OPENING_STOCK_NOTE } from './commerce-os'

/**
 * The API decides whether removing a ledger row gives stock back by comparing
 * the row's note to its own constant. The admin uses its copy to tell the
 * operator, before they confirm, which of the two is about to happen.
 *
 * Nothing at build time ties the two strings together — the admin cannot import
 * from the API — so a reword on one side would silently turn every "this moves
 * nothing" confirmation into a lie while the API kept deleting correctly. This
 * reads the API's literal and fails the moment they disagree.
 */
test('the admin copy of OPENING_STOCK_NOTE matches the API', () => {
  const source = readFileSync(
    join(process.cwd(), '..', 'api', 'src/modules/commerce-os/wms-stock-summary.ts'),
    'utf8',
  )
  const match = /export const OPENING_STOCK_NOTE = '([^']+)'/.exec(source)
  assert.ok(match?.[1], 'OPENING_STOCK_NOTE literal not found in wms-stock-summary.ts')
  assert.equal(
    OPENING_STOCK_NOTE,
    match[1],
    'admin and API disagree on the opening-stock note — the delete confirmation would describe the wrong outcome',
  )
})

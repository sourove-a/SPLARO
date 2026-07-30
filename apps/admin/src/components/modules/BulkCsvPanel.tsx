'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { BulkCsvImportModal } from '@/components/modules/BulkCsvImportModal'
import { AdminButton } from '@/components/ui/AdminButton'
import { HandoffPageChrome } from '@/components/ui/HandoffPageChrome'
import { BetaBanner, DecisionCard, KpiGrid } from '@/components/ui/AdminHandoffBlocks'
import { downloadCsv } from '@/lib/admin/admin-actions'
import { toastOk } from '@/lib/admin/feedback'
import { markAdminLinkNavigation } from '@/lib/navigation/client-nav'
import type { ModuleContextProps } from '@/lib/modules/module-data'

/**
 * Handoff “Bulk & CSV” — stock, publish, price bulk + CSV import with dry-run.
 */
export function BulkCsvPanel(_props: ModuleContextProps) {
  const [importOpen, setImportOpen] = useState(false)

  return (
    <>
      <HandoffPageChrome
        group="Catalog"
        title="Bulk & CSV"
        sync="no job running"
        actions={
          <>
            <AdminButton
              size="sm"
              variant="ghost"
              onClick={() => {
                downloadCsv('splaro-products-import-template.csv', [
                  ['SKU', 'Product', 'Category', 'Brand', 'Variants', 'Stock', 'Price (BDT)', 'Status'],
                  ['SPL-EXAMPLE', 'Example product', 'Uncategorised', '', '1', '10', '1990', 'Draft'],
                ])
                toastOk('Template downloaded — fill rows then Import CSV.')
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Download template
            </AdminButton>
            <AdminButton size="sm" variant="primary" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </AdminButton>
          </>
        }
      >
        <BetaBanner route="/dashboard/bulk">
          · dry-run shows rejects before write · green only after verified API apply
        </BetaBanner>

        <KpiGrid
          columns={4}
          items={[
            { label: 'Stock bulk', value: 'Ready', sub: 'POST /products/bulk/stock' },
            { label: 'Publish bulk', value: 'Ready', sub: 'POST /products/bulk/publish' },
            { label: 'Orders CSV', value: 'Ready', sub: 'GET /reports/orders/export-csv' },
            { label: 'Price bulk', value: 'Ready', sub: 'POST /products/bulk/price' },
          ]}
        />

        <div className="admin-kpi-grid admin-kpi-grid--4" style={{ marginTop: 4 }}>
          {[
            {
              title: 'Bulk stock',
              body: 'Adjust stock for many SKUs in one call.',
              ok: true,
              href: '/dashboard/products',
              action: () => setImportOpen(true),
              actionLabel: 'Import stock CSV',
            },
            {
              title: 'Bulk publish',
              body: 'Publish or unpublish a list of product IDs.',
              ok: true,
              href: '/dashboard/products',
              action: () => setImportOpen(true),
              actionLabel: 'Import publish CSV',
            },
            {
              title: 'Export orders CSV',
              body: 'Finance / ops download from reports.',
              ok: true,
              href: '/dashboard/orders',
            },
            {
              title: 'Bulk price',
              body: 'Update variant prices by SKU in one call.',
              ok: true,
              href: '/dashboard/bulk',
              action: () => setImportOpen(true),
              actionLabel: 'Import price CSV',
            },
          ].map((card) => (
            <div key={card.title} className="admin-kpi-tile" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p className="admin-kpi-tile__label">{card.title}</p>
              <p className="admin-kpi-tile__sub" style={{ flex: 1 }}>
                {card.body}
              </p>
              <span className="admin-vis-badge admin-vis-badge--visible" style={{ alignSelf: 'flex-start' }}>
                API ready
              </span>
              {card.action ? (
                <AdminButton size="sm" variant="ghost" onClick={card.action} style={{ fontSize: 12, alignSelf: 'flex-start' }}>
                  {card.actionLabel}
                </AdminButton>
              ) : (
                <Link
                  href={card.href}
                  scroll={false}
                  onClick={() => markAdminLinkNavigation(card.href)}
                  className="admin-btn admin-btn--ghost"
                  style={{ fontSize: 12 }}
                >
                  Open related screen
                </Link>
              )}
            </div>
          ))}
        </div>

        <DecisionCard
          tone="warn"
          title="Import flow"
          decision="Map columns → dry run → review per-row status → apply"
          why="Rejects show reasons (negative stock, SKU not found). Nothing writes until you approve."
          stats={[
            { label: 'Apply', value: 'Manual' },
            { label: 'Price bulk', value: 'Live' },
            { label: 'Honesty', value: 'Required' },
          ]}
        />
      </HandoffPageChrome>

      <BulkCsvImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  )
}

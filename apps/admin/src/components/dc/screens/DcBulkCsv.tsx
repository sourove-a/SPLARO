'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcModal } from '@/components/dc/DcModal'
import { FONT, MONO, toneStyle } from '@/components/dc/tokens'
import { downloadCsv } from '@/lib/admin/admin-actions'
import {
  dryRunBulkCsv,
  templateFor,
  templateName,
  type BulkImportMode,
  type BulkPreviewRow,
} from '@/lib/admin/bulk-csv'
import { downloadFinanceCsv } from '@/lib/api/finance'
import { bulkPublishProducts, bulkUpdatePrices, bulkUpdateStock } from '@/lib/api/products'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `600 11px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

const th = {
  textAlign: 'left' as const,
  padding: '9px 15px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

const td = { padding: '9px 15px', font: `400 12.5px/1.4 ${FONT}`, color: 'var(--ink-2)' } as const

const MODES: Array<{
  id: BulkImportMode
  label: string
  endpoint: string
  what: string
  columns: string
}> = [
  {
    id: 'stock',
    label: 'Stock',
    endpoint: 'POST /admin/products/bulk/stock',
    what: 'Sets the stock number on a variant to exactly what the file says — it does not add to it.',
    columns: 'sku (or variant_id) · stock',
  },
  {
    id: 'price',
    label: 'Price',
    endpoint: 'POST /admin/products/bulk/price',
    what: 'Overwrites the selling price, and the compare-at price when the column is present.',
    columns: 'sku (or variant_id / product_id) · price · compare_at_price',
  },
  {
    id: 'publish',
    label: 'Publish',
    endpoint: 'POST /admin/products/bulk/publish',
    what: 'Puts products on or off the storefront. Off means customers can no longer find or buy them.',
    columns: 'sku (or product_id) · published',
  },
]

/** One card per bulk endpoint — what it writes, and where the write is logged. */
const OPERATIONS: Array<{
  mode: BulkImportMode
  title: string
  sub: string
  icon: string
  color: string
  cta: string
  rows: Array<[string, string]>
}> = [
  {
    mode: 'stock',
    title: 'Update stock',
    sub: 'Set stock across many SKUs in one write',
    icon: 'icon-archive',
    color: 'var(--ok)',
    cta: 'Import stock CSV',
    rows: [
      ['Endpoint', 'POST /admin/products/bulk/stock'],
      ['Writes', 'ProductVariant.stock — set, not added'],
      ['Matched by', 'sku, or variant_id when given'],
    ],
  },
  {
    mode: 'publish',
    title: 'Publish / unpublish',
    sub: 'Flip storefront visibility for a whole list',
    icon: 'icon-eye',
    color: 'var(--violet-ink)',
    cta: 'Import publish CSV',
    rows: [
      ['Endpoint', 'POST /admin/products/bulk/publish'],
      ['Writes', 'Product.isPublished'],
      ['Storefront', 'revalidates on the next request'],
    ],
  },
  {
    mode: 'price',
    title: 'Change price',
    sub: 'Overwrite price and compare-at per SKU',
    icon: 'icon-tag',
    color: 'var(--warn)',
    cta: 'Import price CSV',
    rows: [
      ['Endpoint', 'POST /admin/products/bulk/price'],
      ['Writes', 'price, and compareAtPrice when the column exists'],
      ['Returns', 'per-row ok/error, so partial writes are visible'],
    ],
  },
]

export function DcBulkCsv() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="bulk" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcBulkCsvBody />
    </DcScreenProvider>
  )
}

function DcBulkCsvBody() {
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement | null>(null)

  const [mode, setMode] = useState<BulkImportMode>('stock')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<BulkPreviewRow[]>([])
  const [parsing, setParsing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [confirmApply, setConfirmApply] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const active = MODES.find((m) => m.id === mode) ?? MODES[0]!
  const okRows = useMemo(() => rows.filter((r) => r.status === 'ok'), [rows])
  const rejects = useMemo(() => rows.filter((r) => r.status === 'reject'), [rows])
  const hasRun = rows.length > 0 || parseError !== null

  const reset = () => {
    setRows([])
    setFileName('')
    setParseError(null)
  }

  const runDryRun = async (file: File) => {
    setParsing(true)
    reset()
    setFileName(file.name)
    try {
      const text = await file.text()
      const res = await dryRunBulkCsv(mode, text)
      if (res.parsed === 0) {
        setParseError('The file has a header but no data rows.')
        return
      }
      setRows(res.rows)
      if (res.rows.every((r) => r.status === 'reject')) {
        toast(
          'warn',
          'Every row was rejected',
          'Nothing has been written. Fix the file and dry-run it again.',
        )
      } else {
        toast(
          'ok',
          `${res.rows.filter((r) => r.status === 'ok').length} of ${res.parsed} rows would write`,
          'Nothing has changed yet — this was a dry run.',
        )
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not read the CSV'
      setParseError(message)
      toast('bad', 'Dry run failed', message)
    } finally {
      setParsing(false)
    }
  }

  const apply = async () => {
    setConfirmApply(false)
    setApplying(true)
    try {
      if (mode === 'stock') {
        const updates = okRows.map((r) => r.payload as { variantId: string; stock: number })
        const res = await bulkUpdateStock(updates)
        if (res.updated <= 0) {
          toast(
            'bad',
            'Stock bulk wrote nothing',
            `The API rejected all ${res.failed} row${res.failed === 1 ? '' : 's'}.`,
          )
          return
        }
        toast(
          'ok',
          `Stock set on ${res.updated} variant${res.updated === 1 ? '' : 's'}`,
          res.failed > 0
            ? `${res.failed} row${res.failed === 1 ? '' : 's'} were rejected by the API.`
            : 'Every valid row was written.',
        )
      } else if (mode === 'price') {
        const updates = okRows.map(
          (r) =>
            r.payload as {
              variantId?: string
              sku?: string
              productId?: string
              price: number
              compareAtPrice?: number | null
            },
        )
        const res = await bulkUpdatePrices(updates)
        if (res.updated <= 0) {
          toast(
            'bad',
            'Price bulk wrote nothing',
            `The API rejected all ${res.failed} row${res.failed === 1 ? '' : 's'}.`,
          )
          return
        }
        toast(
          'ok',
          `Prices updated on ${res.updated} row${res.updated === 1 ? '' : 's'}`,
          res.failed > 0
            ? `${res.failed} row${res.failed === 1 ? '' : 's'} were rejected by the API.`
            : 'Storefront prices are live immediately.',
        )
      } else {
        const publishIds = okRows
          .filter((r) => (r.payload as { isPublished: boolean }).isPublished)
          .map((r) => (r.payload as { productId: string }).productId)
        const unpublishIds = okRows
          .filter((r) => !(r.payload as { isPublished: boolean }).isPublished)
          .map((r) => (r.payload as { productId: string }).productId)
        let updated = 0
        if (publishIds.length > 0) updated += (await bulkPublishProducts(publishIds, true)).updated
        if (unpublishIds.length > 0)
          updated += (await bulkPublishProducts(unpublishIds, false)).updated
        if (updated <= 0) {
          toast('bad', 'Publish bulk wrote nothing', 'The API returned zero updates.')
          return
        }
        toast(
          'ok',
          `Storefront state changed on ${updated} product${updated === 1 ? '' : 's'}`,
          `${publishIds.length} published · ${unpublishIds.length} taken off the storefront.`,
        )
      }
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      reset()
    } catch (e) {
      toast(
        'bad',
        'Bulk write failed',
        e instanceof Error ? e.message : `${active.endpoint} failed`,
      )
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Catalog"
        title="Bulk & CSV"
        statusLabel={hasRun ? (rejects.length > 0 ? 'needs attention' : 'ready to apply') : 'idle'}
        statusTone={hasRun ? (rejects.length > 0 ? 'warn' : 'ok') : 'mute'}
        syncLabel={
          parsing
            ? 'checking the file…'
            : hasRun
              ? `${okRows.length} would write · ${rejects.length} rejected`
              : 'no file loaded'
        }
        syncing={parsing}
        actions={[
          {
            label: 'Download template',
            icon: 'icon-download',
            onClick: () => {
              downloadCsv(templateName(mode), templateFor(mode))
              toast(
                'ok',
                `${active.label} template downloaded`,
                'Fill the rows, then dry-run it here before applying.',
              )
            },
          },
          {
            label: 'Choose CSV',
            icon: 'icon-upload',
            variant: 'primary',
            onClick: () => fileInput.current?.click(),
          },
        ]}
      />

      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void runDryRun(file)
        }}
      />

      {/* Mode picks the endpoint, the columns, and what gets overwritten. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {MODES.map((m) => {
          const on = m.id === mode
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id)
                reset()
              }}
              style={{
                height: 32,
                padding: '0 13px',
                borderRadius: 99,
                border: `1px solid ${on ? 'var(--violet-solid)' : 'var(--line)'}`,
                background: on ? 'var(--violet-solid)' : 'var(--surface)',
                color: on ? 'var(--on-violet)' : 'var(--ink-2)',
                cursor: 'pointer',
                font: `600 12px/1 ${FONT}`,
              }}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      <div
        style={{
          ...card,
          padding: '14px 16px',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 30,
            height: 30,
            flex: 'none',
            borderRadius: 9,
            border: '1px solid var(--line)',
            background: 'var(--surface-2)',
            color: 'var(--ink-2)',
          }}
        >
          <DcIcon name="icon-file-spreadsheet" size={14} />
        </span>
        <span
          style={{
            flex: '1 1 260px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          <span style={{ font: `600 13.5px/1.35 ${FONT}`, color: 'var(--ink)' }}>
            {active.label} bulk — what it overwrites
          </span>
          <span
            style={{ font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-3)', textWrap: 'pretty' }}
          >
            {active.what} Every file is dry-run against the live catalogue first, so you see the
            rejects before anything is written.
          </span>
          <span style={{ font: `400 11.5px/1.5 ${MONO}`, color: 'var(--ink-3)' }}>
            columns: {active.columns} · {active.endpoint}
          </span>
        </span>
      </div>

      {/* Bulk operations — one card per endpoint, stating what it writes. */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 9,
            flexWrap: 'wrap',
            padding: '12px 15px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <span
            style={{ flex: 1, minWidth: 130, font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}
          >
            Bulk operations
          </span>
          <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
            all three write through a dry run first
          </span>
        </div>
        <div
          style={{
            padding: 12,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))',
            gap: 10,
          }}
        >
          {OPERATIONS.map((op) => {
            const on = op.mode === mode
            return (
              <div
                key={op.mode}
                style={{
                  border: `1px solid ${on ? 'var(--violet-bd)' : 'var(--line)'}`,
                  borderRadius: 11,
                  background: on ? 'var(--violet-soft)' : 'var(--surface-2)',
                  padding: '12px 13px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <span
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 28,
                      height: 28,
                      flex: 'none',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'var(--surface)',
                      color: op.color,
                    }}
                  >
                    <DcIcon name={op.icon} size={13} />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                    }}
                  >
                    <span style={{ font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                      {op.title}
                    </span>
                    <span style={{ font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                      {op.sub}
                    </span>
                  </span>
                  <span
                    style={{
                      flex: 'none',
                      padding: '3px 7px',
                      borderRadius: 6,
                      border: '1px solid var(--ok-bd)',
                      background: 'var(--ok-soft)',
                      color: 'var(--ok)',
                      font: '700 9px/1.3 Inter, sans-serif',
                      letterSpacing: '.08em',
                    }}
                  >
                    LIVE
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    padding: '9px 10px',
                    borderRadius: 9,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                  }}
                >
                  {op.rows.map(([k, v]) => (
                    <span
                      key={k}
                      style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}
                    >
                      <span
                        style={{
                          width: 62,
                          flex: 'none',
                          font: `600 9.5px/1.4 ${FONT}`,
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          color: 'var(--ink-3)',
                        }}
                      >
                        {k}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          font: `400 11px/1.45 ${MONO}`,
                          color: 'var(--ink-2)',
                          wordBreak: 'break-word',
                        }}
                      >
                        {v}
                      </span>
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (mode !== op.mode) {
                      setMode(op.mode)
                      reset()
                    }
                    fileInput.current?.click()
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: `1px solid ${on ? 'var(--violet-solid)' : 'var(--line-2)'}`,
                    background: on ? 'var(--violet-solid)' : 'transparent',
                    color: on ? 'var(--on-violet)' : 'var(--ink-2)',
                    cursor: 'pointer',
                    font: `600 11.5px/1 ${FONT}`,
                  }}
                >
                  {op.cta}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {!hasRun ? (
        <div
          style={{
            ...card,
            padding: '44px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 40,
              height: 40,
              borderRadius: 12,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink-3)',
            }}
          >
            <DcIcon name="icon-upload" size={17} />
          </span>
          <span style={{ font: `600 14px/1.4 ${FONT}`, color: 'var(--ink)' }}>
            {parsing ? 'Checking the file against the catalogue…' : 'No file loaded'}
          </span>
          <span
            style={{
              maxWidth: 440,
              font: `400 12.5px/1.6 ${FONT}`,
              color: 'var(--ink-3)',
              textWrap: 'pretty',
            }}
          >
            Choose a CSV to dry-run it. Nothing is written until you read the preview and press
            Apply.
          </span>
          <button
            type="button"
            disabled={parsing}
            onClick={() => fileInput.current?.click()}
            style={{
              height: 34,
              padding: '0 14px',
              borderRadius: 9,
              border: '1px solid var(--violet-solid)',
              background: 'var(--violet-solid)',
              color: 'var(--on-violet)',
              cursor: parsing ? 'not-allowed' : 'pointer',
              font: `600 12.5px/1 ${FONT}`,
            }}
          >
            {parsing ? 'Reading…' : 'Choose CSV'}
          </button>
        </div>
      ) : parseError ? (
        <div
          style={{
            ...card,
            borderLeft: '3px solid var(--bad)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <span style={{ font: `600 13.5px/1.35 ${FONT}`, color: 'var(--ink)' }}>
            {fileName || 'The file'} could not be read
          </span>
          <span
            style={{
              padding: '9px 11px',
              borderRadius: 9,
              border: '1px solid var(--bad-bd)',
              background: 'var(--bad-soft)',
              color: 'var(--bad)',
              font: `400 11.5px/1.5 ${MONO}`,
              wordBreak: 'break-word',
            }}
          >
            {parseError}
          </span>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            style={{
              alignSelf: 'flex-start',
              height: 30,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid var(--line-2)',
              background: 'transparent',
              color: 'var(--ink-2)',
              cursor: 'pointer',
              font: `600 11.5px/1 ${FONT}`,
            }}
          >
            Choose another file
          </button>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi label="Rows in file" value={String(rows.length)} sub={fileName || 'uploaded CSV'} />
            <Kpi
              label="Would write"
              value={String(okRows.length)}
              sub="matched a SKU and passed validation"
              color={okRows.length > 0 ? 'var(--ok)' : 'var(--bad)'}
            />
            <Kpi
              label="Rejected"
              value={String(rejects.length)}
              sub={rejects.length > 0 ? 'these rows will be skipped' : 'nothing rejected'}
              color={rejects.length > 0 ? 'var(--warn)' : undefined}
            />
            <Kpi
              label="Written so far"
              value="0"
              sub="dry run only — nothing has changed yet"
            />
          </div>

          <div
            style={{
              ...card,
              borderLeft: `3px solid ${okRows.length > 0 ? 'var(--warn)' : 'var(--bad)'}`,
              padding: '13px 16px',
              display: 'flex',
              gap: 11,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                flex: '1 1 240px',
                minWidth: 0,
                font: `400 12.5px/1.55 ${FONT}`,
                color: 'var(--ink-2)',
                textWrap: 'pretty',
              }}
            >
              {okRows.length === 0
                ? 'No row in this file can be written. Fix the rejects below and dry-run it again.'
                : `Applying writes ${okRows.length} row${okRows.length === 1 ? '' : 's'} through ${active.endpoint}. ${rejects.length > 0 ? `The ${rejects.length} rejected row${rejects.length === 1 ? '' : 's'} will be skipped, not fixed.` : ''} There is no undo.`}
            </span>
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  height: 32,
                  padding: '0 13px',
                  borderRadius: 9,
                  border: '1px solid var(--line-2)',
                  background: 'transparent',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                  font: `600 12px/1 ${FONT}`,
                }}
              >
                Discard
              </button>
              <button
                type="button"
                disabled={okRows.length === 0 || applying}
                onClick={() => setConfirmApply(true)}
                style={{
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 9,
                  border: '1px solid var(--violet-solid)',
                  background: 'var(--violet-solid)',
                  color: 'var(--on-violet)',
                  cursor: okRows.length === 0 || applying ? 'not-allowed' : 'pointer',
                  opacity: okRows.length === 0 || applying ? 0.55 : 1,
                  font: `600 12px/1 ${FONT}`,
                }}
              >
                {applying ? 'Writing…' : `Apply ${okRows.length} row${okRows.length === 1 ? '' : 's'}`}
              </button>
            </span>
          </div>

          <div style={{ ...card, overflow: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                padding: '12px 15px',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <span
                style={{ flex: 1, minWidth: 140, font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}
              >
                Dry-run preview
              </span>
              <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                rejects first
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'right' }}>Line</th>
                  <th style={th}>SKU</th>
                  <th style={th}>Product</th>
                  <th style={{ ...th, textAlign: 'right' }}>Now</th>
                  <th style={{ ...th, textAlign: 'right' }}>After</th>
                  <th style={{ ...th, textAlign: 'right' }}>Change</th>
                  <th style={th}>Result</th>
                  <th style={th}>Why</th>
                </tr>
              </thead>
              <tbody>
                {[...rejects, ...okRows].map((r) => {
                  const tone = toneStyle(r.status === 'ok' ? 'ok' : 'bad')
                  const delta = deltaOf(r.current, r.value)
                  return (
                    <tr key={`${r.line}-${r.key}`} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td
                        style={{
                          ...td,
                          textAlign: 'right',
                          font: `500 12px/1 ${MONO}`,
                          color: 'var(--ink-3)',
                        }}
                      >
                        {r.line}
                      </td>
                      <td style={{ ...td, font: `600 12.5px/1 ${MONO}`, color: 'var(--ink)' }}>
                        {r.key}
                      </td>
                      <td style={{ ...td, color: r.label ? 'var(--ink-2)' : 'var(--ink-3)' }}>
                        {r.label ?? 'not in this store'}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: 'right',
                          font: `500 12.5px/1 ${MONO}`,
                          color: 'var(--ink-3)',
                        }}
                      >
                        {r.current ?? '—'}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: 'right',
                          font: `600 12.5px/1 ${MONO}`,
                          color: r.status === 'ok' ? 'var(--ink)' : 'var(--ink-3)',
                        }}
                      >
                        {r.value || '—'}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: 'right',
                          font: `500 12.5px/1 ${MONO}`,
                          color: delta.tone,
                        }}
                      >
                        {delta.label}
                      </td>
                      <td style={{ padding: '9px 15px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: `1px solid ${tone.bd}`,
                            background: tone.bg,
                            color: tone.fg,
                            font: `600 11px/1 ${FONT}`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <DcIcon
                            name={r.status === 'ok' ? 'icon-check' : 'icon-x'}
                            size={11}
                          />
                          {r.status === 'ok' ? 'Will write' : 'Skipped'}
                        </span>
                      </td>
                      <td style={{ ...td, color: r.reason ? 'var(--bad)' : 'var(--ink-3)' }}>
                        {r.reason ?? 'matched the catalogue'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <DcModal
        open={confirmApply}
        title={`Write ${okRows.length} row${okRows.length === 1 ? '' : 's'} now?`}
        subtitle={
          mode === 'publish'
            ? 'This changes what customers can see and buy on the storefront immediately. There is no undo.'
            : mode === 'price'
              ? 'New prices go live on the storefront immediately. There is no undo.'
              : 'Stock is set to exactly the numbers in the file, overwriting what is there now. There is no undo.'
        }
        confirmLabel={`Apply ${okRows.length}`}
        busy={applying}
        onClose={() => setConfirmApply(false)}
        onConfirm={() => void apply()}
      />

      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', width: '100%' }}
      >
        <div style={{ flex: '1 1 46%', minWidth: 300, maxWidth: '100%' }}>
          <div style={{ ...card, padding: '6px 16px 10px' }}>
            <div style={{ padding: '12px 0 9px' }}>
              <span style={{ font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                CSV you can export today
              </span>
            </div>
            {[
              {
                icon: 'icon-shopping-bag',
                title: 'Orders',
                sub: 'GET /finance-reports/orders/export-csv?days=30',
                state: 'READY' as const,
                run: () => {
                  void downloadFinanceCsv('orders', 30)
                  toast('ok', 'Orders CSV downloading', 'Last 30 days, one row per order.')
                },
              },
              {
                icon: 'icon-package',
                title: `${active.label} template`,
                sub: `${active.columns} — the shape this importer expects`,
                state: 'READY' as const,
                run: () => {
                  downloadCsv(templateName(mode), templateFor(mode))
                  toast('ok', `${active.label} template downloaded`, 'Fill the rows, then dry-run it.')
                },
              },
              {
                icon: 'icon-users',
                title: 'Customers',
                sub: 'no customer export endpoint exists on this API yet',
                state: 'NOT BUILT' as const,
              },
            ].map((x) => (
              <div
                key={x.title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '10px 0',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 28,
                    height: 28,
                    flex: 'none',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    color: x.state === 'READY' ? 'var(--violet-ink)' : 'var(--ink-3)',
                  }}
                >
                  <DcIcon name={x.icon} size={13} />
                </span>
                <span
                  style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}
                >
                  <span style={{ font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                    {x.title}
                  </span>
                  <span
                    style={{
                      font: `400 11px/1.45 ${MONO}`,
                      color: 'var(--ink-3)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {x.sub}
                  </span>
                </span>
                {x.run ? (
                  <button
                    type="button"
                    onClick={x.run}
                    style={{
                      flex: 'none',
                      height: 28,
                      padding: '0 11px',
                      borderRadius: 8,
                      border: '1px solid var(--line-2)',
                      background: 'transparent',
                      color: 'var(--ink-2)',
                      cursor: 'pointer',
                      font: `600 11.5px/1 ${FONT}`,
                    }}
                  >
                    Download
                  </button>
                ) : (
                  <span
                    style={{
                      flex: 'none',
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--warn-bd)',
                      background: 'var(--warn-soft)',
                      color: 'var(--warn)',
                      font: '700 9px/1.4 Inter, sans-serif',
                      letterSpacing: '.08em',
                    }}
                  >
                    NOT BUILT
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 46%', minWidth: 300, maxWidth: '100%' }}>
          <div style={{ ...card, padding: '6px 16px 10px' }}>
            <div style={{ padding: '12px 0 9px' }}>
              <span style={{ font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                Rules this importer enforces
              </span>
            </div>
            {[
              {
                icon: 'icon-shield',
                title: 'Dry run before every write',
                sub: 'the file is checked against the live catalogue first — Apply is the only thing that writes',
              },
              {
                icon: 'icon-file-text',
                title: 'Rejects are named, not dropped',
                sub: 'every skipped row shows its line number and the reason it failed',
              },
              {
                icon: 'icon-list-checks',
                title: 'Valid rows still apply',
                sub: 'a rejected row does not block the rest — the toast reports what the API actually wrote',
              },
              {
                icon: 'icon-clock',
                title: 'One file at a time',
                sub: 'changing the operation clears the preview, so a stock file can never apply as prices',
              },
            ].map((r) => (
              <div
                key={r.title}
                style={{
                  display: 'flex',
                  gap: 11,
                  padding: '10px 0',
                  borderTop: '1px solid var(--line)',
                }}
              >
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 28,
                    height: 28,
                    flex: 'none',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    color: 'var(--ink-2)',
                  }}
                >
                  <DcIcon name={r.icon} size={13} />
                </span>
                <span
                  style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}
                >
                  <span style={{ font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                    {r.title}
                  </span>
                  <span
                    style={{
                      font: `400 11.5px/1.45 ${FONT}`,
                      color: 'var(--ink-3)',
                      textWrap: 'pretty',
                    }}
                  >
                    {r.sub}
                  </span>
                </span>
                <span
                  style={{
                    flex: 'none',
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--ok-bd)',
                    background: 'var(--ok-soft)',
                    color: 'var(--ok)',
                    font: '700 9px/1.4 Inter, sans-serif',
                    letterSpacing: '.08em',
                  }}
                >
                  ON
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Numeric rows get a signed delta; publish rows get "no change" when the file
 * asks for the state the product is already in — that row writes nothing.
 */
function deltaOf(current: string | undefined, next: string): { label: string; tone: string } {
  if (current === undefined || !next) return { label: '—', tone: 'var(--ink-3)' }
  if (current === next) return { label: 'no change', tone: 'var(--ink-3)' }
  const a = Number(current)
  const b = Number(next)
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { label: `→ ${next}`, tone: 'var(--ink-2)' }
  }
  const d = Math.round((b - a) * 100) / 100
  if (d === 0) return { label: 'no change', tone: 'var(--ink-3)' }
  return {
    label: d > 0 ? `+${d}` : `−${Math.abs(d)}`,
    tone: d > 0 ? 'var(--ok)' : 'var(--warn)',
  }
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color?: string | undefined
}) {
  return (
    <div
      style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span style={capsLabel}>{label}</span>
      <span
        style={{ font: `700 25px/1 ${FONT}`, letterSpacing: '-.025em', color: color ?? 'var(--ink)' }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}

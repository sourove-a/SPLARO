'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Hash, QrCode, ScanBarcode, Sparkles } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { ModulePanelShell, STATUS_CLASS } from '@/components/modules/ModulePanelShell'
import { useProducts } from '@/lib/api/hooks'
import { generateProductSkus, fetchProductQR, productStatus } from '@/lib/api/products'

type CodeMode = 'sku' | 'qr' | 'barcode'

const MODE_META: Record<CodeMode, { title: string; icon: typeof Hash; createLabel: string }> = {
  sku: { title: 'SKU Manager', icon: Hash, createLabel: 'Generate all SKUs' },
  qr: { title: 'QR Manager', icon: QrCode, createLabel: 'Generate QR batch' },
  barcode: { title: 'Barcode Manager', icon: ScanBarcode, createLabel: 'Generate barcodes' },
}

export function LiveProductCodesPanel({ mode }: { mode: CodeMode }) {
  const meta = MODE_META[mode]
  const Icon = meta.icon
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [qrPreview, setQrPreview] = useState<Record<string, string>>({})
  const { data, isLoading, isError, refetch } = useProducts({ limit: 100 })

  const products = data?.products ?? []

  const rows = useMemo(() => {
    return products.map((p) => {
      const variants = (p.variants ?? []) as { sku?: string | null; size?: string; color?: string; stock?: number }[]
      const skus = variants.map((v) => v.sku).filter(Boolean) as string[]
      return {
        id: p.id,
        name: p.name,
        productSku: p.sku ?? skus[0] ?? '—',
        variantSkus: skus,
        status: productStatus(p),
        variantCount: variants.length,
      }
    })
  }, [products])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.productSku.toLowerCase().includes(q) ||
        r.variantSkus.some((s) => s.toLowerCase().includes(q)),
    )
  }, [rows, query])

  const withSku = rows.filter((r) => r.productSku !== '—' || r.variantSkus.length > 0).length
  const withoutSku = rows.length - withSku

  const runSku = async (productId: string, name: string) => {
    setBusyId(productId)
    try {
      const res = await generateProductSkus(productId)
      toast.success(`SKUs generated for ${name} (${res.updated} variants)`)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'SKU generation failed')
    } finally {
      setBusyId(null)
    }
  }

  const runQr = async (productId: string, name: string) => {
    setBusyId(productId)
    try {
      const res = await fetchProductQR(productId)
      setQrPreview((prev) => ({ ...prev, [productId]: res.qr }))
      toast.success(`QR ready for ${name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'QR generation failed')
    } finally {
      setBusyId(null)
    }
  }

  const bulkGenerate = async () => {
    if (mode === 'qr') {
      for (const row of filtered.slice(0, 10)) {
        await runQr(row.id, row.name)
      }
      return
    }
    for (const row of filtered.filter((r) => r.variantSkus.length === 0).slice(0, 20)) {
      await runSku(row.id, row.name)
    }
    toast.success('Bulk SKU generation complete')
  }

  return (
    <div className="space-y-4">
      {isError ? (
        <div className="rounded-[16px] border border-red-200/60 bg-red-50/80 px-4 py-3 text-xs font-semibold text-red-800">
          API offline — add products first, then generate SKUs/QR from here.
        </div>
      ) : null}

      <ModulePanelShell
        kpis={[
          ['Products', rows.length, 'default'],
          ['With SKU', withSku, 'success'],
          ['Needs SKU', withoutSku, 'warning'],
          ['Live data', '100%', 'gold'],
        ]}
        pipeline={[
          ['Active', rows.filter((r) => r.status === 'active').length],
          ['Draft', rows.filter((r) => r.status === 'draft').length],
          ['Variants', rows.reduce((s, r) => s + r.variantCount, 0)],
          ['QR cached', Object.keys(qrPreview).length],
          ['No mock', 0],
        ]}
        query={query}
        onQuery={setQuery}
        searchPlaceholder="Search product or SKU..."
        createLabel={meta.createLabel}
        onCreate={bulkGenerate}
        onRefresh={() => { refetch(); toast.success('Product codes synced.') }}
        onExport={() => toast.error('This action is not available yet — feature pending.')}
        tableIcon={Icon}
        tableTitle={`${meta.title} · ${filtered.length} products`}
        footer={isLoading ? 'Loading products…' : 'Live from database — no demo SKUs'}
      >
        <table className="admin-module-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Variants</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td className="font-semibold">{row.name}</td>
                <td className="font-mono text-xs">{row.variantSkus.join(', ') || row.productSku}</td>
                <td>{row.variantCount}</td>
                <td><span className={STATUS_CLASS[row.status]}>{row.status}</span></td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {(mode === 'sku' || mode === 'barcode') ? (
                      <AdminButton
                        variant="gold"
                        className="!px-2 !py-1 !text-xs"
                        loading={busyId === row.id}
                        onClick={() => runSku(row.id, row.name)}
                      >
                        <Sparkles className="h-3 w-3" />
                        SKU
                      </AdminButton>
                    ) : null}
                    {(mode === 'qr' || mode === 'barcode') ? (
                      <AdminButton
                        variant="ghost"
                        className="!px-2 !py-1 !text-xs"
                        loading={busyId === row.id}
                        onClick={() => runQr(row.id, row.name)}
                      >
                        QR
                      </AdminButton>
                    ) : null}
                  </div>
                  {qrPreview[row.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrPreview[row.id]} alt={`QR ${row.name}`} className="mt-2 h-16 w-16 rounded border border-black/8" />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm font-semibold text-[var(--admin-text-secondary)]">
            No products yet. Create a product first — then generate SKU & QR here.
          </p>
        ) : null}
      </ModulePanelShell>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Hash, Pencil, QrCode, ScanBarcode } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { ModulePanelShell, STATUS_CLASS } from '@/components/modules/ModulePanelShell'
import { useProducts, useSettings } from '@/lib/api/hooks'
import { fetchProductQR, productStatus } from '@/lib/api/products'
import { useAdminNavigate } from '@/lib/navigation/client-nav'
import { refreshWithToast, toastFail } from '@/lib/admin/feedback'

type CodeMode = 'sku' | 'qr' | 'barcode'

const MODE_META: Record<CodeMode, { title: string; icon: typeof Hash; createLabel: string }> = {
  sku: { title: 'SKU Manager', icon: Hash, createLabel: 'Open product edit' },
  qr: { title: 'QR Manager', icon: QrCode, createLabel: 'Generate QR batch' },
  barcode: { title: 'Barcode Manager', icon: ScanBarcode, createLabel: 'Open product edit' },
}

export function LiveProductCodesPanel({ mode }: { mode: CodeMode }) {
  const meta = MODE_META[mode]
  const Icon = meta.icon
  const { navigate } = useAdminNavigate()
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [qrPreview, setQrPreview] = useState<Record<string, string>>({})
  const { data, isLoading, isError, refetch } = useProducts({ limit: 100 })
  const { data: settings } = useSettings()
  const autoSku = settings?.catalog?.autoGenerateSku ?? false

  const products = useMemo(() => data?.products ?? [], [data])

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
    if (filtered[0]) {
      navigate(`/dashboard/products/${filtered[0].id}/edit`)
    }
  }

  return (
    <div className="space-y-4">
      {isError ? (
        <div className="rounded-[16px] border border-red-200/60 bg-red-50/80 px-4 py-3 text-xs font-semibold text-red-800">
          API offline — add products first, then enter SKUs in product edit.
        </div>
      ) : null}

      {mode === 'sku' && !autoSku ? (
        <div className="rounded-[16px] border border-amber-200/60 bg-amber-50/80 px-4 py-3 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Manual SKU mode — auto-generate is off. তুমি নিজে SKU লিখবে product edit এ। Settings → General থেকে auto-generate চালু করা যায়।
        </div>
      ) : null}

      <ModulePanelShell
        kpis={[
          ['Products', rows.length, 'default'],
          ['With SKU', withSku, 'success'],
          ['Needs SKU', withoutSku, 'warning'],
          ['Auto SKU', autoSku ? 'On' : 'Off', autoSku ? 'gold' : 'default'],
        ]}
        pipeline={[
          ['Active', rows.filter((r) => r.status === 'active').length],
          ['Draft', rows.filter((r) => r.status === 'draft').length],
          ['Variants', rows.reduce((s, r) => s + r.variantCount, 0)],
          ['QR cached', Object.keys(qrPreview).length],
          ['Manual SKU', autoSku ? 0 : 1],
        ]}
        query={query}
        onQuery={setQuery}
        searchPlaceholder="Search product or SKU..."
        createLabel={meta.createLabel}
        onCreate={bulkGenerate}
        onRefresh={() => void refreshWithToast(() => refetch(), 'Product codes synced.')}
        onExport={() => toastFail('Export not available yet.')}
        tableIcon={Icon}
        tableTitle={`${meta.title} · ${filtered.length} products`}
        footer={isLoading ? 'Loading products…' : 'Live from database — enter SKUs manually for launch'}
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
                        onClick={() => navigate(`/dashboard/products/${row.id}/edit`)}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit SKU
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
            No products yet. Create a product — then type your SKU codes in product edit.
          </p>
        ) : null}
      </ModulePanelShell>
    </div>
  )
}

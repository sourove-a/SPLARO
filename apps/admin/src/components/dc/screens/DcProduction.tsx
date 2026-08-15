'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

import { DcField, DcModal } from '@/components/dc/DcModal'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcHubFrame, HubKpis, HubTable, HubTabs } from '@/components/dc/screens/DcHubKit'
import { toastApiSaved, toastFail, toastOk } from '@/lib/admin/feedback'
import {
  useCreateFabricInventory,
  useCreateProductionBatch,
  useProductionOverview,
  useUpdateFabricStock,
  useUpdateProductionBatchStatus,
} from '@/lib/api/hooks'
import { formatBDT } from '@/lib/format/currency'

const BATCH_PIPELINE = ['PENDING', 'CUTTING', 'SEWING', 'FINISHING', 'QC', 'READY'] as const

function nextBatchStatus(current: string): string | null {
  const i = BATCH_PIPELINE.indexOf(current as (typeof BATCH_PIPELINE)[number])
  if (i === -1) return 'CUTTING'
  if (i >= BATCH_PIPELINE.length - 1) return null
  return BATCH_PIPELINE[i + 1] ?? null
}

export function DcProduction() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="production" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcProductionBody />
    </DcScreenProvider>
  )
}

function DcProductionBody() {
  const production = useProductionOverview()
  const createBatchMutation = useCreateProductionBatch()
  const createFabricMutation = useCreateFabricInventory()
  const updateFabricMutation = useUpdateFabricStock()
  const updateBatchStatusMutation = useUpdateProductionBatchStatus()

  const [tab, setTab] = useState<'batches' | 'fabric'>('batches')

  // Batch Modal
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchProduct, setBatchProduct] = useState('')
  const [batchQuantity, setBatchQuantity] = useState('50')
  const [batchTailor, setBatchTailor] = useState('')
  const [batchNotes, setBatchNotes] = useState('')

  // Fabric Modal
  const [fabricModalOpen, setFabricModalOpen] = useState(false)
  const [fabricName, setFabricName] = useState('')
  const [fabricColor, setFabricColor] = useState('')
  const [fabricQty, setFabricQty] = useState('100')
  const [fabricUnit, setFabricUnit] = useState('Yards')
  const [fabricCost, setFabricCost] = useState('350')

  // Adjust Fabric Stock Modal
  const [adjustFabricId, setAdjustFabricId] = useState<string | null>(null)
  const [adjustDelta, setAdjustDelta] = useState('10')

  const handleCreateBatch = async () => {
    if (!batchProduct.trim()) {
      toastFail('Product name is required')
      return
    }
    const qty = parseInt(batchQuantity, 10)
    if (isNaN(qty) || qty <= 0) {
      toastFail('Valid quantity is required')
      return
    }

    try {
      const payload: {
        productName: string
        quantity: number
        tailorName?: string
        notes?: string
      } = {
        productName: batchProduct.trim(),
        quantity: qty,
      }
      if (batchTailor.trim()) payload.tailorName = batchTailor.trim()
      if (batchNotes.trim()) payload.notes = batchNotes.trim()

      await createBatchMutation.mutateAsync(payload)
      toastApiSaved('Production batch created')
      setBatchModalOpen(false)
      setBatchProduct('')
      setBatchNotes('')
      setBatchTailor('')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Failed to create batch')
    }
  }

  const handleCreateFabric = async () => {
    if (!fabricName.trim()) {
      toastFail('Fabric name is required')
      return
    }
    const qty = parseFloat(fabricQty)
    const cost = parseFloat(fabricCost)

    try {
      const payload: {
        name: string
        color?: string
        quantity?: number
        unit?: string
        costPerUnit?: number
      } = {
        name: fabricName.trim(),
        unit: fabricUnit.trim() || 'Yards',
      }
      if (fabricColor.trim()) payload.color = fabricColor.trim()
      if (!isNaN(qty)) payload.quantity = qty
      if (!isNaN(cost)) payload.costPerUnit = cost

      await createFabricMutation.mutateAsync(payload)
      toastApiSaved('Fabric inventory added')
      setFabricModalOpen(false)
      setFabricName('')
      setFabricColor('')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Failed to add fabric')
    }
  }

  const handleAdjustFabricStock = async () => {
    if (!adjustFabricId) return
    const delta = parseFloat(adjustDelta)
    if (isNaN(delta)) {
      toastFail('Valid adjustment amount is required')
      return
    }

    try {
      await updateFabricMutation.mutateAsync({
        id: adjustFabricId,
        delta,
      })
      toastOk('Fabric inventory stock updated')
      setAdjustFabricId(null)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Failed to adjust stock')
    }
  }

  const handleAdvanceBatchStatus = useCallback(
    async (batchId: string, currentStatus: string) => {
      const nextStage = nextBatchStatus(currentStatus)
      if (!nextStage) {
        toastFail('Batch is already at the last stage')
        return
      }

      try {
        await updateBatchStatusMutation.mutateAsync({
          id: batchId,
          status: nextStage,
        })
        toastOk(`Batch status updated to ${nextStage}`)
      } catch (err) {
        toastFail(err instanceof Error ? err.message : 'Failed to update batch status')
      }
    },
    [updateBatchStatusMutation],
  )

  const rows = useMemo(() => {
    const fabrics = production.data?.fabrics ?? []
    const batches = production.data?.batches ?? []

    if (tab === 'fabric') {
      return fabrics.map((f) => [
        f.name,
        f.color ?? '—',
        `${f.quantity} ${f.unit}`,
        formatBDT(Number(f.costPerUnit || 0)),
        <button
          key={`adj-${f.id}`}
          type="button"
          onClick={() => {
            setAdjustFabricId(f.id)
            setAdjustDelta('10')
          }}
          style={{
            border: '1px solid var(--line)',
            borderRadius: 6,
            padding: '4px 8px',
            background: 'var(--surface)',
            color: 'var(--ink)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Adjust Stock
        </button>,
      ])
    }

    return batches.map((b) => [
      b.productName ?? 'Custom Item',
      `${b.quantity} pcs`,
      <span
        key={b.id}
        style={{
          display: 'inline-flex',
          padding: '2px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          background:
            b.status === 'READY'
              ? 'var(--ok-soft)'
              : b.status === 'SEWING' || b.status === 'CUTTING' || b.status === 'QC'
                ? 'var(--info-soft)'
                : 'var(--surface-2)',
          color:
            b.status === 'READY'
              ? 'var(--ok)'
              : b.status === 'SEWING' || b.status === 'CUTTING' || b.status === 'QC'
                ? 'var(--info)'
                : 'var(--ink-2)',
        }}
      >
        {b.status}
      </span>,
      b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '—',
      b.status !== 'READY' && b.status !== 'CANCELLED' ? (
        <button
          key={`adv-${b.id}`}
          type="button"
          onClick={() => void handleAdvanceBatchStatus(b.id, b.status)}
          style={{
            border: '1px solid var(--line)',
            borderRadius: 6,
            padding: '4px 8px',
            background: 'var(--violet-soft)',
            color: 'var(--violet)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Advance →
        </button>
      ) : null,
    ])
  }, [tab, production.data, handleAdvanceBatchStatus])

  return (
    <>
      <DcHubFrame
        crumbGroup="Production"
        title="Production"
        queries={[production]}
        empty={rows.length === 0}
        emptyState={{
          icon: 'icon-scissors',
          title: tab === 'batches' ? 'No production batches yet' : 'No fabrics in inventory',
          body:
            tab === 'batches'
              ? 'Production tracks fabric inventory through cutting, sewing and QC. Create a batch to begin following it through the line.'
              : 'Add fabric stock with units and unit cost to track raw materials in production.',
        }}
        actions={[
          tab === 'batches'
            ? {
                label: 'Create batch',
                icon: 'icon-plus',
                variant: 'primary',
                onClick: () => setBatchModalOpen(true),
              }
            : {
                label: 'Add fabric',
                icon: 'icon-plus',
                variant: 'primary',
                onClick: () => setFabricModalOpen(true),
              },
        ]}
      >
        <HubTabs
          tabs={[
            { id: 'batches', label: 'Batches' },
            { id: 'fabric', label: 'Fabric inventory' },
          ]}
          active={tab}
          onChange={(id) => setTab(id as 'batches' | 'fabric')}
        />
        <HubKpis
          items={[
            { label: 'Batches', value: production.data?.batches?.length ?? 0 },
            { label: 'Fabrics', value: production.data?.fabrics?.length ?? 0 },
          ]}
        />
        <HubTable
          columns={
            tab === 'fabric'
              ? ['Fabric', 'Color', 'Qty', 'Cost / unit', '']
              : ['Product', 'Qty', 'Status', 'Created', '']
          }
          rows={rows}
        />
      </DcHubFrame>

      {/* CREATE BATCH MODAL */}
      <DcModal
        open={batchModalOpen}
        title="Create Production Batch"
        subtitle="Start a new production run through cutting, sewing and QC."
        confirmLabel="Create Batch"
        busy={createBatchMutation.isPending}
        onClose={() => setBatchModalOpen(false)}
        onConfirm={() => void handleCreateBatch()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
          <DcField
            label="Product Name *"
            value={batchProduct}
            onChange={setBatchProduct}
            placeholder="e.g. Linen Oxford Shirt, Silk Scarf"
          />
          <DcField
            label="Quantity (Pcs) *"
            value={batchQuantity}
            onChange={setBatchQuantity}
            placeholder="50"
          />
          <DcField
            label="Assigned Tailor / Team"
            value={batchTailor}
            onChange={setBatchTailor}
            placeholder="e.g. Master Rafiq, Workshop A"
          />
          <DcField
            label="Production Notes"
            value={batchNotes}
            onChange={setBatchNotes}
            placeholder="Cutting patterns, dye instructions..."
          />
        </div>
      </DcModal>

      {/* ADD FABRIC MODAL */}
      <DcModal
        open={fabricModalOpen}
        title="Add Fabric Inventory"
        subtitle="Record raw fabric rolls and material costs."
        confirmLabel="Add Fabric"
        busy={createFabricMutation.isPending}
        onClose={() => setFabricModalOpen(false)}
        onConfirm={() => void handleCreateFabric()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
          <DcField
            label="Fabric Name *"
            value={fabricName}
            onChange={setFabricName}
            placeholder="e.g. 100% Egyptian Cotton, Silk Twill"
          />
          <DcField
            label="Color / Shade"
            value={fabricColor}
            onChange={setFabricColor}
            placeholder="e.g. Navy Blue, Ivory, Olive"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <DcField
              label="Quantity"
              value={fabricQty}
              onChange={setFabricQty}
              placeholder="100"
            />
            <DcField
              label="Unit"
              value={fabricUnit}
              onChange={setFabricUnit}
              placeholder="Yards / Meters"
            />
          </div>
          <DcField
            label="Cost per Unit (BDT)"
            value={fabricCost}
            onChange={setFabricCost}
            placeholder="350"
          />
        </div>
      </DcModal>

      {/* ADJUST FABRIC STOCK MODAL */}
      <DcModal
        open={Boolean(adjustFabricId)}
        title="Adjust Fabric Stock"
        subtitle="Add or deduct quantity (+/-) from stock."
        confirmLabel="Update Stock"
        busy={updateFabricMutation.isPending}
        onClose={() => setAdjustFabricId(null)}
        onConfirm={() => void handleAdjustFabricStock()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
          <DcField
            label="Quantity Delta (+ to add, - to consume)"
            value={adjustDelta}
            onChange={setAdjustDelta}
            placeholder="+10 or -15"
          />
        </div>
      </DcModal>
    </>
  )
}

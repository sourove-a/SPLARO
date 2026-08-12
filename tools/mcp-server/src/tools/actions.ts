import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { reply, replyError } from '../format.ts'
import { nestWriteBearer, getMcpAuth, hasMcpWriteScope } from '../auth-context.ts'
import { prisma, storeId } from '../prisma.ts'
import { log } from '../env.ts'

function apiBase(): string {
  return (
    process.env['SPLARO_API_BASE']?.trim() ||
    process.env['API_INTERNAL_URL']?.trim() ||
    'http://127.0.0.1:4000/api/v1'
  ).replace(/\/+$/, '')
}

async function nestFetch(
  path: string,
  init: { method: string; body?: unknown },
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const bearer = nestWriteBearer()
  if (!bearer) {
    return {
      ok: false,
      status: 401,
      data: {
        message:
          'No MCP auth token available for Nest writes. Connect with a link token or set MCP_API_KEY / SPLARO_MCP_SERVICE_TOKEN.',
      },
    }
  }
  if (!hasMcpWriteScope()) {
    return {
      ok: false,
      status: 403,
      data: { message: 'MCP token lacks mcp:write scope' },
    }
  }

  try {
    const res = await fetch(`${apiBase()}${path.startsWith('/') ? path : `/${path}`}`, {
      method: init.method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${bearer}`,
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(20_000),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    log(`Nest write failed: ${err instanceof Error ? err.message : String(err)}`)
    return {
      ok: false,
      status: 503,
      data: { message: err instanceof Error ? err.message : 'Nest API unreachable' },
    }
  }
}

export function registerActionTools(server: McpServer): void {
  server.registerTool(
    'update_inventory_stock',
    {
      title: 'Update Product Variant Stock Quantity',
      description:
        'Adjust stock quantity for a product variant via Nest API (confirm=true required). Use confirm=false to preview.',
      inputSchema: {
        variantId: z.string().describe('ProductVariant ID'),
        newStock: z.number().int().min(0).describe('New stock quantity'),
        reason: z.string().optional().describe('Reason for adjustment e.g. RESTOCK, AUDIT_CORRECTION'),
        confirm: z
          .boolean()
          .optional()
          .describe('Set to true to execute mutation. Defaults to false (dry-run).'),
      },
    },
    async ({ variantId, newStock, reason, confirm }) => {
      const store = (getMcpAuth()?.storeId?.trim() || (await storeId())) as string

      const variant = await prisma().productVariant.findFirst({
        where: { id: variantId, product: { storeId: store } },
        include: { product: { select: { id: true, name: true } } },
      })

      if (!variant) {
        return replyError(`Variant "${variantId}" not found in store catalog.`)
      }

      const previousStock = variant.stock
      const delta = newStock - previousStock

      if (!confirm) {
        return reply({
          mode: 'PREVIEW (dryRun)',
          product: variant.product.name,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          currentStock: previousStock,
          proposedStock: newStock,
          delta: delta > 0 ? `+${delta}` : `${delta}`,
          reason: reason ?? 'MANUAL_ADJUSTMENT',
          message: 'To execute this change, call update_inventory_stock with confirm: true.',
        })
      }

      const result = await nestFetch(`/admin/products/${variant.product.id}/variants/${variantId}`, {
        method: 'PATCH',
        body: {
          stock: newStock,
          stockReason: reason ?? 'MCP_ADJUSTMENT',
        },
      })

      if (!result.ok) {
        return replyError(
          typeof result.data.message === 'string'
            ? result.data.message
            : `Stock update failed (HTTP ${result.status})`,
        )
      }

      return reply({
        status: 'SUCCESS',
        product: variant.product.name,
        sku: variant.sku,
        previousStock,
        newStock,
        message: `Successfully updated stock for ${variant.product.name} (${variant.sku}) from ${previousStock} to ${newStock}.`,
      })
    },
  )

  server.registerTool(
    'update_order_status',
    {
      title: 'Update Order Status',
      description:
        'Transitions an order status via Nest OrderStatusService (CONFIRMED, PROCESSING, PACKED, CANCELLED). confirm=true required.',
      inputSchema: {
        orderId: z.string().describe('Order ID or Invoice Number e.g. SPL-1004'),
        newStatus: z
          .enum(['CONFIRMED', 'PROCESSING', 'PACKED', 'CANCELLED'])
          .describe('Target Order Status'),
        confirm: z
          .boolean()
          .optional()
          .describe('Set to true to execute mutation. Defaults to false (dry-run).'),
      },
    },
    async ({ orderId, newStatus, confirm }) => {
      const store = (getMcpAuth()?.storeId?.trim() || (await storeId())) as string

      const order = await prisma().order.findFirst({
        where: {
          storeId: store,
          OR: [{ id: orderId }, { invoiceNumber: { equals: orderId, mode: 'insensitive' } }],
        },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          shippingName: true,
        },
      })

      if (!order) {
        return replyError(`Order "${orderId}" not found.`)
      }

      if (order.status === newStatus) {
        return reply({
          status: 'NO_CHANGE',
          order: order.invoiceNumber ?? order.id,
          currentStatus: order.status,
          message: `Order is already in status "${newStatus}".`,
        })
      }

      if (!confirm) {
        return reply({
          mode: 'PREVIEW (dryRun)',
          order: order.invoiceNumber ?? order.id,
          customer: order.shippingName,
          currentStatus: order.status,
          proposedStatus: newStatus,
          message: `To execute status change to ${newStatus}, set confirm: true.`,
        })
      }

      const result = await nestFetch(`/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        body: { status: newStatus, note: 'Updated via SPLARO MCP' },
      })

      if (!result.ok) {
        return replyError(
          typeof result.data.message === 'string'
            ? result.data.message
            : `Order status update failed (HTTP ${result.status})`,
        )
      }

      return reply({
        status: 'SUCCESS',
        order: order.invoiceNumber ?? order.id,
        previousStatus: order.status,
        newStatus,
        message: `Order ${order.invoiceNumber ?? order.id} status updated from ${order.status} to ${newStatus}.`,
      })
    },
  )
}

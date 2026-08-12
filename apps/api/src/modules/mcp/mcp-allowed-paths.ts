/**
 * Paths an MCP link token may call on Nest.
 * Keep this tight — tokens must NOT become full SUPER_ADMIN for arbitrary admin APIs.
 */
export function isMcpAllowedApiPath(pathNorm: string, method: string): boolean {
  const m = method.toUpperCase()

  // Order status — OrderStatusService.applyStatusChange
  if (m === 'PATCH' && /^admin\/orders\/[^/]+\/status$/.test(pathNorm)) {
    return true
  }

  // Variant stock / fields — products.updateVariant (+ inventoryLog)
  if (m === 'PATCH' && /^admin\/products\/[^/]+\/variants\/[^/]+$/.test(pathNorm)) {
    return true
  }

  return false
}

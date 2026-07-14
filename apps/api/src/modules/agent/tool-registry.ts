import { AGENT_TOOL_DEFINITIONS } from './tools/agent-tools.definitions'
import type { AgentToolDefinition } from './agent.types'

export type ToolCategory =
  | 'analytics'
  | 'orders'
  | 'inventory'
  | 'products'
  | 'seo'
  | 'diagnostics'
  | 'integrations'
  | 'meta'

export type ToolTier = 'READ' | 'WRITE' | 'DANGEROUS'

export interface ToolRegistryEntry extends AgentToolDefinition {
  category: ToolCategory
  tier: ToolTier
}

const TIER_BY_NAME: Record<string, ToolTier> = {
  get_store_analytics: 'READ',
  get_order_list: 'READ',
  get_order_detail: 'READ',
  get_low_stock_products: 'READ',
  get_seo_gaps: 'READ',
  get_top_customers: 'READ',
  get_orders_by_phone: 'READ',
  get_partner_finance: 'READ',
  get_admin_health_report: 'READ',
  get_integration_status: 'READ',
  get_api_route_health: 'READ',
  get_store_health: 'READ',
  get_conversation_history: 'READ',
  analyze_product_seo: 'READ',
  create_product_draft: 'WRITE',
  update_product: 'WRITE',
  send_telegram_message: 'WRITE',
  update_order_status: 'DANGEROUS',
  book_order_courier: 'DANGEROUS',
  fix_missing_seo_meta: 'DANGEROUS',
  update_system_prompt: 'DANGEROUS',
}

const CATEGORY_BY_NAME: Record<string, ToolCategory> = {
  get_store_analytics: 'analytics',
  get_top_customers: 'analytics',
  get_partner_finance: 'analytics',
  get_store_health: 'analytics',
  get_order_list: 'orders',
  get_order_detail: 'orders',
  get_orders_by_phone: 'orders',
  update_order_status: 'orders',
  book_order_courier: 'orders',
  get_low_stock_products: 'inventory',
  get_seo_gaps: 'seo',
  fix_missing_seo_meta: 'seo',
  analyze_product_seo: 'seo',
  create_product_draft: 'products',
  update_product: 'products',
  get_admin_health_report: 'diagnostics',
  get_api_route_health: 'diagnostics',
  get_integration_status: 'integrations',
  send_telegram_message: 'integrations',
  get_conversation_history: 'meta',
  update_system_prompt: 'meta',
}

const ANALYZE_PRODUCT_SEO: AgentToolDefinition = {
  name: 'analyze_product_seo',
  description:
    'Score SEO quality for one product (title/meta/slug length, missing fields). Use before improving meta. productId or slug required.',
  parameters: {
    type: 'object',
    properties: {
      productId: { type: 'string' },
      slug: { type: 'string' },
    },
  },
}

const ALL_DEFINITIONS: AgentToolDefinition[] = [
  ...AGENT_TOOL_DEFINITIONS,
  ANALYZE_PRODUCT_SEO,
]

export const AGENT_TOOL_REGISTRY: ToolRegistryEntry[] = ALL_DEFINITIONS.map((def) => ({
  ...def,
  tier: TIER_BY_NAME[def.name] ?? 'READ',
  category: CATEGORY_BY_NAME[def.name] ?? 'diagnostics',
}))

export function getToolEntry(name: string): ToolRegistryEntry | undefined {
  return AGENT_TOOL_REGISTRY.find((t) => t.name === name)
}

export function getToolTier(name: string): ToolTier {
  return getToolEntry(name)?.tier ?? 'READ'
}

export function isDangerousTool(name: string): boolean {
  return getToolTier(name) === 'DANGEROUS'
}

/** WRITE tools that touch live catalog money/visibility need explicit confirm. */
export function toolRequiresConfirm(name: string, args: Record<string, unknown> = {}): boolean {
  if (isDangerousTool(name)) return true
  if (name === 'update_product') {
    return (
      args.isPublished !== undefined ||
      args.price !== undefined ||
      args.basePrice !== undefined ||
      args.stock !== undefined ||
      args.stockQuantity !== undefined
    )
  }
  return false
}

export function registryToDefinitions(entries: ToolRegistryEntry[]): AgentToolDefinition[] {
  return entries.map(({ name, description, parameters }) => ({ name, description, parameters }))
}

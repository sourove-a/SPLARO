import type { AgentToolDefinition } from '../agent.types'

export const AGENT_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    name: 'get_store_analytics',
    description:
      'Orders and revenue for today/week/month, top products, abandoned carts. Use when admin asks: sale, revenue, aja koto order, earnings.',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month'], description: 'Time window' },
      },
    },
  },
  {
    name: 'get_order_list',
    description:
      'Paginated orders filtered by status or date. Use when admin asks: order list, pending orders, ordar dekhao, kon order ache.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Order status e.g. PENDING, DELIVERED' },
        limit: { type: 'number', description: 'Max rows (default 10)' },
      },
    },
  },
  {
    name: 'get_low_stock_products',
    description: 'Products where any variant stock is below threshold',
    parameters: {
      type: 'object',
      properties: {
        threshold: { type: 'number', description: 'Stock threshold (default 10)' },
      },
    },
  },
  {
    name: 'get_seo_gaps',
    description: 'Products missing metaTitle, metaDescription, or slug',
    parameters: { type: 'object', properties: { limit: { type: 'number' } } },
  },
  {
    name: 'get_top_customers',
    description: 'Customers ranked by order count and total spend',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Default 5' } },
    },
  },
  {
    name: 'create_product_draft',
    description: 'Create a draft product with name, description, SEO fields',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        metaTitle: { type: 'string' },
        metaDescription: { type: 'string' },
        slug: { type: 'string' },
        price: { type: 'number' },
        categoryId: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_product',
    description: 'Patch product fields by product id or slug',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        slug: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        metaTitle: { type: 'string' },
        metaDescription: { type: 'string' },
        price: { type: 'number' },
        isPublished: { type: 'boolean' },
      },
    },
  },
  {
    name: 'send_telegram_message',
    description: 'Send a message to the configured Telegram admin chat',
    parameters: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message'],
    },
  },
  {
    name: 'update_system_prompt',
    description: 'Replace the agent system prompt (self-update). Never change API keys.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'get_store_health',
    description: 'Quick store KPI snapshot: orders today, revenue, low stock count, SEO gaps, top customer',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_admin_health_report',
    description:
      'Full admin panel diagnostic: infrastructure, failed API routes, disconnected integrations, AI agent status, inventory/SEO problems. Use when admin asks what is wrong or what problems exist.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_integration_status',
    description:
      'Telegram, OpenAI, payments, couriers (Steadfast/Pathao), email connectivity. Use when admin says: connection nai, integrate hocche na, API key, courier connect.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_api_route_health',
    description: 'Probe all admin API routes and list failed or degraded endpoints',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_conversation_history',
    description: 'Last N conversation turns for this session',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
  },
]

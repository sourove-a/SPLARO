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
    name: 'get_orders_by_phone',
    description:
      'Find customer + orders by Bangladesh phone (shipping phone or customer phone). Use for: ei number er order, COD phone lookup, 017… / 01xxxxxxxxx.',
    parameters: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Phone e.g. 01712345678 or +88017…' },
        limit: { type: 'number', description: 'Max orders (default 10)' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'create_product_draft',
    description: 'Create a draft product with name, description, SEO fields (WRITE — no confirm)',
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
    description:
      'Patch product by id or slug. Meta/name/description = WRITE. Price, publish, or stock changes require confirm before execute.',
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
        stock: { type: 'number', description: 'Set stock on first variant (or variantSku)' },
        variantSku: { type: 'string', description: 'Optional SKU when updating stock' },
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
  {
    name: 'get_partner_finance',
    description:
      'Partner balances, share %, pending withdrawals/expenses. Use when admin asks: partner hisab, balance, withdrawal pending, finance summary.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_order_detail',
    description:
      'Single order by id or invoice number. Use when admin asks about a specific order, tracking, or customer on one order.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order UUID' },
        invoiceNumber: { type: 'string', description: 'Human invoice e.g. SPL-1001' },
      },
    },
  },
  {
    name: 'update_order_status',
    description:
      'Change order status (CONFIRMED, PROCESSING, PACKED, SHIPPED, DELIVERED, CANCELLED). Use when admin says confirm order, cancel, mark delivered.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        invoiceNumber: { type: 'string' },
        status: {
          type: 'string',
          enum: ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
        },
        note: { type: 'string', description: 'Optional internal note' },
      },
      required: ['status'],
    },
  },
  {
    name: 'book_order_courier',
    description:
      'Book Steadfast (or other) courier for an order. Use when admin says courier book, steadfast book, delivery pathao. Returns real consignmentId or honest error.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        invoiceNumber: { type: 'string' },
        provider: { type: 'string', description: 'STEADFAST default. Also PATHAO, REDX, PAPERFLY' },
      },
    },
  },
  {
    name: 'fix_missing_seo_meta',
    description:
      'Auto-fill missing metaTitle/metaDescription for published products (batch). Use when admin says shob product er SEO fix, meta missing fix koro.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max products to fix in one run (default 25)' },
      },
    },
  },
]

export type AgentToolCatalogTier = 'READ' | 'WRITE' | 'DANGEROUS'

export interface AgentToolCatalogEntry {
  name: string
  label: string
  labelBn: string
  when: string
  tier: AgentToolCatalogTier
}

export const AGENT_TOOL_CATALOG: AgentToolCatalogEntry[] = [
  { name: 'get_store_health', label: 'Store pulse', labelBn: 'দ্রুত KPI', when: 'আজকের order, revenue, stock, SEO', tier: 'READ' },
  { name: 'get_admin_health_report', label: 'Full diagnostic', labelBn: 'সম্পূর্ণ ডায়াগনস্টিক', when: 'problem ki / কী ভুল', tier: 'READ' },
  { name: 'get_store_analytics', label: 'Analytics', labelBn: 'বিক্রয় বিশ্লেষণ', when: 'sale, revenue, period', tier: 'READ' },
  { name: 'get_order_list', label: 'Order list', labelBn: 'অর্ডার লিস্ট', when: 'pending / order list', tier: 'READ' },
  { name: 'get_order_detail', label: 'Order detail', labelBn: 'একটা অর্ডার', when: 'invoice / specific order', tier: 'READ' },
  { name: 'get_orders_by_phone', label: 'Phone lookup', labelBn: 'নম্বর দিয়ে অর্ডার', when: 'ei number er order / COD phone', tier: 'READ' },
  { name: 'update_order_status', label: 'Status change', labelBn: 'স্ট্যাটাস বদল', when: 'confirm, cancel, delivered', tier: 'DANGEROUS' },
  { name: 'book_order_courier', label: 'Courier book', labelBn: 'কুরিয়ার বুক', when: 'Steadfast book', tier: 'DANGEROUS' },
  { name: 'get_partner_finance', label: 'Partner finance', labelBn: 'পার্টনার হিসাব', when: 'balance, withdrawal', tier: 'READ' },
  { name: 'get_low_stock_products', label: 'Low stock', labelBn: 'স্টক কম', when: 'stock kom', tier: 'READ' },
  { name: 'get_seo_gaps', label: 'SEO gaps', labelBn: 'SEO গ্যাপ', when: 'meta missing', tier: 'READ' },
  { name: 'fix_missing_seo_meta', label: 'SEO auto-fix', labelBn: 'SEO অটো ফিক্স', when: 'shob product SEO', tier: 'DANGEROUS' },
  { name: 'get_top_customers', label: 'Top customers', labelBn: 'টপ কাস্টমার', when: 'best buyer', tier: 'READ' },
  { name: 'create_product_draft', label: 'Product draft', labelBn: 'প্রোডাক্ট ড্রাফট', when: 'নতুন product', tier: 'WRITE' },
  { name: 'update_product', label: 'Update product', labelBn: 'প্রোডাক্ট আপডেট', when: 'meta WRITE; price/publish/stock → confirm', tier: 'WRITE' },
  { name: 'get_integration_status', label: 'Integrations', labelBn: 'ইন্টিগ্রেশন', when: 'connection nai', tier: 'READ' },
  { name: 'get_api_route_health', label: 'API routes', labelBn: 'API রুট', when: 'API down', tier: 'READ' },
  { name: 'send_telegram_message', label: 'Telegram send', labelBn: 'টেলিগ্রাম', when: 'message pathao', tier: 'WRITE' },
]

export const AGENT_TOOL_TIERS: AgentToolCatalogTier[] = ['READ', 'WRITE', 'DANGEROUS']

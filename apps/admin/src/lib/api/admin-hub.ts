import { apiFetch } from './client'

export interface ContentBlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  status: string
  viewCount: number
  publishedAt: string | null
  updatedAt: string
  category?: { name: string } | null
}

export interface ContentOverview {
  posts: ContentBlogPost[]
  categories: { id: string; name: string; slug: string }[]
  banners: { id: string; title?: string | null; image: string; position: string; isActive: boolean }[]
  collections: {
    id: string
    name: string
    slug: string
    isActive: boolean
    updatedAt: string
    _count?: { products: number }
  }[]
  campaigns: { id: string; name: string; status: string; type: string; totalSent: number; createdAt: string }[]
  staticPages: { id: string; slug: string; title: string; blocks: number; status: string; updatedAt: string }[]
}

export interface SeoOverview {
  keywords: { id: string; keyword: string; volume: number; position: number; change: string; difficulty: number; status: string }[]
  indexPages: { url: string; google: string; bing: string; lastCrawl: string; status: string }[]
  schemas: { id: string; type: string; pages: number; valid: number; errors: number; lastCheck: string }[]
  sitemaps: { id: string; name: string; urls: number; lastGen: string; submitted: string; status: string }[]
  redirects: {
    id: string
    from: string
    to: string
    type: string
    hits: number
    status: string
    source?: 'rule' | 'canonical'
    note?: string | null
    isActive?: boolean
  }[]
  productAudits: { id: string; name: string; slug: string; score: number; hasMetaTitle: boolean; hasMetaDescription: boolean; lastAuditAt: string | null }[]
  summary: { avgScore: number; criticalErrors: number; warnings: number; products: number }
}

export interface MarketingOverview {
  affiliates: {
    id: string
    name: string
    email: string | null
    code: string
    commissionRate: string | number
    totalEarned: string | number
    pendingPayout: string | number
    status: string
  }[]
  campaigns: { id: string; name: string; status: string; type: string; totalSent: number; totalClicked: number; createdAt: string }[]
  whatsappLogs: { id: string; recipient: string; subject: string | null; body: string | null; status: string; createdAt: string }[]
  whatsappCampaigns: { id: string; name: string; status: string; totalSent: number }[]
  emailCampaigns: { id: string; name: string; status: string; totalSent: number }[]
  emailLogs: { id: string; recipient: string; subject: string | null; body: string | null; status: string; createdAt: string }[]
  smsLogs: { id: string; recipient: string; subject: string | null; body: string | null; status: string; createdAt: string }[]
}

export function fetchContentOverview() {
  return apiFetch<ContentOverview>('/admin/hub/content/overview')
}

export function createBlogPost(data: { title: string; content?: string; excerpt?: string; status?: 'DRAFT' | 'PUBLISHED' }) {
  return apiFetch<ContentBlogPost>('/admin/hub/content/blog', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function fetchSeoOverview() {
  return apiFetch<SeoOverview>('/admin/hub/seo/overview')
}

export function fetchMarketingOverview() {
  return apiFetch<MarketingOverview>('/admin/hub/marketing/overview')
}

export function createAffiliate(data: { name: string; email?: string; code: string; commissionRate?: number }) {
  return apiFetch('/admin/hub/marketing/affiliates', { method: 'POST', body: JSON.stringify(data) })
}

export function createSupplier(data: { name: string; phone?: string; email?: string; address?: string }) {
  return apiFetch('/admin/hub/procurement/suppliers', { method: 'POST', body: JSON.stringify(data) })
}

export function createPurchaseOrder(data: {
  supplierId: string
  notes?: string
  items: { productName: string; sku?: string; quantity: number; unitCost: number }[]
}) {
  return apiFetch<{ id: string; poNumber: string }>('/admin/hub/procurement/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function createSupportTicket(data: { subject: string; message?: string; channel?: string; priority?: string }) {
  return apiFetch('/admin/hub/support/tickets', { method: 'POST', body: JSON.stringify(data) })
}

export interface NotificationsOverview {
  logs: {
    id: string
    channel: string
    recipient: string
    subject: string | null
    body: string | null
    status: string
    createdAt: string
  }[]
  summary: { total: number; sent: number; failed: number; pending: number; deliveredRate: number }
}

export interface CommerceSubscriptionRow {
  id: string
  customer: string
  plan: string
  frequency: string
  amount: number
  nextBill: string
  status: string
  orders: number
  updatedAt: string
}

export function fetchNotificationsOverview() {
  return apiFetch<NotificationsOverview>('/admin/hub/notifications/overview')
}

export function fetchCommerceSubscriptions() {
  return apiFetch<CommerceSubscriptionRow[]>('/admin/hub/commerce/subscriptions')
}

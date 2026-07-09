import { getApiBaseUrl } from '@splaro/config'
import { apiFetch } from './client'

export interface SeoProductAuditResult {
  productId: string
  score: number
  issues: { type: string; field: string; message: string }[]
  suggestions?: string[]
}

export function auditProduct(productId: string, siteUrl?: string) {
  const site = siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.co'
  return apiFetch<SeoProductAuditResult>(
    `/seo/audit/product/${productId}?siteUrl=${encodeURIComponent(site)}`,
    { method: 'POST' },
  )
}

export function getLiveSitemapUrl(storeId?: string, siteUrl?: string) {
  const store = storeId ?? process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'
  const site = siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.co'
  return `${getApiBaseUrl()}/seo/sitemap/${encodeURIComponent(store)}?siteUrl=${encodeURIComponent(site)}`
}

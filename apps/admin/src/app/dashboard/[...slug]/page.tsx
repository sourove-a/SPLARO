import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { DcOrders } from '@/components/orders/DcOrders'
import { DcProducts } from '@/components/products/DcProducts'
import { DcCustomers } from '@/components/customers/DcCustomers'
import { DcCustomer360 } from '@/components/dc/screens/DcCustomer360'
import { DcProductEdit } from '@/components/dc/screens/DcProductEdit'
import { DcProductNew } from '@/components/dc/screens/DcProductNew'
import { DcOrderNew } from '@/components/dc/screens/DcOrderNew'
import { DcOrderDetail } from '@/components/dc/screens/DcOrderDetail'
import { DcPackingStation } from '@/components/operations/DcPackingStation'
import { DcCourierHub } from '@/components/courier/DcCourierHub'
import { DcPartnerHub } from '@/components/finance/DcPartnerHub'
import { DcDailyClosing } from '@/components/finance/DcDailyClosing'
import { DcSettings } from '@/components/settings/DcSettings'
import { DcMobileScreens } from '@/components/dc/DcMobileScreens'
import { DcExports } from '@/components/dc/screens/DcExports'
import { DcLegalPages } from '@/components/dc/screens/DcLegalPages'
import { DcHeroSlider } from '@/components/dc/screens/DcHeroSlider'
import { DcMenuControl } from '@/components/dc/screens/DcMenuControl'
import { DcProductReviews } from '@/components/dc/screens/DcProductReviews'
import { DcCollections } from '@/components/dc/screens/DcCollections'
import { DcCategories } from '@/components/dc/screens/DcCategories'
import { DcInventory } from '@/components/dc/screens/DcInventory'
import { DcAdminUsers } from '@/components/dc/screens/DcAdminUsers'
import { DcSecurityCenter } from '@/components/dc/screens/DcSecurityCenter'
import { DcAiCommandBrain } from '@/components/dc/screens/DcAiCommandBrain'
import { DcManusTasks } from '@/components/dc/screens/DcManusTasks'
import { DcSeoHealth } from '@/components/dc/screens/DcSeoHealth'
import { DcAutomationRules } from '@/components/dc/screens/DcAutomationRules'
import { DcAllIntegrations } from '@/components/dc/screens/DcAllIntegrations'
import { DcMediaLibrary } from '@/components/dc/screens/DcMediaLibrary'
import { DcHomePage } from '@/components/dc/screens/DcHomePage'
import { DcApiHealth } from '@/components/dc/screens/DcApiHealth'
import { DcWarehouseStock } from '@/components/dc/screens/DcWarehouseStock'
import { DcPurchaseOrders } from '@/components/dc/screens/DcPurchaseOrders'
import { DcReturnsRma } from '@/components/dc/screens/DcReturnsRma'
import { DcOperationsHub } from '@/components/dc/screens/DcOperationsHub'
import { DcFinanceOverview } from '@/components/dc/screens/DcFinanceOverview'
import { DcProfitLoss } from '@/components/dc/screens/DcProfitLoss'
import { DcCoupons } from '@/components/dc/screens/DcCoupons'
import { DcCampaigns } from '@/components/dc/screens/DcCampaigns'
import { DcSmsCenter } from '@/components/dc/screens/DcSmsCenter'
import { DcGoogleSheets } from '@/components/dc/screens/DcGoogleSheets'
import { DcBulkCsv } from '@/components/dc/screens/DcBulkCsv'
import { DcAnalytics } from '@/components/dc/screens/DcAnalytics'
import { DcBlog } from '@/components/dc/screens/DcBlog'
import { DcCmsPages, DcLandingPages } from '@/components/dc/screens/DcSitePages'
import { DcLookbooks } from '@/components/dc/screens/DcLookbooks'
import { DcReels } from '@/components/dc/screens/DcReels'
import { DcThemeBuilder } from '@/components/dc/screens/DcThemeBuilder'
import { DcFootwearPage } from '@/components/dc/screens/DcFootwearPage'
import { DcCommerceExtras } from '@/components/dc/screens/DcCommerceExtras'
import { DcBrands } from '@/components/dc/screens/DcBrands'
import { DcWebhooks } from '@/components/dc/screens/DcWebhooks'
import { DcHelpdesk } from '@/components/dc/screens/DcHelpdesk'
import { DcDeliveryOps } from '@/components/dc/screens/DcDeliveryOps'
import { DcCompanyOs } from '@/components/dc/screens/DcCompanyOs'
import { DcProduction } from '@/components/dc/screens/DcProduction'
import { DcGoogleWorkspaceExtras } from '@/components/dc/screens/DcGoogleWorkspaceExtras'
import { DcSystemLogs } from '@/components/dc/screens/DcSystemLogs'
import { DcPlatformDev } from '@/components/dc/screens/DcPlatformDev'
import { DcNotificationCenter } from '@/components/dc/screens/DcNotificationCenter'
import { resolveAliasRedirect } from '@/lib/navigation/alias-redirects'
import { resolveNavRoute, getRecordIdFromSubPath } from '@/lib/navigation/admin-nav'

/**
 * Screens the design specifies as bespoke layouts rather than block lists.
 * They render their own header chrome (no AdminPageShell).
 */
const DC_BESPOKE: Record<string, () => React.ReactElement> = {
  '/dashboard/orders': () => <DcOrders />,
  '/dashboard/products': () => <DcProducts />,
  '/dashboard/customers': () => <DcCustomers />,
  '/dashboard/packing-station': () => <DcPackingStation />,
  '/dashboard/courier-hub': () => <DcCourierHub />,
  '/dashboard/finance/partner-accounts': () => <DcPartnerHub />,
  '/dashboard/finance/daily-closing': () => <DcDailyClosing />,
  '/dashboard/settings': () => <DcSettings />,
  '/dashboard/mobile-screens': () => <DcMobileScreens />,
  '/dashboard/executive/export-center': () => <DcExports />,
  '/dashboard/executive/notification-center': () => <DcNotificationCenter />,
  '/dashboard/legal-pages': () => <DcLegalPages />,
  '/dashboard/hero-slider': () => <DcHeroSlider />,
  '/dashboard/menu-control': () => <DcMenuControl />,
  '/dashboard/product-reviews': () => <DcProductReviews />,
  '/dashboard/collections': () => <DcCollections />,
  '/dashboard/categories': () => <DcCategories />,
  '/dashboard/inventory': () => <DcInventory />,
  '/dashboard/admin-users': () => <DcAdminUsers />,
  '/dashboard/security-center': () => <DcSecurityCenter />,
  '/dashboard/ai-agent': () => <DcAiCommandBrain />,
  '/dashboard/manus': () => <DcManusTasks />,
  '/dashboard/seo-health': () => <DcSeoHealth />,
  '/dashboard/automation-rules': () => <DcAutomationRules />,
  '/dashboard/all-integrations': () => <DcAllIntegrations />,
  '/dashboard/media-library': () => <DcMediaLibrary />,
  '/dashboard/home-page': () => <DcHomePage />,
  '/dashboard/api-health': () => <DcApiHealth />,
  '/dashboard/wms/overview': () => <DcWarehouseStock />,
  '/dashboard/procurement/overview': () => <DcPurchaseOrders title="Procurement Hub" />,
  '/dashboard/procurement/purchase-orders': () => <DcPurchaseOrders />,
  '/dashboard/procurement/suppliers': () => <DcPurchaseOrders title="Suppliers" />,
  '/dashboard/procurement/goods-received': () => <DcPurchaseOrders title="Goods Received" />,
  '/dashboard/returns-rma': () => <DcReturnsRma />,
  '/dashboard/operations': () => <DcOperationsHub />,
  '/dashboard/finance/finance-reports': () => <DcFinanceOverview />,
  '/dashboard/finance/profit-loss': () => <DcProfitLoss />,
  '/dashboard/coupons': () => <DcCoupons />,
  '/dashboard/campaigns': () => <DcCampaigns />,
  '/dashboard/sms': () => <DcSmsCenter />,
  '/dashboard/automation/google-sheets-sync': () => <DcGoogleSheets />,
  '/dashboard/bulk': () => <DcBulkCsv />,
  '/dashboard/analytics': () => <DcAnalytics />,
  '/dashboard/footwear-page': () => <DcFootwearPage />,
  '/dashboard/theme-builder': () => <DcThemeBuilder />,
  '/dashboard/lookbooks': () => <DcLookbooks />,
  '/dashboard/reels': () => <DcReels />,
  '/dashboard/blog': () => <DcBlog />,
  '/dashboard/cms': () => <DcCmsPages />,
  '/dashboard/landing-pages': () => <DcLandingPages />,
  // Thin API hubs (all-nav-live)
  '/dashboard/pos': () => <DcCommerceExtras tab="pos" />,
  '/dashboard/invoices': () => <DcCommerceExtras tab="invoices" />,
  '/dashboard/transactions': () => <DcCommerceExtras tab="transactions" />,
  '/dashboard/subscriptions': () => <DcCommerceExtras tab="subscriptions" />,
  '/dashboard/brands': () => <DcBrands />,
  '/dashboard/webhooks': () => <DcWebhooks />,
  '/dashboard/support/helpdesk': () => <DcHelpdesk />,
  '/dashboard/delivery/agents': () => <DcDeliveryOps />,
  '/dashboard/company/dashboard': () => <DcCompanyOs />,
  '/dashboard/production/overview': () => <DcProduction />,
  '/dashboard/google-workspace/connect': () => <DcGoogleWorkspaceExtras tab="connect" />,
  '/dashboard/google-workspace/gmail': () => <DcGoogleWorkspaceExtras tab="gmail" />,
  '/dashboard/google-workspace/drive': () => <DcGoogleWorkspaceExtras tab="drive" />,
  '/dashboard/google-workspace/oauth-settings': () => <DcGoogleWorkspaceExtras tab="oauth" />,
  '/dashboard/google-workspace/sync-logs': () => <DcGoogleWorkspaceExtras tab="logs" />,
  '/dashboard/logs': () => <DcSystemLogs />,
  '/dashboard/developer/api-center': () => <DcPlatformDev tab="developer" />,
  '/dashboard/observability/center': () => <DcPlatformDev tab="observability" />,
}

interface DashboardModulePageProps {
  params: Promise<{ slug: string[] }>
}

export async function generateMetadata({ params }: DashboardModulePageProps): Promise<Metadata> {
  const { slug } = await params
  const alias = resolveAliasRedirect(slug)
  if (alias) {
    return { title: 'Redirect — SPLARO Admin' }
  }
  const resolved = resolveNavRoute(slug)

  if (!resolved) {
    return { title: 'Not Found — SPLARO Admin' }
  }

  return {
    title: `${resolved.pageTitle} — SPLARO Admin`,
    ...(resolved.navItem.description ? { description: resolved.navItem.description } : {}),
  }
}

export default async function DashboardModulePage({ params }: DashboardModulePageProps) {
  const { slug } = await params

  // Alias before nav resolve — bookmarks work after REMOVE from adminNavGroups.
  const aliasEarly = resolveAliasRedirect(slug)
  if (aliasEarly) {
    redirect(aliasEarly)
  }

  const resolved = resolveNavRoute(slug)

  if (!resolved) {
    notFound()
  }

  const { moduleHref, action } = resolved

  if (action === 'create') {
    if (moduleHref === '/dashboard/products') {
      return <DcProductNew moduleHref={moduleHref} />
    }
    if (moduleHref === '/dashboard/orders') {
      return <DcOrderNew moduleHref={moduleHref} />
    }
    // Never soft-lock create shells — send operators to the list hub.
    redirect(moduleHref)
  }

  if (action === 'edit' || action === 'detail') {
    if (moduleHref === '/dashboard/customers') {
      const recordId = getRecordIdFromSubPath(resolved.subPath, action) ?? 'record'
      return <DcCustomer360 customerId={recordId} />
    }

    if (moduleHref === '/dashboard/products') {
      const recordId = getRecordIdFromSubPath(resolved.subPath, action) ?? 'record'
      return <DcProductEdit productId={recordId} moduleHref={moduleHref} />
    }

    if (moduleHref === '/dashboard/orders' && action === 'detail') {
      const recordId = getRecordIdFromSubPath(resolved.subPath, action) ?? 'record'
      return <DcOrderDetail recordId={recordId} moduleHref={moduleHref} />
    }

    // Never soft-lock legacy detail/edit shells.
    redirect(moduleHref)
  }

  const bespoke = DC_BESPOKE[moduleHref]
  if (bespoke) return bespoke()

  // Catch-all: no soft-lock shells — unknown list routes 404.
  notFound()
}

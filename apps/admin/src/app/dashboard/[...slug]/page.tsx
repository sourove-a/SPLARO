import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { DcSoftLockPanel } from '@/components/dc/DcSoftLockPanel'
import { DcOrders } from '@/components/orders/DcOrders'
import { DcProducts } from '@/components/products/DcProducts'
import { DcCustomers } from '@/components/customers/DcCustomers'
import { DcCustomer360 } from '@/components/dc/screens/DcCustomer360'
import { DcProductEdit } from '@/components/dc/screens/DcProductEdit'
import { DcProductNew } from '@/components/dc/screens/DcProductNew'
import { DcOrderNew } from '@/components/dc/screens/DcOrderNew'
import { DcOrderDetail } from '@/components/dc/screens/DcOrderDetail'
import { DcModuleHost } from '@/components/dc/screens/DcModuleHost'
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
import { DcLiveModuleScreen } from '@/components/dc/screens/DcLiveModuleScreen'
import { screenKeyForHref } from '@/components/dc/screens'
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
  '/dashboard/finance/google-sheets-finance': () => <DcGoogleSheets />,
  '/dashboard/coupons': () => <DcCoupons />,
  '/dashboard/campaigns': () => <DcCampaigns />,
  '/dashboard/sms': () => <DcSmsCenter />,
  '/dashboard/automation/google-sheets-sync': () => <DcGoogleSheets />,
  '/dashboard/bulk': () => <DcBulkCsv />,
  '/dashboard/analytics': () => <DcAnalytics />,
}

/** Legacy deep URLs → primary DC screens. */
const ALIAS_REDIRECTS: Record<string, string> = {
  '/dashboard/email-sms': '/dashboard/sms',
  '/dashboard/system-health': '/dashboard/api-health',
  '/dashboard/google-workspace/sheets-sync': '/dashboard/automation/google-sheets-sync',
  '/dashboard/roles': '/dashboard/admin-users',
  '/dashboard/permissions': '/dashboard/admin-users',
  '/dashboard/audit-logs': '/dashboard/security-center',
  '/dashboard/system/telegram-logs': '/dashboard/telegram-bot',
  '/dashboard/warehouse': '/dashboard/wms/overview',
  '/dashboard/wms/warehouses': '/dashboard/wms/overview',
  '/dashboard/wms/transfers': '/dashboard/wms/overview',
  '/dashboard/wms/stock-movements': '/dashboard/inventory',
  '/dashboard/supplier-management': '/dashboard/procurement/suppliers',
  '/dashboard/finance/google-sheets-finance': '/dashboard/automation/google-sheets-sync',
}

interface DashboardModulePageProps {
  params: Promise<{ slug: string[] }>
}

export async function generateMetadata({ params }: DashboardModulePageProps): Promise<Metadata> {
  const { slug } = await params
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
  const resolved = resolveNavRoute(slug)

  if (!resolved) {
    notFound()
  }

  const { navItem, moduleHref, action, pageTitle } = resolved

  const alias = ALIAS_REDIRECTS[moduleHref]
  if (alias && !action) {
    redirect(alias)
  }

  if (action === 'create') {
    if (moduleHref === '/dashboard/products') {
      return <DcProductNew moduleHref={moduleHref} />
    }
    if (moduleHref === '/dashboard/orders') {
      return <DcOrderNew moduleHref={moduleHref} />
    }
    return (
      <DcModuleHost
        navItem={navItem}
        moduleHref={moduleHref}
        action="create"
        title={pageTitle}
        screen="create"
      >
        <DcSoftLockPanel
          title={pageTitle}
          href={moduleHref}
          hint={`Create is handled inside the ${navItem.label} sidebar screen. Legacy create panels are retired.`}
        />
      </DcModuleHost>
    )
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

    const recordId = getRecordIdFromSubPath(resolved.subPath, action) ?? 'record'
    const mode = action === 'edit' ? 'edit' : 'detail'
    return (
      <DcModuleHost
        navItem={navItem}
        moduleHref={moduleHref}
        action={action}
        title={pageTitle}
        screen={mode}
      >
        <DcSoftLockPanel
          title={pageTitle}
          href={moduleHref}
          hint={`Record ${recordId} — open the matching sidebar screen. Legacy ${mode} panels are retired.`}
        />
      </DcModuleHost>
    )
  }

  // List screens — bespoke DC first, then designed live host, else universal host.
  const bespoke = DC_BESPOKE[moduleHref]
  if (bespoke) return bespoke()

  const dcScreen = screenKeyForHref(moduleHref)
  if (dcScreen) {
    return (
      <DcLiveModuleScreen
        screen={dcScreen}
        moduleHref={moduleHref}
        navItem={navItem}
        fallbackTitle={pageTitle}
      />
    )
  }

  return (
    <DcModuleHost navItem={navItem} moduleHref={moduleHref} title={pageTitle} screen="module" />
  )
}

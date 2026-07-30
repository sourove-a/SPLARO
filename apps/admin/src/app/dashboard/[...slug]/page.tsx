import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ModuleCreateView } from '@/components/ui/ModuleCreateView'
import { ModuleDetailView } from '@/components/ui/ModuleDetailView'
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
import { DcLiveModuleScreen } from '@/components/dc/screens/DcLiveModuleScreen'
import { screenKeyForHref } from '@/components/dc/screens'
import { resolveNavRoute, getRecordIdFromSubPath } from '@/lib/navigation/admin-nav'
import { hasBackendCreateApi } from '@/lib/modules/module-maturity'

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
}

/** Detail/create handled inside the module panel via ModuleWorkspace action/subPath. */
const DETAIL_HANDLED_BY_MODULE = new Set([
  '/dashboard/finance/partner-accounts',
  '/dashboard/finance/investments',
  '/dashboard/finance/withdrawals',
  '/dashboard/invoices',
])

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
  const subPath = resolved.subPath.length > 0 ? resolved.subPath : undefined

  if (action === 'create') {
    const hasCreateApi = hasBackendCreateApi(moduleHref)
    if (hasCreateApi && moduleHref === '/dashboard/products') {
      return <DcProductNew moduleHref={moduleHref} />
    }
    if (hasCreateApi && moduleHref === '/dashboard/orders') {
      return <DcOrderNew moduleHref={moduleHref} />
    }
    if (hasCreateApi) {
      return (
        <DcModuleHost
          navItem={navItem}
          moduleHref={moduleHref}
          action="create"
          title={pageTitle}
          screen="create"
          {...(subPath ? { subPath } : {})}
        />
      )
    }
    return (
      <DcModuleHost
        navItem={navItem}
        moduleHref={moduleHref}
        action="create"
        title={pageTitle}
        screen="create"
      >
        <ModuleCreateView moduleLabel={navItem.label} moduleHref={moduleHref} pageTitle={pageTitle} />
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

    if (DETAIL_HANDLED_BY_MODULE.has(moduleHref)) {
      return (
        <DcModuleHost
          navItem={navItem}
          moduleHref={moduleHref}
          action={action}
          title={pageTitle}
          screen="detail"
          {...(subPath ? { subPath } : {})}
        />
      )
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
        <ModuleDetailView navItem={navItem} moduleHref={moduleHref} recordId={recordId} mode={mode} />
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
        {...(subPath ? { subPath } : {})}
      />
    )
  }

  return (
    <DcModuleHost
      navItem={navItem}
      moduleHref={moduleHref}
      title={pageTitle}
      screen="module"
      {...(subPath ? { subPath } : {})}
    />
  )
}

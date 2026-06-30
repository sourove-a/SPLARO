import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AdminPageShell } from '@/components/ui/AdminPageShell'
import { ModuleCreateView } from '@/components/ui/ModuleCreateView'
import { ProductCreatePanel } from '@/components/modules/ProductCreatePanel'
import { OrderCreatePanel } from '@/components/modules/OrderCreatePanel'
import { ModuleDetailView } from '@/components/ui/ModuleDetailView'
import { ModuleWorkspace } from '@/components/modules/ModuleWorkspace'
import { CustomerProfileClient } from '@/components/customers/CustomerProfileClient'
import { resolveNavRoute, getRecordIdFromSubPath } from '@/lib/navigation/admin-nav'

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

  const breadcrumbTrail = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: navItem.group },
    { label: navItem.label, href: moduleHref },
    ...(action ? [{ label: pageTitle }] : []),
  ]

  if (action === 'create') {
    const isProductCreate = moduleHref === '/dashboard/products'
    const isOrderCreate = moduleHref === '/dashboard/orders'
    return (
      <AdminPageShell
        title={pageTitle}
        breadcrumbs={breadcrumbTrail}
        quickActions={[{ label: `Back to ${navItem.label}`, href: moduleHref }]}
      >
        {isProductCreate ? (
          <ProductCreatePanel moduleHref={moduleHref} />
        ) : isOrderCreate ? (
          <OrderCreatePanel moduleHref={moduleHref} />
        ) : (
          <ModuleCreateView moduleLabel={navItem.label} moduleHref={moduleHref} pageTitle={pageTitle} />
        )}
      </AdminPageShell>
    )
  }

  if (action === 'edit' || action === 'detail') {
    if (moduleHref === '/dashboard/customers') {
      const recordId = getRecordIdFromSubPath(resolved.subPath, action) ?? 'record'
      return (
        <AdminPageShell
          title="Customer Profile"
          description="Full 360° customer intelligence view"
          breadcrumbs={breadcrumbTrail}
        >
          <CustomerProfileClient customerId={recordId} />
        </AdminPageShell>
      )
    }

    const detailHandledByModule = [
      '/dashboard/finance/partner-accounts',
      '/dashboard/finance/investments',
      '/dashboard/finance/withdrawals',
      '/dashboard/orders',
      '/dashboard/products',
      '/dashboard/invoices',
    ].includes(moduleHref)

    if (!detailHandledByModule) {
      const recordId = getRecordIdFromSubPath(resolved.subPath, action) ?? 'record'
      const mode = action === 'edit' ? 'edit' : 'detail'
      return (
        <AdminPageShell title={pageTitle} breadcrumbs={breadcrumbTrail}>
          <ModuleDetailView navItem={navItem} moduleHref={moduleHref} recordId={recordId} mode={mode} />
        </AdminPageShell>
      )
    }
  }

  return (
    <AdminPageShell
      title={pageTitle}
      {...(navItem.description ? { description: navItem.description } : {})}
      breadcrumbs={breadcrumbTrail}
    >
      <ModuleWorkspace
        key={`${moduleHref}-${resolved.subPath.join('/')}`}
        navItem={navItem}
        moduleHref={moduleHref}
        {...(resolved.subPath.length > 0 ? { subPath: resolved.subPath } : {})}
        {...(action ? { action } : {})}
      />
    </AdminPageShell>
  )
}

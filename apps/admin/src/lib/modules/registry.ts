import { createElement, type ComponentType } from 'react'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { GenericModulePanel } from '@/components/modules/GenericModulePanel'
import { SettingsShell } from '@/components/settings/SettingsShell'
import { EmailSmsPanel } from '@/components/modules/EmailSmsPanel'
import { ContentModulePanel } from '@/components/content'
import { CouponsLivePanel, MarketingModulePanel } from '@/components/marketing'
import { CatalogModulePanel } from '@/components/products'
import { OrdersModulePanel } from '@/components/orders'
import { SecurityModulePanel } from '@/components/security'
import { SeoModulePanel } from '@/components/seo'
import { AiCenterModulePanel } from '@/components/ai'
import { AutomationModulePanel } from '@/components/automation'
import { OperationsHubPanel } from '@/components/courier'
import { CommerceModulePanel } from '@/components/modules/CommerceModulePanel'
import { PosPanel } from '@/components/pos/PosPanel'
import { CommerceFinanceModulePanel } from '@/components/modules/CommerceFinanceModulePanel'
import { OpsModulePanel } from '@/components/modules/OpsModulePanel'
import { GrowthModulePanel } from '@/components/modules/GrowthModulePanel'
import { AnalyticsModulePanel } from '@/components/modules/AnalyticsModulePanel'
import { SystemModulePanel } from '@/components/modules/SystemModulePanel'
import { SaaSModulePanel } from '@/components/modules/SaaSModulePanel'
import { WmsModulePanel } from '@/components/modules/WmsModulePanel'
import { AutomationRulesPanel } from '@/components/modules/AutomationRulesPanel'
import {
  AllIntegrationsPanel,
  GoogleMerchantPanel,
  MetaBusinessPanel,
  WebhooksPanel,
} from '@/components/modules/IntegrationPanels'
import { ApiHealthPanel } from '@/components/modules/ApiHealthPanel'
import { GoogleWorkspaceModulePanel } from '@/components/google-workspace/GoogleWorkspacePanels'
import { MediaModulePanel } from '@/components/modules/MediaModulePanel'
import {
  DeveloperModulePanel,
  MarketplaceModulePanel,
  ObservabilityModulePanel,
} from '@/components/modules/PlatformModulePanels'
import { FinanceModulePanel } from '@/components/modules/FinanceModulePanel'
import { GoogleSheetsPanel } from '@/components/finance/GoogleSheetsPanel'
import { TelegramPanel } from '@/components/finance/TelegramPanel'
import { FinanceAuditLogsPanel } from '@/components/finance/FinanceAuditLogsPanel'
import { ExecutiveDashboard } from '@/components/enterprise/ExecutiveDashboard'
import { ExportCenterPanelLive, NotificationCenterPanelLive, SocialCommercePanelLive } from '@/components/modules/EnterpriseLivePanels'
import { flatAdminRoutes } from '@/lib/navigation/admin-nav'

type ModuleComponent = ComponentType<ModuleContextProps> | ComponentType

function wrapStatic(Component: ComponentType): ComponentType<ModuleContextProps> {
  return function WrappedModulePanel(_props: ModuleContextProps) {
    return createElement(Component)
  }
}

function wrapGeneric(Component: ComponentType<ModuleContextProps>): ComponentType<ModuleContextProps> {
  return Component
}

const SPECIFIC_MODULES: Record<string, ModuleComponent> = {
  '/dashboard/finance/partner-accounts': wrapGeneric(FinanceModulePanel),
  '/dashboard/finance/profit-loss': wrapGeneric(FinanceModulePanel),
  '/dashboard/finance/expenses': wrapGeneric(FinanceModulePanel),
  '/dashboard/finance/investments': wrapGeneric(FinanceModulePanel),
  '/dashboard/finance/withdrawals': wrapGeneric(FinanceModulePanel),
  '/dashboard/finance/daily-closing': wrapGeneric(FinanceModulePanel),
  '/dashboard/finance/finance-reports': wrapGeneric(FinanceModulePanel),
  '/dashboard/finance/google-sheets-finance': wrapGeneric(FinanceModulePanel),
  '/dashboard/automation/telegram-notifications': wrapGeneric(AutomationModulePanel),
  '/dashboard/automation/google-sheets-sync': wrapGeneric(AutomationModulePanel),
  '/dashboard/automation/ai-product-agent': wrapGeneric(AutomationModulePanel),
  '/dashboard/automation/ai-seo-agent': wrapGeneric(AutomationModulePanel),
  '/dashboard/automation/ai-sales-insights': wrapGeneric(AutomationModulePanel),
  '/dashboard/system/sync-logs': wrapStatic(GoogleSheetsPanel),
  '/dashboard/system/telegram-logs': wrapStatic(TelegramPanel),
  '/dashboard/system/finance-audit-logs': wrapStatic(FinanceAuditLogsPanel),
  '/dashboard/executive/ceo-dashboard': wrapStatic(ExecutiveDashboard),
  '/dashboard/revenue-center': wrapStatic(ExecutiveDashboard),
  '/dashboard/business-intelligence': wrapStatic(ExecutiveDashboard),
  '/dashboard/executive/export-center': wrapStatic(ExportCenterPanelLive),
  '/dashboard/wms/overview': wrapGeneric(WmsModulePanel),
  '/dashboard/wms/warehouses': wrapGeneric(WmsModulePanel),
  '/dashboard/wms/stock-movements': wrapGeneric(WmsModulePanel),
  '/dashboard/wms/transfers': wrapGeneric(WmsModulePanel),
  '/dashboard/procurement/overview': wrapGeneric(OpsModulePanel),
  '/dashboard/procurement/suppliers': wrapGeneric(OpsModulePanel),
  '/dashboard/procurement/purchase-orders': wrapGeneric(OpsModulePanel),
  '/dashboard/procurement/goods-received': wrapGeneric(OpsModulePanel),
  '/dashboard/production/overview': wrapGeneric(OpsModulePanel),
  '/dashboard/production/fabric-inventory': wrapGeneric(OpsModulePanel),
  '/dashboard/support/helpdesk': wrapGeneric(OpsModulePanel),
  '/dashboard/support/live-chat': wrapGeneric(OpsModulePanel),
  '/dashboard/delivery/agents': wrapGeneric(OpsModulePanel),
  '/dashboard/delivery/assignments': wrapGeneric(OpsModulePanel),
  '/dashboard/company/dashboard': wrapGeneric(OpsModulePanel),
  '/dashboard/company/employees': wrapGeneric(OpsModulePanel),
  '/dashboard/company/payroll': wrapGeneric(OpsModulePanel),
  '/dashboard/company/tasks': wrapGeneric(OpsModulePanel),
  '/dashboard/company/documents': wrapGeneric(OpsModulePanel),
  '/dashboard/executive/notification-center': wrapStatic(NotificationCenterPanelLive),
  '/dashboard/observability/center': wrapGeneric(ObservabilityModulePanel),
  '/dashboard/observability/disaster-recovery': wrapGeneric(ObservabilityModulePanel),
  '/dashboard/marketplace/overview': wrapGeneric(MarketplaceModulePanel),
  '/dashboard/social-commerce/hub': wrapStatic(SocialCommercePanelLive),
  '/dashboard/developer/api-center': wrapGeneric(DeveloperModulePanel),
  '/dashboard/media-library': wrapGeneric(MediaModulePanel),
  '/dashboard/video-library': wrapGeneric(MediaModulePanel),
  '/dashboard/ugc-gallery': wrapGeneric(MediaModulePanel),
  '/dashboard/seo-health': wrapGeneric(SeoModulePanel),
  '/dashboard/keywords': wrapGeneric(SeoModulePanel),
  '/dashboard/index-monitor': wrapGeneric(SeoModulePanel),
  '/dashboard/schema-manager': wrapGeneric(SeoModulePanel),
  '/dashboard/sitemap-manager': wrapGeneric(SeoModulePanel),
  '/dashboard/redirect-manager': wrapGeneric(SeoModulePanel),
  '/dashboard/ai-agent': wrapGeneric(AiCenterModulePanel),
  '/dashboard/ai-content': wrapGeneric(AiCenterModulePanel),
  '/dashboard/ai-seo': wrapGeneric(AiCenterModulePanel),
  '/dashboard/ai-analytics': wrapGeneric(AiCenterModulePanel),
  '/dashboard/ai-sales': wrapGeneric(AiCenterModulePanel),
  '/dashboard/ai-customer-insights': wrapGeneric(AiCenterModulePanel),
  '/dashboard/ai-product-generator': wrapGeneric(AiCenterModulePanel),
  '/dashboard/automation-rules': wrapStatic(AutomationRulesPanel),
  '/dashboard/all-integrations': wrapGeneric(AllIntegrationsPanel),
  '/dashboard/api-health': wrapStatic(ApiHealthPanel),
  '/dashboard/webhooks': wrapStatic(WebhooksPanel),
  '/dashboard/meta-business': wrapStatic(MetaBusinessPanel),
  '/dashboard/google-merchant': wrapStatic(GoogleMerchantPanel),
  '/dashboard/google-workspace': wrapGeneric(GoogleWorkspaceModulePanel),
  '/dashboard/google-workspace/connect': wrapGeneric(GoogleWorkspaceModulePanel),
  '/dashboard/google-workspace/sheets-sync': wrapGeneric(GoogleWorkspaceModulePanel),
  '/dashboard/google-workspace/gmail': wrapGeneric(GoogleWorkspaceModulePanel),
  '/dashboard/google-workspace/drive': wrapGeneric(GoogleWorkspaceModulePanel),
  '/dashboard/google-workspace/docs': wrapGeneric(GoogleWorkspaceModulePanel),
  '/dashboard/google-workspace/calendar': wrapGeneric(GoogleWorkspaceModulePanel),
  '/dashboard/google-workspace/contacts': wrapGeneric(GoogleWorkspaceModulePanel),
  '/dashboard/google-workspace/analytics': wrapGeneric(GoogleWorkspaceModulePanel),
  '/dashboard/google-workspace/search-console': wrapGeneric(GoogleWorkspaceModulePanel),
  '/dashboard/google-workspace/merchant-center': wrapGeneric(GoogleWorkspaceModulePanel),
  '/dashboard/google-workspace/sync-logs': wrapGeneric(GoogleWorkspaceModulePanel),
  '/dashboard/google-workspace/oauth-settings': wrapGeneric(GoogleWorkspaceModulePanel),
  '/dashboard/settings': wrapStatic(SettingsShell),
  '/dashboard/email-sms': wrapGeneric(EmailSmsPanel),
  '/dashboard/security-center': wrapGeneric(SecurityModulePanel),
  '/dashboard/admin-users': wrapGeneric(SecurityModulePanel),
  '/dashboard/roles': wrapGeneric(SecurityModulePanel),
  '/dashboard/permissions': wrapGeneric(SecurityModulePanel),
  '/dashboard/audit-logs': wrapGeneric(SecurityModulePanel),
  '/dashboard/backups': wrapGeneric(SystemModulePanel),
  '/dashboard/logs': wrapGeneric(SystemModulePanel),
  '/dashboard/system-health': wrapGeneric(SystemModulePanel),
  '/dashboard/stores': wrapGeneric(SaaSModulePanel),
  '/dashboard/saas-subscriptions': wrapGeneric(SaaSModulePanel),
  '/dashboard/domains': wrapGeneric(SaaSModulePanel),
  '/dashboard/tenants': wrapGeneric(SaaSModulePanel),
  '/dashboard/billing': wrapGeneric(SaaSModulePanel),
  '/dashboard/orders': wrapGeneric(OrdersModulePanel),
  '/dashboard/pos': wrapStatic(PosPanel),
  '/dashboard/returns-rma': wrapGeneric(CommerceFinanceModulePanel),
  '/dashboard/subscriptions': wrapGeneric(CommerceFinanceModulePanel),
  '/dashboard/invoices': wrapGeneric(CommerceFinanceModulePanel),
  '/dashboard/transactions': wrapGeneric(CommerceFinanceModulePanel),
  '/dashboard/products': wrapGeneric(CatalogModulePanel),
  '/dashboard/product-reviews': wrapGeneric(CatalogModulePanel),
  '/dashboard/collections': wrapGeneric(CatalogModulePanel),
  '/dashboard/categories': wrapGeneric(CatalogModulePanel),
  '/dashboard/inventory': wrapGeneric(CatalogModulePanel),
  '/dashboard/brands': wrapGeneric(CatalogModulePanel),
  '/dashboard/attributes': wrapGeneric(CatalogModulePanel),
  '/dashboard/sku-manager': wrapGeneric(CatalogModulePanel),
  '/dashboard/qr-manager': wrapGeneric(CatalogModulePanel),
  '/dashboard/barcode-manager': wrapGeneric(CatalogModulePanel),
  '/dashboard/customers': wrapGeneric(CommerceModulePanel),
  '/dashboard/vip-members': wrapGeneric(GrowthModulePanel),
  '/dashboard/loyalty-program': wrapGeneric(GrowthModulePanel),
  '/dashboard/referrals': wrapGeneric(GrowthModulePanel),
  '/dashboard/segments': wrapGeneric(GrowthModulePanel),
  '/dashboard/customer-intelligence': wrapGeneric(GrowthModulePanel),
  '/dashboard/shipping': wrapGeneric(OperationsHubPanel),
  '/dashboard/operations': wrapGeneric(OperationsHubPanel),
  '/dashboard/courier-hub': wrapGeneric(OperationsHubPanel),
  '/dashboard/warehouse': wrapGeneric(OperationsHubPanel),
  '/dashboard/supplier-management': wrapGeneric(OperationsHubPanel),
  '/dashboard/analytics': wrapStatic(AnalyticsModulePanel),
  '/dashboard/campaigns': wrapGeneric(MarketingModulePanel),
  '/dashboard/coupons': wrapStatic(CouponsLivePanel),
  '/dashboard/whatsapp': wrapGeneric(MarketingModulePanel),
  '/dashboard/affiliate': wrapGeneric(MarketingModulePanel),
  '/dashboard/influencers': wrapGeneric(MarketingModulePanel),
  '/dashboard/home-page': wrapGeneric(ContentModulePanel),
  '/dashboard/footwear-page': wrapGeneric(ContentModulePanel),
  '/dashboard/theme-builder': wrapGeneric(ContentModulePanel),
  '/dashboard/menu-control': wrapGeneric(ContentModulePanel),
  '/dashboard/hero-slider': wrapGeneric(ContentModulePanel),
  '/dashboard/lookbooks': wrapGeneric(ContentModulePanel),
  '/dashboard/reels': wrapGeneric(ContentModulePanel),
  '/dashboard/blog': wrapGeneric(ContentModulePanel),
  '/dashboard/legal-pages': wrapGeneric(ContentModulePanel),
  '/dashboard/cms': wrapGeneric(ContentModulePanel),
  '/dashboard/landing-pages': wrapGeneric(ContentModulePanel),
}

/** All module routes with dedicated panels (not GenericModulePanel). */
export const REGISTERED_MODULE_HREFS = Object.keys(SPECIFIC_MODULES)

export function getModuleComponent(href: string): ComponentType<ModuleContextProps> {
  const normalized = href.replace(/\/+$/, '')
  const specific = SPECIFIC_MODULES[normalized]
  if (specific) return specific as ComponentType<ModuleContextProps>
  return GenericModulePanel
}

export function getAllModuleHrefs(): string[] {
  return flatAdminRoutes.map((route) => route.href)
}

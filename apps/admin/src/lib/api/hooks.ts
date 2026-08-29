'use client'

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchConversionFunnel,
  fetchDailyGoal,
  fetchDashboardStats,
  fetchDashboardInsights,
  fetchInventoryAlerts,
  fetchRevenueSeries,
  fetchTrafficSources,
  periodFromLabel,
  saveDailyGoal,
} from './dashboard'
import { fetchOrders, fetchOrder, fetchOrderStats, updateOrderStatus, updateOrderPaymentStatus, deleteOrder, bookOrderCourier, bookOrdersCourierBulk, createOrder, bulkUpdateOrderStatus, setOrderCodRisk, addOrderNote, type OrderPaymentStatus } from './orders'
import { fetchFulfillmentTodayStats } from './fulfillment'
import { fetchProducts, fetchProductStats, createProduct, updateProduct, deleteProduct, fetchProduct, updateProductVariant, fetchProductVersions, restoreProductVersion, createProductVariant, archiveProductVariant, type ProductListStatus } from './products'
import {
  fetchCategories,
  fetchCategoryTree,
  seedDefaultCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from './categories'
import { fetchCollections, createCollection, updateCollection } from './collections'
import { fetchBrands, createBrand, updateBrand } from './brands'
import { createBanner, fetchBanners, updateBanner, deleteBanner } from './banners'
import { createRedirect, deleteRedirect, fetchRedirects, updateRedirect } from './redirects'
import { auditProduct, fixMissingProductMeta } from './seo'
import {
  fetchGscInsights,
  fetchGscPages,
  fetchGscPerformance,
  fetchGscQueries,
  fetchGscSitemaps,
  fetchGscStatus,
  inspectGscUrl,
  refreshGscCache,
  type GscRange,
  type GscSort,
} from './search-console'
import { EMPTY_HELPDESK_OVERVIEW, EMPTY_SEO_OVERVIEW, isNetworkOrServerError } from './offline-defaults'
import { fetchCustomers, fetchCustomer, deleteCustomer, blockCustomer, fetchCustomerPresence } from './customers'
import { fetchLoyaltySummary, fetchReferralStats, fetchReferrals } from './loyalty'
import { fetchAutomationRules } from './automation'
import {
  fetchCampaigns,
  fetchCampaignStats,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  sendCampaign,
} from './marketing'
import { fetchCourierShipments, fetchCourierStats, fetchCourierProviders } from './courier'
import { fetchInvoices, fetchInvoiceHealth, fetchInvoiceStats, fetchTransactions, fetchTransactionHealth, fetchTransaction, fetchReturns, updateReturnStatus, createReturn, type RmaApiStatus } from './commerce-finance'
import { fetchSettings, updateSettings, fetchNewsletterSubscribers, fetchCatalogChannelStats, type AdminSettingsData } from './settings'
import { revalidateWebCache } from './revalidate'
import { fetchMediaFolders, fetchMediaOrphans, fetchMediaStorage } from './media'
import { hasPermission, type PermissionAction, type PermissionModule } from '@/lib/auth/permissions'
import { setAdminApiToken } from '@/lib/auth/api-token'
import {
  fetchSaaS,
  fetchSecurity,
  fetchMedia,
  fetchMarketplace,
  fetchDeveloper,
  createApiKey,
  revokeApiKey,
  fetchObservability,
  fetchIntegrations,
  fetchSystemLogs,
  fetchTelegramLogs,
  type MediaQuery,
} from './platform'
import {
  fetchWmsOverview,
  fetchProcurementOverview,
  fetchHelpdeskOverview,
  fetchCompanyOverview,
  fetchProductionOverview,
  fetchDeliveryOverview,
  fetchExecutiveDashboard,
  createWarehouse,
  recordStockMovement,
  recordOpeningStock,
  createStockTransfer,
  shipStockTransfer,
  receiveStockTransfer,
  createDeliveryAgent,
  updateDeliveryAgent,
  assignOrderToAgent,
  updateDeliveryAssignmentStatus,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  createCompanyTask,
  updateCompanyTaskStatus,
  fetchPayrollRuns,
  createPayrollRun,
  createFabricInventory,
  updateFabricStock,
  createProductionBatch,
  updateProductionBatchStatus,
  replyHelpdeskTicket,
} from './commerce-os'
import {
  fetchContentOverview,
  createBlogPost,
  fetchSeoOverview,
  fetchMarketingOverview,
  updateSocialChannels,
  createAffiliate,
  createSupplier,
  deleteSupplier,
  createPurchaseOrder,
  updatePurchaseOrderEta,
  deletePurchaseOrder,
  emailPurchaseOrder,
  receiveGoodsGrn,
  createSupportTicket,
  fetchNotificationsOverview,
  fetchCommerceSubscriptions,
} from './admin-hub'
import {
  createSitePage,
  deleteSitePage,
  fetchSitePages,
  updateSitePage,
} from './content-pages'
import type { PermissionRow } from './security'
import { fetchRolePermissions, fetchSecuritySessions, fetchStaffTelegramLinkToken, inviteAdmin, removeStaff, resetStaffTelegram, revokeSecuritySession, saveRolePermissions, updateStaffRole } from './security'
import { fetchLegalPage, fetchLegalPages, saveLegalPage } from './legal-pages'
import { fetchFootwearConfig } from './footwear-config'
import type { LegalPageContent, LegalPageSlug } from '@splaro/types'
import {
  fetchWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  dispatchWebhook,
  fetchWebhookLogs,
  fetchWebhookStats,
  fetchWebhookEvents,
  type WebhookEventType,
} from './webhooks'

export function useDashboardStats(periodLabel: string) {
  const period = periodFromLabel(periodLabel)
  return useQuery({
    queryKey: ['dashboard-stats', period],
    queryFn: () => fetchDashboardStats(period),
    staleTime: 60_000,
    // Ops screens are watched live — without a poll an open tab shows the
    // numbers from whenever it was last focused. Background tabs stay idle so
    // this does not multiply API load across every tab someone left open.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}

export function useDashboardInsights(periodLabel: string) {
  const period = periodFromLabel(periodLabel)
  return useQuery({
    queryKey: ['dashboard-insights', period],
    queryFn: () => fetchDashboardInsights(period),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}

export function useFulfillmentTodayStats() {
  return useQuery({
    queryKey: ['fulfillment-today-stats'],
    queryFn: fetchFulfillmentTodayStats,
    staleTime: 15_000,
  })
}

export function useOrders(params?: {
  status?: string
  search?: string
  paymentMethod?: string
  sort?: string
  limit?: number
  page?: number
}) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () =>
      fetchOrders({
        ...params,
        page: params?.page ?? 1,
        limit: params?.limit ?? 50,
      }),
    staleTime: 30_000,
    // A new storefront order must surface without the operator refreshing.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}

/**
 * Stage tallies for the orders strip. Kept on the same 30s cadence as the list
 * so the counts and the rows never drift apart on screen.
 */
export function useOrderStats(params?: { search?: string }) {
  return useQuery({
    queryKey: ['order-stats', params?.search ?? ''],
    queryFn: () => fetchOrderStats(params),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id),
    enabled: Boolean(id),
    staleTime: 15_000,
    // Courier status and payment state move while this screen is open.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      updateOrderStatus(id, status, note),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['order', vars.id] })
      void qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useSetOrderCodRisk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      isCodRisk,
      requireAdvancePayment,
    }: {
      id: string
      isCodRisk: boolean
      requireAdvancePayment?: boolean
    }) =>
      setOrderCodRisk(
        id,
        requireAdvancePayment === undefined
          ? { isCodRisk }
          : { isCodRisk, requireAdvancePayment },
      ),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['order', vars.id] })
      void qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useAddOrderNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => addOrderNote(id, body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['order', vars.id] })
    },
  })
}

export function useDeleteOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['order', id] })
      void qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      void qc.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useBookCourier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, provider }: { id: string; provider?: Parameters<typeof bookOrderCourier>[1] }) =>
      bookOrderCourier(id, provider),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['order'] })
      void qc.invalidateQueries({ queryKey: ['courier-shipments'] })
      void qc.invalidateQueries({ queryKey: ['courier-stats'] })
    },
  })
}

export function useBookCourierBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderIds, provider }: { orderIds: string[]; provider?: Parameters<typeof bookOrdersCourierBulk>[1] }) =>
      bookOrdersCourierBulk(orderIds, provider),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['courier-shipments'] })
      void qc.invalidateQueries({ queryKey: ['courier-stats'] })
    },
  })
}

export function useCourierShipments(params?: {
  status?: string
  provider?: string
  search?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['courier-shipments', params],
    queryFn: () => fetchCourierShipments(params),
    staleTime: 20_000,
    retry: 1,
  })
}

export function useCourierStats(days = 30) {
  return useQuery({
    queryKey: ['courier-stats', days],
    queryFn: () => fetchCourierStats(days),
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCourierProviders() {
  return useQuery({
    queryKey: ['courier-providers'],
    queryFn: fetchCourierProviders,
    staleTime: 60_000,
    retry: 1,
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      void qc.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useBulkUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderIds, status, note }: { orderIds: string[]; status: string; note?: string }) =>
      bulkUpdateOrderStatus(orderIds, status, note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      // The stage strip counts the same rows that just moved, so it has to be
      // refetched with them or it keeps showing the old stage tallies.
      void qc.invalidateQueries({ queryKey: ['order-stats'] })
      void qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useBlockCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) => blockCustomer(id, blocked),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['customers'] })
      void qc.invalidateQueries({ queryKey: ['customer', vars.id] })
    },
  })
}

export function useWmsOverview() {
  return useQuery({
    queryKey: ['wms-overview'],
    queryFn: fetchWmsOverview,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCreateWarehouse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createWarehouse,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wms-overview'] })
    },
  })
}

export function useRecordStockMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordStockMovement,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wms-overview'] })
    },
  })
}

export function useRecordOpeningStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordOpeningStock,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wms-overview'] })
    },
  })
}

export function useCreateStockTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createStockTransfer,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wms-overview'] })
    },
  })
}

export function useShipStockTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: shipStockTransfer,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wms-overview'] })
    },
  })
}

export function useReceiveStockTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: receiveStockTransfer,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wms-overview'] })
    },
  })
}

export function useCreateDeliveryAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createDeliveryAgent,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['delivery-overview'] }),
  })
}

export function useUpdateDeliveryAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; isActive?: boolean; name?: string; vehicleType?: string }) =>
      updateDeliveryAgent(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['delivery-overview'] }),
  })
}

export function useAssignOrderToAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: assignOrderToAgent,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['delivery-overview'] })
      void qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useUpdateDeliveryAssignmentStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateDeliveryAssignmentStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['delivery-overview'] }),
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['company-overview'] }),
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
      position?: string
      salary?: number
      status?: string
    }) => updateEmployee(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['company-overview'] }),
  })
}

export function useDeactivateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deactivateEmployee,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['company-overview'] }),
  })
}

export function useCreateCompanyTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCompanyTask,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['company-overview'] }),
  })
}

export function useUpdateCompanyTaskStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateCompanyTaskStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['company-overview'] }),
  })
}

export function usePayrollRuns() {
  return useQuery({
    queryKey: ['payroll-runs'],
    queryFn: fetchPayrollRuns,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCreatePayrollRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPayrollRun,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payroll-runs'] }),
  })
}

export function useCreateFabricInventory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createFabricInventory,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['production-overview'] }),
  })
}

export function useUpdateFabricStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; delta?: number; quantity?: number }) =>
      updateFabricStock(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['production-overview'] }),
  })
}

export function useCreateProductionBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProductionBatch,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['production-overview'] }),
  })
}

export function useUpdateProductionBatchStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateProductionBatchStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['production-overview'] }),
  })
}

export function useReplyHelpdeskTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, message }: { ticketId: string; message: string }) =>
      replyHelpdeskTicket(ticketId, message),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['helpdesk-overview'] })
    },
  })
}

export function useExecutiveDashboard() {
  return useQuery({
    queryKey: ['executive-dashboard'],
    queryFn: fetchExecutiveDashboard,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useProcurementOverview() {
  return useQuery({
    queryKey: ['procurement-overview'],
    queryFn: fetchProcurementOverview,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useHelpdeskOverview() {
  const query = useQuery({
    queryKey: ['helpdesk-overview'],
    queryFn: async () => {
      try {
        return { data: await fetchHelpdeskOverview(), offline: false as const }
      } catch (error) {
        return { data: EMPTY_HELPDESK_OVERVIEW, offline: isNetworkOrServerError(error) }
      }
    },
    staleTime: 30_000,
    retry: false,
  })

  return {
    data: query.data?.data ?? EMPTY_HELPDESK_OVERVIEW,
    isOffline: query.data?.offline ?? false,
    isLoading: query.isLoading,
    isError: query.data?.offline ?? query.isError,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

export function useCompanyOverview() {
  return useQuery({
    queryKey: ['company-overview'],
    queryFn: fetchCompanyOverview,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useProductionOverview() {
  return useQuery({
    queryKey: ['production-overview'],
    queryFn: fetchProductionOverview,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useDeliveryOverview() {
  return useQuery({
    queryKey: ['delivery-overview'],
    queryFn: fetchDeliveryOverview,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useContentOverview() {
  return useQuery({
    queryKey: ['content-overview'],
    queryFn: fetchContentOverview,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useLegalPages() {
  return useQuery({
    queryKey: ['legal-pages'],
    queryFn: fetchLegalPages,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useLegalPage(slug: LegalPageSlug) {
  return useQuery({
    queryKey: ['legal-page', slug],
    queryFn: () => fetchLegalPage(slug),
    staleTime: 30_000,
    retry: 1,
  })
}

export function useSaveLegalPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, body }: { slug: LegalPageSlug; body: LegalPageContent }) => saveLegalPage(slug, body),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['legal-pages'] })
      void qc.invalidateQueries({ queryKey: ['legal-page', variables.slug] })
      void revalidateWebCache(['storefront-settings'])
    },
  })
}

export function useFootwearConfig() {
  return useQuery({
    queryKey: ['footwear-config'],
    queryFn: fetchFootwearConfig,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCreateBlogPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createBlogPost,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['content-overview'] })
      void revalidateWebCache(['storefront-settings'])
    },
  })
}

export function useSitePages() {
  return useQuery({
    queryKey: ['site-pages'],
    queryFn: fetchSitePages,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCreateSitePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createSitePage,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['site-pages'] })
      void revalidateWebCache(['storefront-settings'])
    },
  })
}

export function useUpdateSitePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof updateSitePage>[1]) =>
      updateSitePage(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['site-pages'] })
      void revalidateWebCache(['storefront-settings'])
    },
  })
}

export function useDeleteSitePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSitePage,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['site-pages'] })
      void revalidateWebCache(['storefront-settings'])
    },
  })
}

export function useSeoOverview() {
  const query = useQuery({
    queryKey: ['seo-overview'],
    queryFn: async () => {
      try {
        return { data: await fetchSeoOverview(), offline: false as const }
      } catch (error) {
        return { data: EMPTY_SEO_OVERVIEW, offline: isNetworkOrServerError(error) }
      }
    },
    staleTime: 30_000,
    retry: false,
  })

  return {
    data: query.data?.data ?? EMPTY_SEO_OVERVIEW,
    isOffline: query.data?.offline ?? false,
    isLoading: query.isLoading,
    isError: query.data?.offline ?? query.isError,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

export function useAuditProductSeo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (productId: string) => auditProduct(productId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['seo-overview'] })
    },
  })
}

export function useFixMissingProductSeo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => fixMissingProductMeta(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['seo-overview'] })
    },
  })
}

export function useGscStatus(enabled = true) {
  return useQuery({
    queryKey: ['gsc-status'],
    queryFn: fetchGscStatus,
    enabled,
    staleTime: 15 * 60_000,
    retry: false,
  })
}

export function useGscPerformance(range: GscRange, enabled = true) {
  return useQuery({
    queryKey: ['gsc-performance', range],
    queryFn: () => fetchGscPerformance(range),
    enabled,
    staleTime: 30 * 60_000,
    retry: false,
  })
}

export function useGscQueries(range: GscRange, sort: GscSort = 'clicks', enabled = true) {
  return useQuery({
    queryKey: ['gsc-queries', range, sort],
    queryFn: () => fetchGscQueries(range, 25, sort),
    enabled,
    staleTime: 30 * 60_000,
    retry: false,
  })
}

export function useGscPages(range: GscRange, sort: GscSort = 'clicks', enabled = true) {
  return useQuery({
    queryKey: ['gsc-pages', range, sort],
    queryFn: () => fetchGscPages(range, 25, sort),
    enabled,
    staleTime: 30 * 60_000,
    retry: false,
  })
}

export function useGscSitemaps(enabled = true) {
  return useQuery({
    queryKey: ['gsc-sitemaps'],
    queryFn: fetchGscSitemaps,
    enabled,
    staleTime: 15 * 60_000,
    retry: false,
  })
}

export function useGscInsights(range: GscRange, enabled = true) {
  return useQuery({
    queryKey: ['gsc-insights', range],
    queryFn: () => fetchGscInsights(range),
    enabled,
    staleTime: 30 * 60_000,
    retry: false,
  })
}

export function useGscInspect() {
  return useMutation({
    mutationFn: (url: string) => inspectGscUrl(url),
  })
}

export function useGscRefresh() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: refreshGscCache,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['gsc-status'] })
      void qc.invalidateQueries({ queryKey: ['gsc-performance'] })
      void qc.invalidateQueries({ queryKey: ['gsc-queries'] })
      void qc.invalidateQueries({ queryKey: ['gsc-pages'] })
      void qc.invalidateQueries({ queryKey: ['gsc-sitemaps'] })
      void qc.invalidateQueries({ queryKey: ['gsc-insights'] })
      void qc.invalidateQueries({ queryKey: ['seo-overview'] })
      void qc.invalidateQueries({ queryKey: ['google-status'] })
    },
  })
}

export function useRedirects() {
  const query = useQuery({
    queryKey: ['url-redirects'],
    queryFn: async () => {
      try {
        const res = await fetchRedirects()
        return { data: res.redirects, offline: false as const }
      } catch (error) {
        return { data: [], offline: isNetworkOrServerError(error) }
      }
    },
    staleTime: 15_000,
    retry: false,
  })

  return {
    data: query.data?.data ?? [],
    isOffline: query.data?.offline ?? false,
    isLoading: query.isLoading,
    isError: query.data?.offline ?? query.isError,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

export function useCreateRedirect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createRedirect,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['url-redirects'] })
      void qc.invalidateQueries({ queryKey: ['seo-overview'] })
      void revalidateWebCache(['storefront-settings'])
    },
  })
}

export function useUpdateRedirect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; fromPath?: string; toPath?: string; type?: string; isActive?: boolean; note?: string | null }) =>
      updateRedirect(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['url-redirects'] })
      void qc.invalidateQueries({ queryKey: ['seo-overview'] })
      void revalidateWebCache(['storefront-settings'])
    },
  })
}

export function useDeleteRedirect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteRedirect,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['url-redirects'] })
      void qc.invalidateQueries({ queryKey: ['seo-overview'] })
      void revalidateWebCache(['storefront-settings'])
    },
  })
}

export function useMarketingOverview() {
  return useQuery({
    queryKey: ['marketing-overview'],
    queryFn: fetchMarketingOverview,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 2,
  })
}

export function useUpdateSocialChannels() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateSocialChannels,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['marketing-overview'] })
      void qc.invalidateQueries({ queryKey: ['admin-settings'] })
    },
  })
}

export function useCreateAffiliate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createAffiliate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['marketing-overview'] })
    },
  })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createSupplier,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['procurement-overview'] }),
  })
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['procurement-overview'] }),
  })
}

export function useUpdatePurchaseOrderEta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updatePurchaseOrderEta,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['procurement-overview'] }),
  })
}

export function useDeletePurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePurchaseOrder,
    onSuccess: () => {
      // A deletion reverses stock as well as the supplier balance, so the
      // inventory views have to refetch too or they keep showing the units the
      // mistaken PO added.
      void qc.invalidateQueries({ queryKey: ['procurement-overview'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['inventory-alerts'] })
      void qc.invalidateQueries({ queryKey: ['wms-overview'] })
    },
  })
}

export function useEmailPurchaseOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: emailPurchaseOrder,
    // The delivery log the send writes is what Notification Center reads, so a
    // resend has to refresh it or the operator sees a stale "not sent".
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications-overview'] }),
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['procurement-overview'] }),
  })
}

export function useReceiveGoodsGrn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: receiveGoodsGrn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['procurement-overview'] }),
  })
}

export function useCreateSupportTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createSupportTicket,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['helpdesk-overview'] }),
  })
}

export function useNotificationsOverview() {
  return useQuery({
    queryKey: ['notifications-overview'],
    queryFn: fetchNotificationsOverview,
    staleTime: 2_000,
    refetchInterval: 4_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    retry: 1,
  })
}

export function useCommerceSubscriptions() {
  return useQuery({
    queryKey: ['commerce-subscriptions'],
    queryFn: fetchCommerceSubscriptions,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCustomers(params?: { search?: string; limit?: number; staff?: 'hide' | 'include' | 'only' }) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => fetchCustomers({ ...params, limit: params?.limit ?? 100, staff: params?.staff ?? 'hide' }),
    staleTime: 30_000,
  })
}

/**
 * Who is browsing right now. Polled on a short interval because the whole point
 * is that the dot goes out shortly after the shopper does — the presence window
 * on the API side is 30s, so refetching every 15s never shows a stale green.
 */
export function useCustomerPresence(enabled = true) {
  return useQuery({
    queryKey: ['customer-presence'],
    queryFn: fetchCustomerPresence,
    enabled,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    retry: 1,
  })
}

export function useLoyaltySummary() {
  return useQuery({
    queryKey: ['loyalty-summary'],
    queryFn: fetchLoyaltySummary,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useReferralStats() {
  return useQuery({
    queryKey: ['referral-stats'],
    queryFn: fetchReferralStats,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useReferrals(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['referrals', params],
    queryFn: () => fetchReferrals(params),
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchCustomer(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      deleteCustomer(id, force ? { force: true } : undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customers'] })
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useAutomationRules() {
  return useQuery({
    queryKey: ['automation-rules'],
    queryFn: fetchAutomationRules,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
    staleTime: 30_000,
  })
}

export function useCampaignStats() {
  return useQuery({
    queryKey: ['campaign-stats'],
    queryFn: fetchCampaignStats,
    staleTime: 60_000,
    retry: 1,
  })
}

export function useCreateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] })
      void qc.invalidateQueries({ queryKey: ['campaign-stats'] })
    },
  })
}

export function useUpdateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; subject?: string; body?: string; scheduledAt?: string; status?: string }) =>
      updateCampaign(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] })
      void qc.invalidateQueries({ queryKey: ['campaign-stats'] })
    },
  })
}

export function useDeleteCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] })
      void qc.invalidateQueries({ queryKey: ['campaign-stats'] })
    },
  })
}

export function useDuplicateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: duplicateCampaign,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] })
      void qc.invalidateQueries({ queryKey: ['campaign-stats'] })
    },
  })
}

export function useSendCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: sendCampaign,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] })
      void qc.invalidateQueries({ queryKey: ['campaign-stats'] })
    },
  })
}

export function useInvoices(search?: string) {
  return useQuery({
    queryKey: ['invoices', search],
    queryFn: () => fetchInvoices(search),
    staleTime: 30_000,
  })
}

export function useInvoiceHealth() {
  return useQuery({
    queryKey: ['invoice-health'],
    queryFn: fetchInvoiceHealth,
    staleTime: 60_000,
    retry: 1,
  })
}

export function useInvoiceStats(days = 30) {
  return useQuery({
    queryKey: ['invoice-stats', days],
    queryFn: () => fetchInvoiceStats(days),
    staleTime: 60_000,
    retry: 1,
  })
}

export function useUpdateOrderPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      paymentStatus,
      reference,
      amount,
      method,
      note,
    }: {
      id: string
      paymentStatus: OrderPaymentStatus
      reference?: string
      amount?: number
      method?: string
      note?: string
    }) =>
      updateOrderPaymentStatus(id, paymentStatus, {
        ...(reference !== undefined ? { reference } : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(method !== undefined ? { method } : {}),
        ...(note !== undefined ? { note } : {}),
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['invoices'] })
      void qc.invalidateQueries({ queryKey: ['transactions'] })
      void qc.invalidateQueries({ queryKey: ['transaction-health'] })
      void qc.invalidateQueries({ queryKey: ['order', vars.id] })
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['invoice-stats'] })
    },
  })
}

export function useTransactions(search?: string) {
  return useQuery({
    queryKey: ['transactions', search],
    queryFn: () => fetchTransactions(search),
    staleTime: 30_000,
  })
}

export function useTransactionHealth() {
  return useQuery({
    queryKey: ['transaction-health'],
    queryFn: fetchTransactionHealth,
    staleTime: 60_000,
    retry: 1,
  })
}

export function useTransaction(id: string, enabled = true) {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: () => fetchTransaction(id),
    enabled: Boolean(id) && enabled,
    staleTime: 15_000,
  })
}

export function useReturns(search?: string) {
  return useQuery({
    queryKey: ['returns', search],
    queryFn: () => fetchReturns(search),
    staleTime: 30_000,
  })
}

export function useUpdateReturnStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string
      status: RmaApiStatus
      note?: string
      refundAmount?: number
    }) => updateReturnStatus(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['returns'] })
    },
  })
}

export function useCreateReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createReturn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['returns'] })
    },
  })
}

export function useProducts(params?: {
  search?: string
  status?: ProductListStatus
  sort?: string
  limit?: number
  page?: number
}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => fetchProducts({ ...params, page: params?.page ?? 1, limit: params?.limit ?? 50 }),
    staleTime: 30_000,
  })
}

/** Catalog tallies for the KPI tiles and tab counts, across every page. */
export function useProductStats(params?: { search?: string }) {
  return useQuery({
    queryKey: ['product-stats', params?.search ?? ''],
    queryFn: () => fetchProductStats(params),
    staleTime: 30_000,
    retry: 1,
  })
}

export function usePublishedProductCount() {
  return useQuery({
    queryKey: ['products', 'published-count'],
    queryFn: () => fetchProducts({ status: 'published', limit: 1, page: 1 }),
    select: (data) => data.total,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useInventoryAlerts() {
  return useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: fetchInventoryAlerts,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useRevenueSeries(period: '7d' | '30d' | '90d') {
  return useQuery({
    queryKey: ['revenue-series', period],
    queryFn: () => fetchRevenueSeries(period),
    staleTime: 60_000,
    retry: 1,
  })
}

export function useTrafficSources(period: '7d' | '30d' | '90d' = '30d') {
  return useQuery({
    queryKey: ['traffic-sources', period],
    queryFn: () => fetchTrafficSources(period),
    staleTime: 60_000,
    retry: 1,
  })
}

export function useConversionFunnel(period: '1d' | '7d' | '30d' | '90d' = '30d') {
  return useQuery({
    queryKey: ['conversion-funnel', period],
    queryFn: () => fetchConversionFunnel(period),
    staleTime: 60_000,
    retry: 1,
  })
}

export function useDailyGoal() {
  return useQuery({
    queryKey: ['daily-goal'],
    queryFn: fetchDailyGoal,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useSaveDailyGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveDailyGoal,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['daily-goal'] }),
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    enabled: Boolean(id),
    staleTime: 15_000,
  })
}

export function useProductVersions(id: string) {
  return useQuery({
    queryKey: ['product-versions', id],
    queryFn: () => fetchProductVersions(id),
    enabled: Boolean(id),
    staleTime: 15_000,
  })
}

export function useRestoreProductVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, versionId, restoredBy }: { productId: string; versionId: string; restoredBy: string }) =>
      restoreProductVersion(productId, versionId, restoredBy),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['product', vars.productId] })
      void qc.invalidateQueries({ queryKey: ['product-versions', vars.productId] })
      void qc.invalidateQueries({ queryKey: ['products'] })
      void revalidateWebCache(['storefront-products'])
    },
  })
}

export function useSettings() {
  return useQuery({
    queryKey: ['admin-settings'],
    queryFn: fetchSettings,
    staleTime: 30_000,
    refetchOnWindowFocus: process.env.NODE_ENV === 'production',
    retry: 2,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<AdminSettingsData>) => updateSettings(data),
    onSuccess: (data) => {
      qc.setQueryData(['admin-settings'], data)
      void qc.invalidateQueries({ queryKey: ['admin-settings'] })
      void revalidateWebCache(['storefront-settings'])
    },
  })
}

export function useNewsletterSubscribers(enabled = true) {
  return useQuery({
    queryKey: ['newsletter-subscribers'],
    queryFn: fetchNewsletterSubscribers,
    enabled,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCatalogChannelStats(enabled = true) {
  return useQuery({
    queryKey: ['catalog-channel-stats'],
    queryFn: fetchCatalogChannelStats,
    enabled,
    staleTime: 20_000,
    retry: 1,
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void revalidateWebCache(['storefront-products'])
    },
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof updateProduct>[1]) =>
      updateProduct(id, input),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['product', vars.id] })
      void qc.invalidateQueries({ queryKey: ['product-versions', vars.id] })
      void revalidateWebCache(['storefront-products'])
    },
  })
}

export function useUpdateProductVariant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      productId,
      variantId,
      ...data
    }: { productId: string; variantId: string } & Parameters<typeof updateProductVariant>[2]) =>
      updateProductVariant(productId, variantId, data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['product', vars.productId] })
      void qc.invalidateQueries({ queryKey: ['inventory-alerts'] })
      void qc.invalidateQueries({ queryKey: ['products', 'published-count'] })
      void revalidateWebCache(['storefront-products'])
    },
  })
}

export function useCreateProductVariant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, ...data }: { productId: string } & Parameters<typeof createProductVariant>[1]) =>
      createProductVariant(productId, data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['product', vars.productId] })
      void qc.invalidateQueries({ queryKey: ['inventory-alerts'] })
      void revalidateWebCache(['storefront-products'])
    },
  })
}

export function useArchiveProductVariant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, variantId }: { productId: string; variantId: string }) =>
      archiveProductVariant(productId, variantId),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['product', vars.productId] })
      void revalidateWebCache(['storefront-products'])
    },
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void revalidateWebCache(['storefront-products'])
    },
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetchCategories()
      return res.categories
    },
    staleTime: 60_000,
  })
}

export function useCategoryTree() {
  return useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: async () => {
      const res = await fetchCategoryTree()
      return res
    },
    staleTime: 60_000,
  })
}

/**
 * A category write moves the storefront menu, the category tiles and the
 * product listings — busting only the product cache left the menu showing
 * yesterday's tree.
 */
export const CATEGORY_WEB_TAGS = [
  'storefront-categories',
  'storefront-menu-header',
  'storefront-nav',
  'storefront-products',
  'storefront-settings',
]

export function useSeedDefaultCategories() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: seedDefaultCategories,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      void qc.invalidateQueries({ queryKey: ['categories', 'tree'] })
      void revalidateWebCache(CATEGORY_WEB_TAGS)
    },
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; parentId?: string; image?: string }) =>
      createCategory(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      void qc.invalidateQueries({ queryKey: ['categories', 'tree'] })
      void revalidateWebCache(CATEGORY_WEB_TAGS)
    },
  })
}

export function useReorderCategories() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reorderCategories,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      void qc.invalidateQueries({ queryKey: ['categories', 'tree'] })
      void revalidateWebCache(CATEGORY_WEB_TAGS)
    },
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string
      name?: string
      description?: string
      isActive?: boolean
      image?: string | null
      parentId?: string | null
      sortOrder?: number
    }) => updateCategory(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      void qc.invalidateQueries({ queryKey: ['categories', 'tree'] })
      void qc.invalidateQueries({ queryKey: ['platform-media'] })
      void revalidateWebCache(CATEGORY_WEB_TAGS)
    },
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      void qc.invalidateQueries({ queryKey: ['categories', 'tree'] })
      void revalidateWebCache(CATEGORY_WEB_TAGS)
    },
  })
}

export function useSaaS() {
  return useQuery({ queryKey: ['platform-saas'], queryFn: fetchSaaS, staleTime: 60_000, retry: 1 })
}

export function useSecurity() {
  return useQuery({ queryKey: ['platform-security'], queryFn: fetchSecurity, staleTime: 30_000, retry: 1 })
}

export function useRolePermissions() {
  return useQuery({
    queryKey: ['security-permissions'],
    queryFn: fetchRolePermissions,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useAdminSession() {
  return useQuery({
    queryKey: ['admin-session'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (!res.ok) return null
      const data = (await res.json()) as {
        user?: {
          id: string
          email: string
          name: string
          role: string
          storeId?: string
          permissions?: string[]
        }
        apiToken?: string
      }
      // Shared session query also hydrates the API token once — avoids duplicate /api/auth/me.
      if (data.apiToken) setAdminApiToken(data.apiToken)
      return data.user ?? null
    },
    staleTime: 60_000,
    retry: false,
  })
}

export function usePermission(moduleSlug: PermissionModule, action: PermissionAction) {
  const { data: session } = useAdminSession()
  return hasPermission(session?.role, session?.permissions, moduleSlug, action)
}

export function useSecuritySessions(enabled = true) {
  return useQuery({
    queryKey: ['security-sessions'],
    queryFn: fetchSecuritySessions,
    staleTime: 15_000,
    retry: 1,
    enabled,
  })
}

export function useMedia(query: Omit<MediaQuery, 'cursor'> = {}) {
  return useInfiniteQuery({
    queryKey: ['platform-media', query],
    queryFn: ({ pageParam }) => fetchMedia({ ...query, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pageInfo?.hasMore ? lastPage.pageInfo.nextCursor ?? undefined : undefined,
    staleTime: 30_000,
    retry: 1,
  })
}

/** Library folders the store can file media under — built-ins plus its own. */
export function useMediaFolders() {
  return useQuery({
    queryKey: ['media-folders'],
    queryFn: fetchMediaFolders,
    staleTime: 30_000,
    retry: 1,
  })
}

/**
 * `enabled` is not optional in spirit: the endpoint walks the whole upload
 * volume, so asking for it on every media page load cost seconds nobody had
 * requested. Callers turn it on when the numbers are actually on screen.
 */
export function useMediaStorage(enabled = true) {
  return useQuery({
    queryKey: ['media-storage'],
    queryFn: () => fetchMediaStorage(),
    staleTime: 30_000,
    retry: 1,
    enabled,
  })
}

export function useMediaOrphans(enabled = true) {
  return useQuery({
    queryKey: ['media-orphans'],
    queryFn: () => fetchMediaOrphans(),
    staleTime: 30_000,
    retry: 1,
    enabled,
  })
}

export function useMarketplace() {
  return useQuery({ queryKey: ['platform-marketplace'], queryFn: fetchMarketplace, staleTime: 60_000, retry: 1 })
}

export function useDeveloper() {
  return useQuery({ queryKey: ['platform-developer'], queryFn: fetchDeveloper, staleTime: 60_000, retry: 1 })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; scopes?: string[] }) => createApiKey(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-developer'] })
    },
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-developer'] })
    },
  })
}

export function useObservability() {
  return useQuery({ queryKey: ['platform-observability'], queryFn: fetchObservability, staleTime: 30_000, retry: 1 })
}

export function useIntegrations() {
  return useQuery({ queryKey: ['platform-integrations'], queryFn: fetchIntegrations, staleTime: 30_000, retry: 1 })
}

export function useSystemLogs(params?: { page?: number; limit?: number; q?: string; level?: string }) {
  return useQuery({
    queryKey: ['platform-system-logs', params?.page ?? 1, params?.limit ?? 50, params?.q ?? '', params?.level ?? 'all'],
    queryFn: () => fetchSystemLogs(params),
    staleTime: 15_000,
    retry: 1,
  })
}

export function useTelegramLogs() {
  return useQuery({ queryKey: ['platform-telegram-logs'], queryFn: () => fetchTelegramLogs(), staleTime: 15_000, retry: 1 })
}

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCreateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; image?: string }) =>
      createCollection(data.name, data.description, data.image),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['collections'] })
      void qc.invalidateQueries({ queryKey: ['content-overview'] })
      void revalidateWebCache(['storefront-products'])
    },
  })
}

export function useUpdateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; isActive?: boolean }) =>
      updateCollection(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['collections'] })
      void revalidateWebCache(['storefront-products'])
    },
  })
}

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCreateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createBrand,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['brands'] })
      void revalidateWebCache(['storefront-products'])
    },
  })
}

export function useUpdateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string
      name?: string
      vendorLabel?: string
      isActive?: boolean
      logo?: string
    }) => updateBrand(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['brands'] })
      void revalidateWebCache(['storefront-products'])
    },
  })
}

export function useBanners(position?: string) {
  return useQuery({
    queryKey: ['banners', position ?? 'all'],
    queryFn: async () => {
      const res = await fetchBanners(position)
      return res.banners
    },
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCreateBanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createBanner,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-media'] })
      void qc.invalidateQueries({ queryKey: ['banners'] })
      void revalidateWebCache(['storefront-settings'])
    },
  })
}

export function useUpdateBanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; subtitle?: string; linkUrl?: string; isActive?: boolean; sortOrder?: number; image?: string }) =>
      updateBanner(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-media'] })
      void qc.invalidateQueries({ queryKey: ['banners'] })
      void revalidateWebCache(['storefront-settings'])
    },
  })
}

export function useDeleteBanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteBanner,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-media'] })
      void qc.invalidateQueries({ queryKey: ['banners'] })
      void revalidateWebCache(['storefront-settings'])
    },
  })
}

export function useUpdateStaffRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, ...data }: { userId: string; role?: string; isActive?: boolean }) =>
      updateStaffRole(userId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-security'] })
    },
  })
}

export function useInviteAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: inviteAdmin,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-security'] })
    },
  })
}

export function useSaveRolePermissions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ role, permissions }: { role: string; permissions: PermissionRow[] }) =>
      saveRolePermissions(role, permissions),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['security-permissions'] })
      void qc.invalidateQueries({ queryKey: ['platform-security'] })
    },
  })
}

export function useRemoveStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => removeStaff(userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-security'] })
    },
  })
}

export function useStaffTelegramLinkToken() {
  return useMutation({
    mutationFn: () => fetchStaffTelegramLinkToken(),
  })
}

export function useResetStaffTelegram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => resetStaffTelegram(userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-security'] })
    },
  })
}

export function useRevokeSecuritySession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => revokeSecuritySession(sessionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['security-sessions'] })
      void qc.invalidateQueries({ queryKey: ['platform-security'] })
    },
  })
}

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: fetchWebhooks,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useWebhookEvents() {
  return useQuery({
    queryKey: ['webhook-events'],
    queryFn: fetchWebhookEvents,
    staleTime: 60_000,
    retry: 1,
  })
}

export function useWebhookLogs(params?: { page?: number; limit?: number; event?: string }) {
  return useQuery({
    queryKey: ['webhook-logs', params],
    queryFn: () => fetchWebhookLogs(params),
    staleTime: 15_000,
    retry: 1,
  })
}

export function useWebhookStats(days?: number) {
  return useQuery({
    queryKey: ['webhook-stats', days],
    queryFn: () => fetchWebhookStats(days),
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCreateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { url: string; secret?: string; events: WebhookEventType[]; isActive?: boolean }) =>
      createWebhook(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['webhooks'] })
      void qc.invalidateQueries({ queryKey: ['platform-developer'] })
    },
  })
}

export function useUpdateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      url,
      ...data
    }: {
      url: string
      newUrl?: string
      secret?: string
      events?: WebhookEventType[]
      isActive?: boolean
    }) => updateWebhook(url, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['webhooks'] })
      void qc.invalidateQueries({ queryKey: ['platform-developer'] })
    },
  })
}

export function useDeleteWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (url: string) => deleteWebhook(url),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['webhooks'] })
      void qc.invalidateQueries({ queryKey: ['platform-developer'] })
    },
  })
}

export function useTestWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (event?: WebhookEventType) => testWebhook(event),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['webhook-logs'] })
      void qc.invalidateQueries({ queryKey: ['webhook-stats'] })
    },
  })
}

export function useDispatchWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ event, data }: { event: WebhookEventType; data?: Record<string, unknown> }) =>
      dispatchWebhook(event, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['webhook-logs'] })
      void qc.invalidateQueries({ queryKey: ['webhook-stats'] })
    },
  })
}


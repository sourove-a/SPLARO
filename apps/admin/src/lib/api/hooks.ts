'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchDashboardStats, fetchDashboardInsights, fetchInventoryAlerts, periodFromLabel } from './dashboard'
import { fetchOrders, fetchOrder, updateOrderStatus, updateOrderPaymentStatus, deleteOrder, bookOrderCourier, bookOrdersCourierBulk, createOrder, bulkUpdateOrderStatus } from './orders'
import { fetchProducts, createProduct, updateProduct, deleteProduct, fetchProduct, updateProductVariant, fetchProductVersions, restoreProductVersion, createProductVariant, archiveProductVariant } from './products'
import { fetchCategories, createCategory, updateCategory, deleteCategory } from './categories'
import { fetchCollections, createCollection, updateCollection } from './collections'
import { fetchBrands, createBrand, updateBrand } from './brands'
import { createBanner, fetchBanners, updateBanner, deleteBanner } from './banners'
import { createRedirect, deleteRedirect, fetchRedirects, updateRedirect } from './redirects'
import { EMPTY_HELPDESK_OVERVIEW, EMPTY_SEO_OVERVIEW, isNetworkOrServerError } from './offline-defaults'
import { fetchCustomers, fetchCustomer, deleteCustomer, blockCustomer } from './customers'
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
import { fetchCourierShipments, fetchCourierStats } from './courier'
import { fetchInvoices, fetchInvoiceHealth, fetchInvoiceStats, fetchTransactions, fetchTransactionHealth, fetchTransaction, fetchReturns, updateReturnStatus, type RmaApiStatus } from './commerce-finance'
import { fetchSettings, updateSettings, fetchNewsletterSubscribers, fetchCatalogChannelStats, type AdminSettingsData } from './settings'
import { revalidateWebCache } from './revalidate'
import {
  fetchSaaS,
  fetchSecurity,
  fetchMedia,
  fetchMarketplace,
  fetchDeveloper,
  fetchObservability,
  fetchIntegrations,
  fetchSystemLogs,
  fetchTelegramLogs,
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
  createPurchaseOrder,
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
import { fetchRolePermissions, fetchSecuritySessions, inviteAdmin, removeStaff, revokeSecuritySession, saveRolePermissions, updateStaffRole } from './security'
import { fetchLegalPage, fetchLegalPages, saveLegalPage } from './legal-pages'
import type { LegalPageContent, LegalPageSlug } from '@splaro/types'

export function useDashboardStats(periodLabel: string) {
  const period = periodFromLabel(periodLabel)
  return useQuery({
    queryKey: ['dashboard-stats', period],
    queryFn: () => fetchDashboardStats(period),
    staleTime: 60_000,
  })
}

export function useDashboardInsights(periodLabel: string) {
  const period = periodFromLabel(periodLabel)
  return useQuery({
    queryKey: ['dashboard-insights', period],
    queryFn: () => fetchDashboardInsights(period),
    staleTime: 60_000,
  })
}

export function useOrders(params?: { status?: string; search?: string; limit?: number; page?: number }) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () =>
      fetchOrders({
        ...params,
        page: params?.page ?? 1,
        limit: params?.limit ?? 50,
      }),
    staleTime: 30_000,
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id),
    enabled: Boolean(id),
    staleTime: 15_000,
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
    },
  })
}

export function useFootwearConfig() {
  return useQuery({
    queryKey: ['footwear-config'],
    queryFn: async () => {
      const res = await fetch('/api/footwear-config', { cache: 'no-store' })
      if (!res.ok) throw new Error('Footwear config unavailable')
      return res.json() as Promise<Record<string, unknown>>
    },
    staleTime: 30_000,
    retry: 1,
  })
}

export function useCreateBlogPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createBlogPost,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['content-overview'] }),
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['site-pages'] }),
  })
}

export function useUpdateSitePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof updateSitePage>[1]) =>
      updateSitePage(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['site-pages'] }),
  })
}

export function useDeleteSitePage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSitePage,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['site-pages'] }),
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
    staleTime: 30_000,
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

export function useCustomers(params?: { search?: string; limit?: number }) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => fetchCustomers({ ...params, limit: params?.limit ?? 100 }),
    staleTime: 30_000,
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
    mutationFn: ({ id, paymentStatus }: { id: string; paymentStatus: 'PAID' | 'UNPAID' | 'PENDING' }) =>
      updateOrderPaymentStatus(id, paymentStatus),
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

export function useProducts(params?: { search?: string; status?: 'published' | 'draft'; limit?: number; page?: number }) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => fetchProducts({ ...params, page: params?.page ?? 1, limit: params?.limit ?? 50 }),
    staleTime: 30_000,
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
    staleTime: 15_000,
    refetchOnWindowFocus: true,
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

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; isActive?: boolean; image?: string | null }) =>
      updateCategory(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      void qc.invalidateQueries({ queryKey: ['platform-media'] })
    },
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
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
        user?: { id: string; email: string; name: string; role: string; storeId?: string }
      }
      return data.user ?? null
    },
    staleTime: 60_000,
    retry: false,
  })
}

export function useSecuritySessions() {
  return useQuery({
    queryKey: ['security-sessions'],
    queryFn: fetchSecuritySessions,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useMedia() {
  return useQuery({ queryKey: ['platform-media'], queryFn: fetchMedia, staleTime: 30_000, retry: 1 })
}

export function useMarketplace() {
  return useQuery({ queryKey: ['platform-marketplace'], queryFn: fetchMarketplace, staleTime: 60_000, retry: 1 })
}

export function useDeveloper() {
  return useQuery({ queryKey: ['platform-developer'], queryFn: fetchDeveloper, staleTime: 60_000, retry: 1 })
}

export function useObservability() {
  return useQuery({ queryKey: ['platform-observability'], queryFn: fetchObservability, staleTime: 30_000, retry: 1 })
}

export function useIntegrations() {
  return useQuery({ queryKey: ['platform-integrations'], queryFn: fetchIntegrations, staleTime: 30_000, retry: 1 })
}

export function useSystemLogs() {
  return useQuery({ queryKey: ['platform-system-logs'], queryFn: () => fetchSystemLogs(), staleTime: 15_000, retry: 1 })
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
    },
  })
}

export function useUpdateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; isActive?: boolean }) =>
      updateCollection(id, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['collections'] }),
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['brands'] }),
  })
}

export function useUpdateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; vendorLabel?: string; isActive?: boolean }) =>
      updateBrand(id, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['brands'] }),
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

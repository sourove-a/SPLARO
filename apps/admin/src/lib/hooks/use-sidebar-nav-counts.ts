'use client'

import { useQuery } from '@tanstack/react-query'
import {
  fetchActionRequired,
  fetchInventoryAlerts,
  type ActionRequiredResponse,
  type InventoryAlertsResponse,
} from '@/lib/api/dashboard'

type NavCountData = {
  actions: ActionRequiredResponse
  inventory: InventoryAlertsResponse
}

function countForHref(href: string, data: NavCountData): number | undefined {
  switch (href) {
    case '/dashboard/orders':
      return data.actions.pendingOrders > 0 ? data.actions.pendingOrders : undefined
    case '/dashboard/product-reviews':
      return data.actions.pendingReviews > 0 ? data.actions.pendingReviews : undefined
    case '/dashboard/returns-rma':
      return data.actions.pendingRMAs > 0 ? data.actions.pendingRMAs : undefined
    case '/dashboard/inventory': {
      const total = data.inventory.lowStock + data.inventory.outOfStock
      return total > 0 ? total : undefined
    }
    default:
      return undefined
  }
}

export function useSidebarNavCounts() {
  const query = useQuery({
    queryKey: ['sidebar-nav-counts'],
    queryFn: async (): Promise<NavCountData> => {
      const [actions, inventory] = await Promise.all([
        fetchActionRequired(),
        fetchInventoryAlerts(),
      ])
      return { actions, inventory }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  })

  const getCount = (href: string): number | undefined => {
    if (!query.data) return undefined
    return countForHref(href, query.data)
  }

  return {
    getCount,
    isLoading: query.isLoading,
    isOffline: query.isError,
  }
}

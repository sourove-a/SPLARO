import { apiFetch } from './client'

export interface WmsWarehouse {
  id: string
  name: string
  code: string
  city: string | null
  address: string | null
  isActive: boolean
  staff?: { id: string }[]
  zones?: {
    racks?: {
      bins?: { availableQty: number; reservedQty: number; damagedQty: number }[]
    }[]
  }[]
}

export interface WmsMovement {
  id: string
  sku: string | null
  reason: string
  delta: number
  quantityBefore: number
  quantityAfter: number
  note: string | null
  createdAt: string
}

export interface WmsTransfer {
  id: string
  status: string
  notes: string | null
  createdAt: string
  fromWarehouse: { name: string }
  toWarehouse: { name: string }
  items?: { id: string }[]
}

export interface WmsOverview {
  warehouses: WmsWarehouse[]
  movements: WmsMovement[]
  transfers: WmsTransfer[]
  stockSummary: { available: number; reserved: number; damaged: number }
  productStock?: { units: number; skus: number }
}

export interface ProcurementSupplier {
  id: string
  name: string
  phone: string | null
  email: string | null
  dueAmount: string | number
  paidAmount: string | number
  isActive: boolean
}

export interface ProcurementOrder {
  id: string
  poNumber: string
  status: string
  total: string | number
  createdAt: string
  supplier: { name: string }
  items?: { id: string }[]
}

export interface GoodsReceivedNote {
  id: string
  grnNumber: string
  receivedAt: string
  notes: string | null
  purchaseOrder: { poNumber: string; supplier: { name: string } }
}

export interface ProcurementOverview {
  suppliers: ProcurementSupplier[]
  orders: ProcurementOrder[]
  grns: GoodsReceivedNote[]
}

export interface SupportTicketRow {
  id: string
  subject: string
  status: string
  channel: string
  priority: string
  updatedAt: string
  messages?: { body: string; createdAt: string }[]
}

export interface HelpdeskOverview {
  tickets: SupportTicketRow[]
  open: number
  total: number
}

export interface CompanyEmployee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  position: string | null
  salary: string | number
  status: string
}

export interface CompanyTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
}

export interface CompanyDocument {
  id: string
  title: string
  category: string | null
  createdAt: string
}

export interface CompanyOverview {
  departments: { id: string; name: string; code: string }[]
  employees: CompanyEmployee[]
  tasks: CompanyTask[]
  documents: CompanyDocument[]
}

export interface FabricRow {
  id: string
  name: string
  color: string | null
  quantity: string | number
  unit: string
  costPerUnit: string | number
}

export interface ProductionBatch {
  id: string
  productName: string
  quantity: number
  status: string
  createdAt: string
}

export interface ProductionOverview {
  fabrics: FabricRow[]
  batches: ProductionBatch[]
}

export interface DeliveryAgentRow {
  id: string
  name: string
  phone: string
  vehicleType: string | null
  isActive: boolean
  totalEarned: string | number
  _count?: { assignments: number }
}

export interface DeliveryAssignmentRow {
  id: string
  orderId: string
  status: string
  earnings: string | number
  updatedAt: string
  agent: { name: string; phone: string }
  order: {
    id: string
    invoiceNumber: string
    shippingName: string
    shippingCity: string
    total: string | number
    status: string
  } | null
}

export interface DeliveryOverview {
  agents: DeliveryAgentRow[]
  assignments: DeliveryAssignmentRow[]
}

export function fetchExecutiveDashboard() {
  return apiFetch<ExecutiveDashboardData>('/commerce-os/executive/dashboard')
}

export interface ExecutiveDashboardData {
  kpis: {
    revenue: number
    netProfit: number
    orders: number
    customers: number
    products: number
    warehouses: number
    inventoryValue?: number
    growth: number
  }
  partners: { name: string; balance: number; share: number }[]
  aiInsights: { id?: string; insight: string; category: string; confidence?: number }[]
  systemHealth?: { service: string; status: string; checkedAt: string }[]
}

export function fetchWmsOverview() {
  return apiFetch<WmsOverview>('/commerce-os/wms/overview')
}

export function fetchProcurementOverview() {
  return apiFetch<ProcurementOverview>('/commerce-os/procurement/overview')
}

export function fetchHelpdeskOverview() {
  return apiFetch<HelpdeskOverview>('/commerce-os/helpdesk/overview')
}

export function fetchCompanyOverview() {
  return apiFetch<CompanyOverview>('/commerce-os/company/overview')
}

export function fetchProductionOverview() {
  return apiFetch<ProductionOverview>('/commerce-os/production/overview')
}

export function fetchDeliveryOverview() {
  return apiFetch<DeliveryOverview>('/commerce-os/delivery/overview')
}

export function createWarehouse(input: { name: string; code: string; city?: string; address?: string }) {
  return apiFetch<WmsWarehouse>('/commerce-os/wms/warehouses', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function replyHelpdeskTicket(ticketId: string, message: string) {
  return apiFetch<{ ok: boolean; ticketId: string }>(`/commerce-os/helpdesk/tickets/${ticketId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export function askExecutiveAI(question: string) {
  return apiFetch<{ answer: string }>('/ai/executive/chat', {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
}

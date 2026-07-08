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

export function recordStockMovement(input: {
  sku?: string
  variantId?: string
  delta: number
  reason?: string
  note?: string
}) {
  return apiFetch<{ movement: WmsMovement }>('/commerce-os/wms/movements', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function createStockTransfer(input: {
  fromWarehouseId: string
  toWarehouseId: string
  sku: string
  quantity: number
  notes?: string
}) {
  return apiFetch<WmsTransfer>('/commerce-os/wms/transfers', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function shipStockTransfer(transferId: string) {
  return apiFetch<{ transfer: WmsTransfer }>(`/commerce-os/wms/transfers/${transferId}/ship`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function receiveStockTransfer(transferId: string) {
  return apiFetch<{ transfer: WmsTransfer }>(`/commerce-os/wms/transfers/${transferId}/receive`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function createDeliveryAgent(input: { name: string; phone: string; vehicleType?: string }) {
  return apiFetch<DeliveryAgentRow>('/commerce-os/delivery/agents', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateDeliveryAgent(agentId: string, input: { isActive?: boolean; name?: string; vehicleType?: string }) {
  return apiFetch<DeliveryAgentRow>(`/commerce-os/delivery/agents/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function assignOrderToAgent(input: { orderId: string; agentId: string; earnings?: number }) {
  return apiFetch<DeliveryAssignmentRow>('/commerce-os/delivery/assignments', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateDeliveryAssignmentStatus(assignmentId: string, status: string) {
  return apiFetch<{ assignment: DeliveryAssignmentRow }>(
    `/commerce-os/delivery/assignments/${assignmentId}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  )
}

export function createEmployee(input: {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  position?: string
  salary?: number
  departmentId?: string
}) {
  return apiFetch<CompanyEmployee>('/commerce-os/company/employees', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateEmployee(
  employeeId: string,
  input: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    position?: string
    salary?: number
    status?: string
  },
) {
  return apiFetch<CompanyEmployee>(`/commerce-os/company/employees/${employeeId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deactivateEmployee(employeeId: string) {
  return apiFetch<CompanyEmployee>(`/commerce-os/company/employees/${employeeId}/deactivate`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  })
}

export function createCompanyTask(input: {
  title: string
  description?: string
  priority?: string
  dueDate?: string
}) {
  return apiFetch<CompanyTask>('/commerce-os/company/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateCompanyTaskStatus(taskId: string, status: string) {
  return apiFetch<CompanyTask>(`/commerce-os/company/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export interface PayrollRunRow {
  id: string
  month: number
  year: number
  status: string
  total: string | number
  createdAt: string
  _count?: { items: number }
}

export function fetchPayrollRuns() {
  return apiFetch<PayrollRunRow[]>('/commerce-os/company/payroll/runs')
}

export function createPayrollRun(input: { month: number; year: number }) {
  return apiFetch<PayrollRunRow>('/commerce-os/company/payroll/runs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function createFabricInventory(input: {
  name: string
  color?: string
  quantity?: number
  unit?: string
  costPerUnit?: number
}) {
  return apiFetch<FabricRow>('/commerce-os/production/fabrics', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateFabricStock(fabricId: string, input: { delta?: number; quantity?: number }) {
  return apiFetch<FabricRow>(`/commerce-os/production/fabrics/${fabricId}/stock`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function createProductionBatch(input: {
  productName: string
  quantity: number
  notes?: string
  tailorName?: string
}) {
  return apiFetch<ProductionBatch>('/commerce-os/production/batches', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateProductionBatchStatus(batchId: string, status: string) {
  return apiFetch<ProductionBatch>(`/commerce-os/production/batches/${batchId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
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

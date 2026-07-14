import {
  fetchCompanyOverview,
  fetchDeliveryOverview,
  fetchHelpdeskOverview,
  fetchPayrollRuns,
  fetchProcurementOverview,
  fetchProductionOverview,
  type CompanyEmployee,
  type CompanyTask,
  type DeliveryAgentRow,
  type DeliveryAssignmentRow,
  type FabricRow,
  type PayrollRunRow,
  type ProcurementOrder,
  type ProcurementSupplier,
  type ProductionBatch,
  type SupportTicketRow,
} from '@/lib/api/commerce-os'
import {
  verifyBooleanEquals,
  verifyNumberEquals,
  verifyPersisted,
  verifyStringEquals,
} from './mutation-verify'
import { toastFail } from './feedback'

function hasId(saved: unknown): saved is { id: string } {
  return Boolean(saved && typeof saved === 'object' && 'id' in saved && String((saved as { id: unknown }).id).trim())
}

export function verifyHelpdeskReplyResponse(
  saved: unknown,
  ticketId: string,
): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Ticket reply did not persist on server')
  }
  const row = saved as { ok?: boolean; ticketId?: string }
  if (!verifyBooleanEquals(row.ok, true, 'Ticket reply')) return false
  return verifyStringEquals(row.ticketId, ticketId, 'Ticket reply')
}

export async function verifyHelpdeskReplyPersisted(
  ticketId: string,
  message: string,
): Promise<boolean> {
  try {
    const overview = await fetchHelpdeskOverview()
    const ticket = overview.tickets.find((t) => t.id === ticketId)
    if (!ticket) return verifyPersisted(false, 'Ticket reply did not persist on server')
    const latest = ticket.messages?.[0]?.body?.trim()
    return verifyPersisted(latest === message.trim(), 'Ticket reply did not persist on server')
  } catch {
    toastFail('Could not verify ticket reply on server')
    return false
  }
}

export function verifySupportTicketResponse(
  saved: unknown,
  expected: { subject: string },
): boolean {
  if (!hasId(saved)) return verifyPersisted(false, 'Support ticket did not persist on server')
  const row = saved as SupportTicketRow
  if (!verifyStringEquals(row.subject, expected.subject, 'Ticket subject')) return false
  return verifyPersisted(Boolean(row.id), 'Support ticket did not persist on server')
}

export async function verifySupportTicketPersisted(
  id: string,
  expected: { subject: string },
): Promise<boolean> {
  try {
    const overview = await fetchHelpdeskOverview()
    const ticket = overview.tickets.find((t) => t.id === id)
    if (!ticket) return verifyPersisted(false, 'Support ticket did not persist on server')
    return verifySupportTicketResponse(ticket, expected)
  } catch {
    toastFail('Could not verify support ticket on server')
    return false
  }
}

export function verifyEmployeeResponse(
  saved: unknown,
  expected: {
    firstName?: string
    lastName?: string
    phone?: string
    position?: string
    status?: string
  },
): boolean {
  if (!hasId(saved)) return verifyPersisted(false, 'Employee did not persist on server')
  const row = saved as CompanyEmployee
  if (expected.firstName !== undefined && !verifyStringEquals(row.firstName, expected.firstName, 'Employee first name')) {
    return false
  }
  if (expected.lastName !== undefined && !verifyStringEquals(row.lastName, expected.lastName, 'Employee last name')) {
    return false
  }
  if (expected.phone !== undefined && !verifyStringEquals(row.phone ?? '', expected.phone, 'Employee phone')) {
    return false
  }
  if (expected.position !== undefined && !verifyStringEquals(row.position ?? '', expected.position, 'Employee position')) {
    return false
  }
  if (expected.status !== undefined && !verifyStringEquals(row.status, expected.status, 'Employee status')) {
    return false
  }
  return true
}

export async function verifyEmployeePersisted(
  id: string,
  expected: {
    firstName?: string
    lastName?: string
    phone?: string
    position?: string
    status?: string
  },
): Promise<boolean> {
  try {
    const overview = await fetchCompanyOverview()
    const employee = overview.employees.find((e) => e.id === id)
    if (!employee) return verifyPersisted(false, 'Employee did not persist on server')
    return verifyEmployeeResponse(employee, expected)
  } catch {
    toastFail('Could not verify employee on server')
    return false
  }
}

export function verifyCompanyTaskResponse(
  saved: unknown,
  expected: { title?: string; priority?: string; status?: string },
): boolean {
  if (!hasId(saved)) return verifyPersisted(false, 'Task did not persist on server')
  const row = saved as CompanyTask
  if (expected.title !== undefined && !verifyStringEquals(row.title, expected.title, 'Task title')) {
    return false
  }
  if (expected.priority !== undefined && !verifyStringEquals(row.priority, expected.priority, 'Task priority')) {
    return false
  }
  if (expected.status !== undefined && !verifyStringEquals(row.status, expected.status, 'Task status')) {
    return false
  }
  return true
}

export async function verifyCompanyTaskPersisted(
  id: string,
  expected: { title?: string; priority?: string; status?: string },
): Promise<boolean> {
  try {
    const overview = await fetchCompanyOverview()
    const task = overview.tasks.find((t) => t.id === id)
    if (expected.status === 'DONE') {
      return verifyPersisted(!task, 'Task status did not persist on server')
    }
    if (!task) return verifyPersisted(false, 'Task did not persist on server')
    return verifyCompanyTaskResponse(task, expected)
  } catch {
    toastFail('Could not verify task on server')
    return false
  }
}

export function verifyPayrollRunResponse(
  saved: unknown,
  expected: { month: number; year: number },
): boolean {
  if (!hasId(saved)) return verifyPersisted(false, 'Payroll run did not persist on server')
  const row = saved as PayrollRunRow
  if (!verifyNumberEquals(row.month, expected.month, 'Payroll month')) return false
  return verifyNumberEquals(row.year, expected.year, 'Payroll year')
}

export async function verifyPayrollRunPersisted(
  id: string,
  expected: { month: number; year: number },
): Promise<boolean> {
  try {
    const runs = await fetchPayrollRuns()
    const run = runs.find((r) => r.id === id)
    if (!run) return verifyPersisted(false, 'Payroll run did not persist on server')
    return verifyPayrollRunResponse(run, expected)
  } catch {
    toastFail('Could not verify payroll run on server')
    return false
  }
}

export function verifyDeliveryAgentResponse(
  saved: unknown,
  expected: { name?: string; phone?: string; isActive?: boolean },
): boolean {
  if (!hasId(saved)) return verifyPersisted(false, 'Delivery agent did not persist on server')
  const row = saved as DeliveryAgentRow
  if (expected.name !== undefined && !verifyStringEquals(row.name, expected.name, 'Agent name')) {
    return false
  }
  if (expected.phone !== undefined && !verifyStringEquals(row.phone, expected.phone, 'Agent phone')) {
    return false
  }
  if (expected.isActive !== undefined && !verifyBooleanEquals(row.isActive, expected.isActive, 'Agent status')) {
    return false
  }
  return true
}

export async function verifyDeliveryAgentPersisted(
  id: string,
  expected: { name?: string; phone?: string; isActive?: boolean },
): Promise<boolean> {
  try {
    const overview = await fetchDeliveryOverview()
    const agent = overview.agents.find((a) => a.id === id)
    if (!agent) return verifyPersisted(false, 'Delivery agent did not persist on server')
    return verifyDeliveryAgentResponse(agent, expected)
  } catch {
    toastFail('Could not verify delivery agent on server')
    return false
  }
}

export function verifyDeliveryAssignmentResponse(
  saved: unknown,
  expected: { orderId?: string; agentId?: string; status?: string },
): boolean {
  const row =
    saved && typeof saved === 'object' && 'assignment' in saved
      ? (saved as { assignment: DeliveryAssignmentRow & { agentId?: string } }).assignment
      : (saved as DeliveryAssignmentRow & { agentId?: string })
  if (!hasId(row)) return verifyPersisted(false, 'Delivery assignment did not persist on server')
  if (expected.orderId !== undefined && !verifyStringEquals(row.orderId, expected.orderId, 'Assignment order')) {
    return false
  }
  if (expected.agentId !== undefined) {
    const agentId = row.agentId ?? ''
    if (!verifyStringEquals(agentId, expected.agentId, 'Assignment agent')) return false
  }
  if (expected.status !== undefined && !verifyStringEquals(row.status, expected.status, 'Assignment status')) {
    return false
  }
  return true
}

export async function verifyDeliveryAssignmentPersisted(
  id: string,
  expected: { orderId?: string; status?: string },
): Promise<boolean> {
  try {
    const overview = await fetchDeliveryOverview()
    const assignment = overview.assignments.find((a) => a.id === id)
    if (!assignment) return verifyPersisted(false, 'Delivery assignment did not persist on server')
    return verifyDeliveryAssignmentResponse(assignment, expected)
  } catch {
    toastFail('Could not verify delivery assignment on server')
    return false
  }
}

export function verifySupplierResponse(
  saved: unknown,
  expected: { name: string },
): boolean {
  if (!hasId(saved)) return verifyPersisted(false, 'Supplier did not persist on server')
  const row = saved as ProcurementSupplier
  return verifyStringEquals(row.name, expected.name, 'Supplier name')
}

export async function verifySupplierPersisted(
  id: string,
  expected: { name: string },
): Promise<boolean> {
  try {
    const overview = await fetchProcurementOverview()
    const supplier = overview.suppliers.find((s) => s.id === id)
    if (!supplier) return verifyPersisted(false, 'Supplier did not persist on server')
    return verifySupplierResponse(supplier, expected)
  } catch {
    toastFail('Could not verify supplier on server')
    return false
  }
}

export function verifyPurchaseOrderResponse(
  saved: unknown,
  expected: { supplierId?: string; poNumber?: string },
): boolean {
  if (!hasId(saved)) return verifyPersisted(false, 'Purchase order did not persist on server')
  const row = saved as ProcurementOrder & { supplierId?: string }
  if (expected.poNumber !== undefined && !verifyStringEquals(row.poNumber, expected.poNumber, 'PO number')) {
    return false
  }
  if (expected.supplierId !== undefined) {
    const supplierId = 'supplierId' in row ? String(row.supplierId ?? '') : ''
    if (!verifyStringEquals(supplierId, expected.supplierId, 'PO supplier')) return false
  }
  return verifyPersisted(Boolean(row.poNumber), 'Purchase order did not persist on server')
}

export async function verifyPurchaseOrderPersisted(
  id: string,
  expected: { poNumber?: string; status?: string },
): Promise<boolean> {
  try {
    const overview = await fetchProcurementOverview()
    const order = overview.orders.find((o) => o.id === id)
    if (!order) return verifyPersisted(false, 'Purchase order did not persist on server')
    if (expected.poNumber !== undefined && !verifyStringEquals(order.poNumber, expected.poNumber, 'PO number')) {
      return false
    }
    if (expected.status !== undefined && !verifyStringEquals(order.status, expected.status, 'PO status')) {
      return false
    }
    return true
  } catch {
    toastFail('Could not verify purchase order on server')
    return false
  }
}

export function verifyGoodsGrnResponse(
  saved: unknown,
  purchaseOrderId: string,
): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'GRN did not persist on server')
  }
  const row = saved as {
    grn?: { id?: string; grnNumber?: string }
    purchaseOrder?: { id?: string; status?: string }
  }
  if (!verifyPersisted(Boolean(row.grn?.id && row.grn?.grnNumber), 'GRN did not persist on server')) {
    return false
  }
  if (!verifyStringEquals(row.purchaseOrder?.id, purchaseOrderId, 'GRN purchase order')) {
    return false
  }
  return verifyStringEquals(row.purchaseOrder?.status, 'RECEIVED', 'PO receive status')
}

export async function verifyGoodsGrnPersisted(
  purchaseOrderId: string,
  grnNumber: string,
): Promise<boolean> {
  try {
    const overview = await fetchProcurementOverview()
    const grn = overview.grns.find((g) => g.grnNumber === grnNumber)
    if (!grn) return verifyPersisted(false, 'GRN did not persist on server')
    const order = overview.orders.find((o) => o.id === purchaseOrderId)
    return verifyPersisted(order?.status === 'RECEIVED', 'GRN did not persist on server')
  } catch {
    toastFail('Could not verify GRN on server')
    return false
  }
}

export function verifyFabricResponse(
  saved: unknown,
  expected: { name?: string; color?: string; quantity?: number },
): boolean {
  if (!hasId(saved)) return verifyPersisted(false, 'Fabric did not persist on server')
  const row = saved as FabricRow
  if (expected.name !== undefined && !verifyStringEquals(row.name, expected.name, 'Fabric name')) {
    return false
  }
  if (expected.color !== undefined && !verifyStringEquals(row.color ?? '', expected.color, 'Fabric color')) {
    return false
  }
  if (expected.quantity !== undefined && !verifyNumberEquals(Number(row.quantity), expected.quantity, 'Fabric quantity')) {
    return false
  }
  return true
}

export async function verifyFabricPersisted(
  id: string,
  expected: { name?: string; color?: string; quantity?: number },
): Promise<boolean> {
  try {
    const overview = await fetchProductionOverview()
    const fabric = overview.fabrics.find((f) => f.id === id)
    if (!fabric) return verifyPersisted(false, 'Fabric did not persist on server')
    return verifyFabricResponse(fabric, expected)
  } catch {
    toastFail('Could not verify fabric on server')
    return false
  }
}

export function verifyProductionBatchResponse(
  saved: unknown,
  expected: { productName?: string; quantity?: number; status?: string },
): boolean {
  if (!hasId(saved)) return verifyPersisted(false, 'Production batch did not persist on server')
  const row = saved as ProductionBatch
  if (expected.productName !== undefined && !verifyStringEquals(row.productName, expected.productName, 'Batch product')) {
    return false
  }
  if (expected.quantity !== undefined && !verifyNumberEquals(row.quantity, expected.quantity, 'Batch quantity')) {
    return false
  }
  if (expected.status !== undefined && !verifyStringEquals(row.status, expected.status, 'Batch status')) {
    return false
  }
  return true
}

export async function verifyProductionBatchPersisted(
  id: string,
  expected: { productName?: string; quantity?: number; status?: string },
): Promise<boolean> {
  try {
    const overview = await fetchProductionOverview()
    const batch = overview.batches.find((b) => b.id === id)
    if (!batch) return verifyPersisted(false, 'Production batch did not persist on server')
    return verifyProductionBatchResponse(batch, expected)
  } catch {
    toastFail('Could not verify production batch on server')
    return false
  }
}

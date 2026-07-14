import { toastApiSaved, toastFail } from './feedback'
import {
  verifyCompanyTaskPersisted,
  verifyCompanyTaskResponse,
  verifyDeliveryAgentPersisted,
  verifyDeliveryAgentResponse,
  verifyDeliveryAssignmentPersisted,
  verifyDeliveryAssignmentResponse,
  verifyEmployeePersisted,
  verifyEmployeeResponse,
  verifyFabricPersisted,
  verifyFabricResponse,
  verifyGoodsGrnPersisted,
  verifyGoodsGrnResponse,
  verifyHelpdeskReplyPersisted,
  verifyHelpdeskReplyResponse,
  verifyPayrollRunPersisted,
  verifyPayrollRunResponse,
  verifyProductionBatchPersisted,
  verifyProductionBatchResponse,
  verifyPurchaseOrderPersisted,
  verifyPurchaseOrderResponse,
  verifySupplierPersisted,
  verifySupplierResponse,
  verifySupportTicketPersisted,
  verifySupportTicketResponse,
} from './ops-mutation-verify'

export async function confirmHelpdeskReplySaved(
  ticketId: string,
  message: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyHelpdeskReplyResponse(saved, ticketId)) return false
    if (!(await verifyHelpdeskReplyPersisted(ticketId, message))) return false
    toastApiSaved('Reply saved')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not save reply.')
    return false
  }
}

export async function confirmSupportTicketCreated(
  expected: { subject: string },
  save: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifySupportTicketResponse(saved, expected)) return null
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifySupportTicketPersisted(id, expected))) return null
    toastApiSaved('Support ticket created')
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not create support ticket.')
    return null
  }
}

export async function confirmEmployeeCreated(
  expected: {
    firstName: string
    lastName: string
    phone?: string
    position?: string
  },
  save: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifyEmployeeResponse(saved, expected)) return null
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyEmployeePersisted(id, { ...expected, status: 'ACTIVE' }))) return null
    toastApiSaved('Employee created')
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not create employee.')
    return null
  }
}

export async function confirmEmployeeUpdated(
  id: string,
  expected: {
    firstName: string
    lastName: string
    phone?: string
    position?: string
  },
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyEmployeeResponse(saved, expected)) return false
    if (!(await verifyEmployeePersisted(id, expected))) return false
    toastApiSaved('Employee updated')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update employee.')
    return false
  }
}

export async function confirmEmployeeDeactivated(
  id: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyEmployeeResponse(saved, { status: 'TERMINATED' })) return false
    if (!(await verifyEmployeePersisted(id, { status: 'TERMINATED' }))) return false
    toastApiSaved('Employee deactivated')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not deactivate employee.')
    return false
  }
}

export async function confirmCompanyTaskCreated(
  expected: { title: string; priority: string },
  save: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifyCompanyTaskResponse(saved, { ...expected, status: 'TODO' })) return null
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyCompanyTaskPersisted(id, expected))) return null
    toastApiSaved('Task created')
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not create task.')
    return null
  }
}

export async function confirmCompanyTaskStatusUpdated(
  id: string,
  status: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyCompanyTaskResponse(saved, { status })) return false
    if (!(await verifyCompanyTaskPersisted(id, { status }))) return false
    toastApiSaved('Task status updated')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update task.')
    return false
  }
}

export async function confirmPayrollRunCreated(
  month: number,
  year: number,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyPayrollRunResponse(saved, { month, year })) return false
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyPayrollRunPersisted(id, { month, year }))) return false
    toastApiSaved(`Payroll run created for ${month}/${year}`)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not create payroll run.')
    return false
  }
}

export async function confirmDeliveryAgentCreated(
  expected: { name: string; phone: string; vehicleType?: string },
  save: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifyDeliveryAgentResponse(saved, { name: expected.name, phone: expected.phone, isActive: true })) {
      return null
    }
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyDeliveryAgentPersisted(id, { name: expected.name, phone: expected.phone, isActive: true }))) {
      return null
    }
    toastApiSaved('Delivery agent created')
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not create agent.')
    return null
  }
}

export async function confirmDeliveryAgentActiveUpdated(
  id: string,
  isActive: boolean,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyDeliveryAgentResponse(saved, { isActive })) return false
    if (!(await verifyDeliveryAgentPersisted(id, { isActive }))) return false
    toastApiSaved(isActive ? 'Agent activated' : 'Agent deactivated')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update agent status.')
    return false
  }
}

export async function confirmOrderAssigned(
  orderId: string,
  agentId: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyDeliveryAssignmentResponse(saved, { orderId, agentId, status: 'ASSIGNED' })) return false
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyDeliveryAssignmentPersisted(id, { orderId, status: 'ASSIGNED' }))) {
      return false
    }
    toastApiSaved('Order assigned to agent')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not assign order.')
    return false
  }
}

export async function confirmDeliveryAssignmentStatusUpdated(
  id: string,
  status: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyDeliveryAssignmentResponse(saved, { status })) return false
    if (!(await verifyDeliveryAssignmentPersisted(id, { status }))) return false
    toastApiSaved('Assignment status updated')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update status.')
    return false
  }
}

export async function confirmSupplierCreated(
  expected: { name: string },
  save: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifySupplierResponse(saved, expected)) return null
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifySupplierPersisted(id, expected))) return null
    toastApiSaved('Supplier created')
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not create supplier.')
    return null
  }
}

export async function confirmPurchaseOrderCreated(
  supplierId: string,
  save: () => Promise<unknown>,
): Promise<{ id: string; poNumber: string } | null> {
  try {
    const saved = await save()
    if (!verifyPurchaseOrderResponse(saved, { supplierId })) return null
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    const poNumber =
      saved && typeof saved === 'object' && 'poNumber' in saved
        ? String((saved as { poNumber: string }).poNumber)
        : ''
    if (!id || !poNumber || !(await verifyPurchaseOrderPersisted(id, { poNumber }))) return null
    toastApiSaved(`Purchase order ${poNumber} created`)
    return { id, poNumber }
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not create purchase order.')
    return null
  }
}

export async function confirmGoodsGrnReceived(
  purchaseOrderId: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyGoodsGrnResponse(saved, purchaseOrderId)) return false
    const grnNumber =
      saved && typeof saved === 'object' && 'grn' in saved
        ? String((saved as { grn: { grnNumber: string } }).grn.grnNumber)
        : ''
    const poNumber =
      saved && typeof saved === 'object' && 'purchaseOrder' in saved
        ? String((saved as { purchaseOrder: { poNumber: string } }).purchaseOrder.poNumber)
        : ''
    if (!grnNumber || !(await verifyGoodsGrnPersisted(purchaseOrderId, grnNumber))) return false
    toastApiSaved(`GRN ${grnNumber} recorded — PO ${poNumber} marked received`)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not receive goods.')
    return false
  }
}

export async function confirmFabricCreated(
  expected: { name: string; color?: string; quantity: number },
  save: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifyFabricResponse(saved, expected)) return null
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyFabricPersisted(id, expected))) return null
    toastApiSaved('Fabric inventory item created')
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not create fabric.')
    return null
  }
}

export async function confirmFabricStockUpdated(
  id: string,
  expectedQuantity: number,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyFabricResponse(saved, { quantity: expectedQuantity })) return false
    if (!(await verifyFabricPersisted(id, { quantity: expectedQuantity }))) return false
    toastApiSaved('Fabric stock updated')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update fabric stock.')
    return false
  }
}

export async function confirmProductionBatchCreated(
  expected: { productName: string; quantity: number },
  save: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifyProductionBatchResponse(saved, { ...expected, status: 'PENDING' })) return null
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyProductionBatchPersisted(id, expected))) return null
    toastApiSaved('Production batch created')
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not create batch.')
    return null
  }
}

export async function confirmProductionBatchStatusUpdated(
  id: string,
  status: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyProductionBatchResponse(saved, { status })) return false
    if (!(await verifyProductionBatchPersisted(id, { status }))) return false
    toastApiSaved('Batch status updated')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update batch status.')
    return false
  }
}

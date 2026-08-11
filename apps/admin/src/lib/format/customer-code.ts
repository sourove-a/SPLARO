import type { ApiCustomer } from '@/lib/api/customers'
import { displayCustomerCode } from '@splaro/config'

/** Public admin route segment — SPL-C-###### when assigned, else internal id. */
export function customerPublicId(customer: Pick<ApiCustomer, 'id' | 'customerCode'>): string {
  const code = customer.customerCode?.trim()
  if (code) return code.toUpperCase()
  return customer.id
}

export function customerDisplayCode(customer: Pick<ApiCustomer, 'id' | 'customerCode'>): string {
  return displayCustomerCode(customer.customerCode, customer.id)
}

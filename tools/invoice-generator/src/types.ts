export interface InvoiceLineItem {
  productName: string
  sku: string
  size: string
  color: string
  quantity: number
  unitPrice: number
  discount: number
  lineTotal: number
  imageUrl?: string
}

export interface InvoiceInput {
  invoiceNumber: string
  orderId: string
  issueDate: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  shippingAddress: string
  shippingCity: string
  shippingDistrict: string
  paymentMethod: string
  paymentStatus: string
  orderStatus: string
  subtotal: number
  deliveryCharge: number
  discount: number
  total: number
  couponCode?: string
  courierName?: string
  trackingCode?: string
  items: InvoiceLineItem[]
  siteUrl?: string
  storeLogo?: string
}

export type InvoiceTemplateKind = 'a4' | 'receipt' | 'label'

export interface GenerateOptions {
  template?: InvoiceTemplateKind
  showToolbar?: boolean
  autoPrint?: boolean
}

import { Injectable } from '@nestjs/common'
import { InvoiceService } from '../invoices/invoice.service'

@Injectable()
export class PrintService {
  constructor(private readonly invoices: InvoiceService) {}

  invoiceHtml(orderId: string, options?: { showToolbar?: boolean; autoPrint?: boolean }) {
    return this.invoices.buildHtml(orderId, options)
  }
}

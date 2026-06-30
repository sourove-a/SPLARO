'use client'

import toast from 'react-hot-toast'
import { Download, Eye, Mail, MessageCircle, Printer } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import {
  downloadInvoice,
  downloadInvoicePdf,
  printInvoice,
} from '@/lib/admin/admin-actions'
import { fetchOrderInvoiceWhatsApp, sendOrderInvoiceEmail } from '@/lib/api/orders'

interface InvoiceActionsBarProps {
  orderId: string
  invoiceNumber: string
  customerPhone?: string
}

export function InvoiceActionsBar({ orderId, invoiceNumber, customerPhone }: InvoiceActionsBarProps) {
  const sendEmail = async () => {
    try {
      const result = await sendOrderInvoiceEmail(orderId)
      if (result.sent) {
        toast.success(`Invoice emailed to ${result.to ?? 'customer'}.`)
      } else {
        toast.error('No valid customer email found for this order.')
      }
    } catch {
      toast.error('Could not send invoice email.')
    }
  }

  const sendWhatsApp = async () => {
    try {
      const links = await fetchOrderInvoiceWhatsApp(orderId)
      const target = links.customerUrl ?? links.supportUrl
      window.open(target, '_blank', 'noopener,noreferrer')
      if (!links.customerUrl && customerPhone) {
        toast('Opened SPLARO support WhatsApp. Customer number may need manual paste.', { icon: 'ℹ️' })
      }
    } catch {
      toast.error('Could not open WhatsApp share.')
    }
  }

  return (
    <div className="rounded-[16px] border border-[#5e7cff33] bg-white/80 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#1c1c24]/95">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#9a7848] dark:text-[#d4b896]">
        Premium invoice
      </p>
      <div className="flex flex-wrap gap-2">
        <AdminButton className="!text-xs" onClick={() => downloadInvoice(orderId)}>
          <Eye className="h-3.5 w-3.5" />
          View
        </AdminButton>
        <AdminButton className="!text-xs" onClick={() => downloadInvoicePdf(orderId, invoiceNumber)}>
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </AdminButton>
        <AdminButton className="!text-xs" onClick={() => printInvoice(orderId)}>
          <Printer className="h-3.5 w-3.5" />
          Print
        </AdminButton>
        <AdminButton className="!text-xs" variant="gold" onClick={() => void sendEmail()}>
          <Mail className="h-3.5 w-3.5" />
          Email customer
        </AdminButton>
        <AdminButton className="!text-xs" variant="ghost" onClick={() => void sendWhatsApp()}>
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </AdminButton>
      </div>
    </div>
  )
}

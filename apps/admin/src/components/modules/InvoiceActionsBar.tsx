'use client'

import { useState } from 'react'
import { Download, Eye, Mail, MessageCircle, Printer } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import {
  downloadInvoice,
  downloadInvoicePdf,
  printInvoice,
} from '@/lib/admin/admin-actions'
import { toastApiSaved, toastFail, toastInfo } from '@/lib/admin/feedback'
import { verifyPersisted } from '@/lib/admin/mutation-verify'
import { fetchOrderInvoiceWhatsApp, sendOrderInvoiceEmail } from '@/lib/api/orders'

interface InvoiceActionsBarProps {
  orderId: string
  invoiceNumber: string
  customerPhone?: string
}

type BusyAction = 'view' | 'pdf' | 'print' | 'email' | 'whatsapp' | null

export function InvoiceActionsBar({ orderId, invoiceNumber, customerPhone }: InvoiceActionsBarProps) {
  const [busy, setBusy] = useState<BusyAction>(null)
  // Prefer SPL-#### in the address bar — API accepts invoiceNumber or cuid.
  const invoiceRef = invoiceNumber?.trim() || orderId

  const run = async (action: Exclude<BusyAction, null>, fn: () => Promise<unknown>) => {
    if (busy) return
    setBusy(action)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  const sendEmail = async () => {
    try {
      const result = await sendOrderInvoiceEmail(orderId)
      if (!verifyPersisted(result.sent === true, 'Invoice email was not sent by server')) return
      if (!result.to?.trim()) {
        toastFail('No valid customer email found for this order.')
        return
      }
      toastApiSaved(`Invoice email to ${result.to}`)
    } catch {
      toastFail('Could not send invoice email.')
    }
  }

  const sendWhatsApp = async () => {
    try {
      const links = await fetchOrderInvoiceWhatsApp(orderId)
      if (!links.supportUrl && !links.customerUrl) {
        toastFail('WhatsApp share link not available from server.')
        return
      }
      const target = links.customerUrl ?? links.supportUrl
      window.open(target, '_blank', 'noopener,noreferrer')
      if (!links.customerUrl && customerPhone) {
        toastInfo('Opened SPLARO support WhatsApp. Customer number may need manual paste.')
      } else {
        toastInfo('WhatsApp share opened.')
      }
    } catch {
      toastFail('Could not open WhatsApp share.')
    }
  }

  return (
    <div className="rounded-[16px] border border-[#10111422] bg-white/80 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#1c1c24]/95">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#9a7848] dark:text-[#d4b896]">
        Premium invoice · {invoiceNumber}
      </p>
      <div className="flex flex-wrap gap-2">
        <AdminButton
          size="sm"
          disabled={busy !== null}
          loading={busy === 'view'}
          onClick={() => void run('view', () => downloadInvoice(invoiceRef))}
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </AdminButton>
        <AdminButton
          size="sm"
          disabled={busy !== null}
          loading={busy === 'pdf'}
          onClick={() => void run('pdf', () => downloadInvoicePdf(invoiceRef, invoiceNumber))}
        >
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </AdminButton>
        <AdminButton
          size="sm"
          disabled={busy !== null}
          loading={busy === 'print'}
          onClick={() => void run('print', () => printInvoice(invoiceRef))}
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </AdminButton>
        <AdminButton
          size="sm"
          variant="gold"
          disabled={busy !== null}
          loading={busy === 'email'}
          onClick={() => void run('email', sendEmail)}
        >
          <Mail className="h-3.5 w-3.5" />
          Email customer
        </AdminButton>
        <AdminButton
          size="sm"
          variant="ghost"
          disabled={busy !== null}
          loading={busy === 'whatsapp'}
          onClick={() => void run('whatsapp', sendWhatsApp)}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </AdminButton>
      </div>
    </div>
  )
}

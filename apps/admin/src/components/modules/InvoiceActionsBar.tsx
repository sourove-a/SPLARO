'use client'

import { useState } from 'react'
import { Download, Eye, Mail, MessageCircle, Printer, Tag, Truck } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import {
  downloadInvoice,
  downloadInvoicePdf,
  printInvoice,
  printOrderLabel,
  printOrderSticker,
} from '@/lib/admin/admin-actions'
import { toastApiSaved, toastFail, toastInfo, toastWarn } from '@/lib/admin/feedback'
import { verifyPersisted } from '@/lib/admin/mutation-verify'
import { fetchOrderInvoiceWhatsApp, sendOrderInvoiceEmail } from '@/lib/api/orders'
import { cancelCourierBookingLocal, trackCourierParcel } from '@/lib/api/fulfillment'

interface InvoiceActionsBarProps {
  orderId: string
  invoiceNumber: string
  customerPhone?: string
  hasCourier?: boolean
}

type BusyAction =
  | 'view'
  | 'pdf'
  | 'print'
  | 'email'
  | 'whatsapp'
  | 'label'
  | 'sticker'
  | 'track'
  | 'cancel-booking'
  | null

export function InvoiceActionsBar({
  orderId,
  invoiceNumber,
  customerPhone,
  hasCourier = false,
}: InvoiceActionsBarProps) {
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

  const trackParcel = async () => {
    try {
      const track = await trackCourierParcel(orderId)
      if (!track.status && !track.trackingCode) {
        toastFail('No courier tracking yet — book courier first.')
        return
      }
      toastInfo(
        [track.provider, track.status, track.trackingCode].filter(Boolean).join(' · '),
      )
      if (track.trackingUrl) window.open(track.trackingUrl, '_blank', 'noopener,noreferrer')
    } catch {
      toastFail('Could not fetch tracking status.')
    }
  }

  const cancelBooking = async () => {
    if (
      !window.confirm(
        'Cancel courier booking for this order? Local cancel only — Steadfast may still hold the parcel.',
      )
    ) {
      return
    }
    try {
      const res = await cancelCourierBookingLocal(orderId)
      toastWarn(res.message, `cancel-booking-${orderId}`)
    } catch {
      toastFail('Could not cancel booking locally.')
    }
  }

  return (
    <div className="rounded-[16px] border border-[var(--admin-color-ink-elevated)] bg-white/80 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-[var(--admin-c-1c1c24)]/95">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--admin-c-9a7848)] dark:text-[var(--admin-c-d4b896)]">
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
          variant="dark"
          disabled={busy !== null}
          loading={busy === 'label'}
          onClick={() => void run('label', () => printOrderLabel(invoiceRef))}
        >
          <Tag className="h-3.5 w-3.5" />
          Print Label
        </AdminButton>
        <AdminButton
          size="sm"
          disabled={busy !== null}
          loading={busy === 'sticker'}
          onClick={() => void run('sticker', () => printOrderSticker(invoiceRef))}
        >
          Sticker
        </AdminButton>
        {hasCourier ? (
          <>
            <AdminButton
              size="sm"
              disabled={busy !== null}
              loading={busy === 'track'}
              onClick={() => void run('track', trackParcel)}
            >
              <Truck className="h-3.5 w-3.5" />
              Track Parcel
            </AdminButton>
            <AdminButton
              size="sm"
              variant="warning"
              disabled={busy !== null}
              loading={busy === 'cancel-booking'}
              onClick={() => void run('cancel-booking', cancelBooking)}
            >
              Cancel Booking
            </AdminButton>
          </>
        ) : null}
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

/**
 * Email-client-safe invoice body — compact, mobile-first, inline styles.
 * Modern quiet-luxury order summary with email-safe table layout.
 */
import type { InvoiceViewModel } from './invoice.helpers'
import { escapeHtml, formatBdt } from './invoice.helpers'

function itemMeta(item: InvoiceViewModel['items'][number]): string {
  const size = item.size !== '—' ? item.size.trim() : ''
  const color = item.color !== '—' ? item.color.trim() : ''
  const parts: string[] = []
  if (size) parts.push(size)
  if (color && color.toLowerCase() !== size.toLowerCase()) parts.push(color)
  return parts.join(' · ')
}

function productThumb(url: string, name: string): string {
  if (!url) {
    const initial = escapeHtml(name.charAt(0).toUpperCase() || 'S')
    return `<td width="72" valign="top" style="width:72px;padding:0 14px 0 0;vertical-align:top;">
      <div style="width:58px;height:72px;border-radius:12px;background:#f1f1ef;border:1px solid #e2e2df;text-align:center;line-height:72px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:18px;font-weight:700;color:#6c6c67;">${initial}</div>
    </td>`
  }
  return `<td width="72" valign="top" style="width:72px;padding:0 14px 0 0;vertical-align:top;">
    <img src="${escapeHtml(url)}" alt="" width="58" height="72" style="display:block;width:58px;height:72px;max-width:58px;border:1px solid #e2e2df;border-radius:12px;object-fit:cover;" />
  </td>`
}

function customerFacingOrderLabel(statusKey: string, status: string): string {
  if (statusKey === 'PENDING') return 'Order received'
  if (statusKey === 'CONFIRMED' || statusKey === 'PROCESSING') return 'Confirmed'
  return status
}

function shortPaymentMethod(method: string): string {
  if (method === 'Cash on Delivery') return 'Cash on delivery'
  return method
}

export function generateInvoiceEmailBody(model: InvoiceViewModel): string {
  const itemCount = model.items.reduce((n, i) => n + i.quantity, 0)
  const totalDue =
    model.dueAmount > 0 && model.dueAmount !== model.grandTotal
      ? model.dueAmount
      : model.grandTotal
  const orderLabel = customerFacingOrderLabel(model.orderStatusKey, model.orderStatus)
  const payMethod = shortPaymentMethod(model.paymentMethod)

  const itemRows = model.items
    .map((item, index) => {
      const meta = itemMeta(item)
      const border = index < model.items.length - 1 ? 'border-bottom:1px solid #ececea;' : ''
      return `<tr>
        <td style="padding:14px 0;${border}">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
            <tr>
              ${productThumb(item.imageUrl, item.productName)}
              <td valign="top" style="padding:0;vertical-align:top;">
                <p style="margin:0;color:#111111;font-size:15px;line-height:1.35;font-weight:700;">${escapeHtml(item.productName)}</p>
                ${meta ? `<p style="margin:4px 0 0;color:#686863;font-size:12px;line-height:1.4;">${escapeHtml(meta)}</p>` : ''}
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;margin-top:8px;">
                  <tr>
                    <td style="color:#686863;font-size:12px;line-height:1.4;">Quantity ${item.quantity}</td>
                    <td align="right" style="color:#111111;font-size:14px;line-height:1.3;font-weight:700;white-space:nowrap;">${formatBdt(item.lineTotal)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    })
    .join('')

  const totals: Array<{ label: string; value: string }> = [
    { label: 'Subtotal', value: formatBdt(model.subtotal) },
  ]
  if (model.deliveryCharge > 0) {
    totals.push({ label: 'Delivery', value: formatBdt(model.deliveryCharge) })
  }
  if (model.discount > 0) {
    totals.push({
      label: model.couponCode ? `Discount (${model.couponCode})` : 'Discount',
      value: `−${formatBdt(model.couponCode ? model.couponDiscount || model.discount : model.discount)}`,
    })
  }
  if (model.advancePaid > 0) {
    totals.push({ label: 'Advance paid', value: `−${formatBdt(model.advancePaid)}` })
  }

  const totalRows = totals
    .map(
      (row) => `<tr>
      <td style="padding:5px 0;color:#686863;font-size:13px;line-height:1.4;">${escapeHtml(row.label)}</td>
      <td align="right" style="padding:5px 0;color:#111111;font-size:13px;line-height:1.4;font-weight:600;white-space:nowrap;">${row.value}</td>
    </tr>`,
    )
    .join('')

  const phone = model.customerPhone ? escapeHtml(model.customerPhone) : ''
  const addressLine = escapeHtml(model.customerAddress.replace(/\s+/g, ' ').trim())
  const tracking = model.courierTracking?.trim()
  const trackingLine = tracking
    ? `<p style="margin:8px 0 0;color:#686863;font-size:11px;line-height:1.4;">Tracking · ${escapeHtml(tracking)}</p>`
    : ''

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#ffffff;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#111111;">
  <tr>
    <td style="padding:8px 2px 4px;">
      <span style="display:inline-block;margin:0 6px 8px 0;padding:7px 11px;border-radius:999px;background:#f1f1ef;color:#3a3a37;font-size:9px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;">${escapeHtml(orderLabel)}</span>
      <span style="display:inline-block;margin:0 0 8px;padding:7px 11px;border-radius:999px;background:#111111;color:#ffffff;font-size:9px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;">${escapeHtml(payMethod)}</span>
    </td>
  </tr>

  <tr>
    <td style="padding:2px 2px 14px;">
      <table role="presentation" class="rounded-table" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e2df;border-radius:16px;background:#f6f6f4;">
        <tr>
          <td style="padding:18px 18px;border-radius:16px;">
            <p style="margin:0;color:#6c655a;font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;"><span style="display:inline-block;width:6px;height:6px;margin:0 8px 1px 0;border-radius:999px;background:#c8a97e;font-size:0;line-height:0;">&nbsp;</span>Delivery</p>
            <p style="margin:9px 0 0;color:#111111;font-size:18px;line-height:1.25;font-weight:700;">${escapeHtml(model.customerName)}</p>
            ${phone ? `<p style="margin:6px 0 0;color:#3a3733;font-size:13px;line-height:1.4;">${phone}</p>` : ''}
            <p style="margin:8px 0 0;color:#4f4f4b;font-size:12px;line-height:1.55;">${addressLine}</p>
            <p style="margin:8px 0 0;color:#686863;font-size:11px;line-height:1.4;">${escapeHtml(model.deliveryArea)} · ${escapeHtml(model.estimatedDelivery)}</p>
            ${trackingLine}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:0 2px 4px;">
      <p style="margin:0;color:#5e5e59;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Your items&nbsp;&nbsp;·&nbsp;&nbsp;${itemCount}</p>
    </td>
  </tr>

  <tr>
    <td style="padding:0 2px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
        ${itemRows || `<tr><td style="padding:12px 0;color:#7a756e;font-size:13px;">No items</td></tr>`}
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:10px 2px 2px;">
      <table role="presentation" class="rounded-table" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e2df;border-radius:16px;background:#f6f6f4;">
        <tr>
          <td style="padding:16px 18px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
              ${totalRows}
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;margin-top:8px;">
              <tr>
                <td colspan="2" style="padding:0;height:1px;background:#dfdfdc;font-size:0;line-height:0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:13px 0 0;color:#111111;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Total due</td>
                <td align="right" style="padding:13px 0 0;color:#111111;font-size:24px;line-height:1.1;font-weight:700;letter-spacing:-0.02em;white-space:nowrap;">${formatBdt(totalDue)}</td>
              </tr>
            </table>
            <p style="margin:9px 0 0;color:#686863;font-size:12px;line-height:1.5;">${escapeHtml(model.paymentTerms)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim()
}

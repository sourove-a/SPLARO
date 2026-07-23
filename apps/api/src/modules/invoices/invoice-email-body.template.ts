/**
 * Email-client-safe invoice body — compact, mobile-first, inline styles.
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
    return `<td width="64" valign="top" style="width:64px;padding:0 12px 0 0;vertical-align:top;">
      <div style="width:56px;height:70px;border-radius:10px;background:#f3f1ed;border:1px solid #ebe6df;text-align:center;line-height:70px;font-family:Georgia,serif;font-size:18px;color:#a39e96;">${initial}</div>
    </td>`
  }
  return `<td width="64" valign="top" style="width:64px;padding:0 12px 0 0;vertical-align:top;">
    <img src="${escapeHtml(url)}" alt="" width="56" height="70" style="display:block;width:56px;height:70px;max-width:56px;border:1px solid #ebe6df;border-radius:10px;object-fit:cover;" />
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
      const border = index < model.items.length - 1 ? 'border-bottom:1px solid #f0ebe3;' : ''
      return `<tr>
        <td style="padding:14px 0;${border}">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
            <tr>
              ${productThumb(item.imageUrl, item.productName)}
              <td valign="top" style="padding:0;vertical-align:top;">
                <p style="margin:0;color:#111111;font-size:14px;line-height:1.35;font-weight:700;">${escapeHtml(item.productName)}</p>
                ${meta ? `<p style="margin:5px 0 0;color:#7a756e;font-size:12px;line-height:1.4;">${escapeHtml(meta)}</p>` : ''}
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;margin-top:8px;">
                  <tr>
                    <td style="color:#9a948c;font-size:12px;line-height:1.4;">Qty ${item.quantity}</td>
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
      <td style="padding:6px 0;color:#7a756e;font-size:13px;line-height:1.4;">${escapeHtml(row.label)}</td>
      <td align="right" style="padding:6px 0;color:#111111;font-size:13px;line-height:1.4;font-weight:600;white-space:nowrap;">${row.value}</td>
    </tr>`,
    )
    .join('')

  const phone = model.customerPhone ? escapeHtml(model.customerPhone) : ''

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#ffffff;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#111111;">
  <tr>
    <td style="padding:4px 2px 2px;">
      <span style="display:inline-block;margin:0 6px 8px 0;padding:6px 11px;border-radius:999px;background:#f3f1ed;border:1px solid #e6e0d6;color:#3f3c38;font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">${escapeHtml(orderLabel)}</span>
      <span style="display:inline-block;margin:0 0 8px;padding:6px 11px;border-radius:999px;background:#111111;color:#ffffff;font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">${escapeHtml(payMethod)}</span>
    </td>
  </tr>

  <tr>
    <td style="padding:2px 2px 14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #ebe6df;border-radius:14px;background:#faf9f6;">
        <tr>
          <td style="padding:16px;">
            <p style="margin:0;color:#9a948c;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Deliver to</p>
            <p style="margin:8px 0 0;color:#111111;font-size:16px;line-height:1.3;font-weight:700;">${escapeHtml(model.customerName)}</p>
            ${phone ? `<p style="margin:6px 0 0;color:#3f3c38;font-size:14px;line-height:1.4;">${phone}</p>` : ''}
            <p style="margin:10px 0 0;color:#3f3c38;font-size:13px;line-height:1.6;">${escapeHtml(model.customerAddress)}</p>
            <p style="margin:8px 0 0;color:#9a948c;font-size:12px;line-height:1.4;">${escapeHtml(model.deliveryArea)} · ${escapeHtml(model.estimatedDelivery)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:0 2px 2px;">
      <p style="margin:0 0 6px;color:#9a948c;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Items (${itemCount})</p>
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
    <td style="padding:8px 2px 2px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #ebe6df;border-radius:14px;background:#faf9f6;">
        <tr>
          <td style="padding:14px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
              ${totalRows}
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;margin-top:10px;border-top:1px solid #ebe6df;">
              <tr>
                <td style="padding:12px 0 0;color:#111111;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;">Total due</td>
                <td align="right" style="padding:12px 0 0;color:#111111;font-size:22px;line-height:1.15;font-weight:700;white-space:nowrap;">${formatBdt(totalDue)}</td>
              </tr>
            </table>
            <p style="margin:8px 0 0;color:#9a948c;font-size:12px;line-height:1.5;">${escapeHtml(model.paymentTerms)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim()
}

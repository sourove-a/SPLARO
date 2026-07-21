/**
 * Email-client-safe invoice body — table layout + fully inline styles.
 * Never embed the print/PDF invoice fragment (Gmail strips <style>, so images
 * and flex/grid layouts explode in the inbox).
 */
import type { InvoiceViewModel } from './invoice.helpers'
import { escapeHtml, formatBdt, paymentStatusLabel } from './invoice.helpers'

function itemMeta(item: InvoiceViewModel['items'][number]): string {
  const parts = [
    item.sku !== '—' ? `SKU ${item.sku}` : '',
    item.size !== '—' ? `Size ${item.size}` : '',
    item.color !== '—' ? item.color : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

function productThumb(url: string, name: string): string {
  if (!url) {
    const initial = escapeHtml(name.charAt(0).toUpperCase() || 'S')
    return `<td width="56" valign="top" style="width:56px;padding:12px 10px 12px 0;vertical-align:top;">
      <div style="width:48px;height:60px;border-radius:8px;background:#eef0f4;border:1px solid #e5e7eb;text-align:center;line-height:60px;font-family:Georgia,serif;font-size:18px;color:#9ca3af;">${initial}</div>
    </td>`
  }
  return `<td width="56" valign="top" style="width:56px;padding:12px 10px 12px 0;vertical-align:top;">
    <img src="${escapeHtml(url)}" alt="" width="48" height="60" style="display:block;width:48px;height:60px;max-width:48px;border:1px solid #e5e7eb;border-radius:8px;object-fit:cover;" />
  </td>`
}

export function generateInvoiceEmailBody(model: InvoiceViewModel): string {
  const payLabel = paymentStatusLabel(model.paymentStatusKey)
  const itemCount = model.items.reduce((n, i) => n + i.quantity, 0)
  const totalDue =
    model.dueAmount > 0 && model.dueAmount !== model.grandTotal
      ? model.dueAmount
      : model.grandTotal

  const itemRows = model.items
    .map((item) => {
      const meta = itemMeta(item)
      return `<tr>
        ${productThumb(item.imageUrl, item.productName)}
        <td valign="top" style="padding:12px 8px 12px 0;vertical-align:top;border-bottom:1px solid #eee9e1;">
          <p style="margin:0;color:#111111;font-size:14px;line-height:1.35;font-weight:700;">${escapeHtml(item.productName)}</p>
          ${meta ? `<p style="margin:4px 0 0;color:#6b7280;font-size:11px;line-height:1.4;">${escapeHtml(meta)}</p>` : ''}
          <p style="margin:8px 0 0;color:#6b7280;font-size:12px;line-height:1.4;">Qty ${item.quantity} · ${formatBdt(item.unitPrice)}</p>
        </td>
        <td width="88" valign="top" align="right" style="width:88px;padding:12px 0;vertical-align:top;border-bottom:1px solid #eee9e1;white-space:nowrap;">
          <p style="margin:0;color:#111111;font-size:14px;line-height:1.35;font-weight:700;">${formatBdt(item.lineTotal)}</p>
        </td>
      </tr>`
    })
    .join('')

  const totals: Array<{ label: string; value: string; bold?: boolean }> = [
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
      <td style="padding:5px 0;color:#6b7280;font-size:13px;line-height:1.4;">${escapeHtml(row.label)}</td>
      <td align="right" style="padding:5px 0;color:#111111;font-size:13px;line-height:1.4;font-weight:600;white-space:nowrap;">${row.value}</td>
    </tr>`,
    )
    .join('')

  const emailLine =
    model.customerEmail && model.customerEmail !== '—'
      ? `${escapeHtml(model.customerEmail)}<br />`
      : ''

  const logo = model.logoUrl
    ? `<img src="${escapeHtml(model.logoUrl)}" width="120" alt="${escapeHtml(model.brand.name)}" style="display:block;width:120px;max-width:120px;height:auto;border:0;margin:0 auto 10px;" />`
    : `<p style="margin:0 0 8px;color:#111111;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:0.2em;text-transform:uppercase;">${escapeHtml(model.brand.name)}</p>`

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#ffffff;font-family:Arial,'Helvetica Neue',sans-serif;color:#111111;">
  <tr>
    <td style="padding:22px 20px 18px;background:#111111;text-align:center;">
      ${logo}
      <p style="margin:0;color:#c8a97e;font-size:10px;line-height:1.4;letter-spacing:2px;text-transform:uppercase;">Tax invoice</p>
      <p style="margin:10px 0 0;color:#ffffff;font-size:20px;line-height:1.25;font-weight:700;letter-spacing:0.04em;">${escapeHtml(model.invoiceNumber)}</p>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:12px;line-height:1.4;">${escapeHtml(model.issueDate)}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:18px 20px 8px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:0 0 10px;">
            <span style="display:inline-block;margin:0 6px 6px 0;padding:5px 10px;border-radius:999px;background:#f8fafc;border:1px solid #e2e8f0;color:#475569;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(model.orderStatus)}</span>
            <span style="display:inline-block;margin:0 6px 6px 0;padding:5px 10px;border-radius:999px;background:#f8fafc;border:1px solid #e2e8f0;color:#475569;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(payLabel)}</span>
            <span style="display:inline-block;margin:0 0 6px;padding:5px 10px;border-radius:999px;background:#111111;color:#ffffff;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(model.paymentMethod)}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0 20px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #eee9e1;border-radius:12px;">
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #eee9e1;">
            <p style="margin:0;color:#8b877f;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Bill &amp; ship to</p>
            <p style="margin:8px 0 0;color:#111111;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.3;">${escapeHtml(model.customerName)}</p>
            <p style="margin:6px 0 0;color:#5d5a55;font-size:13px;line-height:1.65;">
              ${emailLine}
              ${escapeHtml(model.customerPhone)}<br />
              ${escapeHtml(model.customerAddress)}<br />
              ${model.shippingCityArea ? `${escapeHtml(model.shippingCityArea)} · ` : ''}${escapeHtml(model.deliveryArea)}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
              <tr>
                <td width="50%" valign="top" style="width:50%;padding:0 8px 0 0;vertical-align:top;">
                  <p style="margin:0;color:#8b877f;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Delivery</p>
                  <p style="margin:5px 0 0;color:#111111;font-size:13px;line-height:1.4;font-weight:600;">${escapeHtml(model.estimatedDelivery)}</p>
                </td>
                <td width="50%" valign="top" style="width:50%;padding:0;vertical-align:top;">
                  <p style="margin:0;color:#8b877f;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Items</p>
                  <p style="margin:5px 0 0;color:#111111;font-size:13px;line-height:1.4;font-weight:600;">${itemCount} pcs</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0 20px 8px;">
      <p style="margin:0 0 8px;color:#8b877f;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Order items</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
        ${itemRows || `<tr><td style="padding:12px 0;color:#6b7280;font-size:13px;">No items</td></tr>`}
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 20px 18px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#f7f8fa;border:1px solid #eee9e1;border-radius:12px;">
        <tr>
          <td style="padding:14px 16px;">
            <p style="margin:0 0 8px;color:#8b877f;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Payment terms</p>
            <p style="margin:0 0 14px;color:#111111;font-size:13px;line-height:1.55;">${escapeHtml(model.paymentTerms)}</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
              ${totalRows}
              <tr>
                <td colspan="2" style="padding-top:10px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#111111;border-radius:10px;">
                    <tr>
                      <td style="padding:14px 16px;color:rgba(255,255,255,0.6);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Total due</td>
                      <td align="right" style="padding:14px 16px;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;font-weight:600;white-space:nowrap;">${formatBdt(totalDue)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:4px 20px 22px;text-align:center;">
      <p style="margin:0;color:#111111;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-style:italic;line-height:1.5;">${escapeHtml(model.brand.thankYouNote)}</p>
      <p style="margin:10px 0 0;color:#6b7280;font-size:11px;line-height:1.7;">
        ${escapeHtml(model.brand.websiteDisplay)} · ${escapeHtml(model.brand.phone)} · ${escapeHtml(model.brand.email)}
      </p>
    </td>
  </tr>
</table>`.trim()
}

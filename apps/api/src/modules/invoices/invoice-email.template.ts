export interface InvoiceEmailInput {
  customerName: string
  invoiceNumber: string
  total: number
  invoiceHtml: string
  siteUrl: string
  storeName: string
}

export function generateInvoiceEmailHTML(input: InvoiceEmailInput): string {
  const trackUrl = `${input.siteUrl.replace(/\/$/, '')}/track-order`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order ${input.invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background:#eceef2;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;color:#101114;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eceef2;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 22px;background:#101114;color:#ffffff;">
              <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(255,255,255,0.52);">Order confirmed</div>
              <div style="margin-top:10px;font-size:28px;font-weight:600;letter-spacing:0.04em;">${escapeHtml(input.invoiceNumber)}</div>
              <div style="margin-top:8px;font-size:14px;color:rgba(255,255,255,0.78);">Hi ${escapeHtml(input.customerName)}, thank you for shopping with ${escapeHtml(input.storeName)}.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#4b5563;">
                Your invoice is attached below. You can also track this order anytime using only your order number
                <strong>${escapeHtml(input.invoiceNumber)}</strong> on our website or Telegram bot.
              </p>
              <p style="margin:0 0 22px;font-size:22px;font-weight:700;color:#101114;">Total: ৳${input.total.toLocaleString()}</p>
              <a href="${trackUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#101114;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">
                Track order
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 18px 24px;">
              <div style="border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#f7f8fa;">
                ${input.invoiceHtml}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

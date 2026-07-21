export interface InvoiceEmailInput {
  customerName: string
  invoiceNumber: string
  total: number
  invoiceHtml: string
  siteUrl: string
  storeName: string
}

export function generateInvoiceEmailHTML(input: InvoiceEmailInput): string {
  const site = input.siteUrl.replace(/\/$/, '')
  const trackUrl = `${site}/track-order`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Order ${escapeHtml(input.invoiceNumber)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f0ea;font-family:Arial,'Helvetica Neue',sans-serif;color:#111111;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Order ${escapeHtml(input.invoiceNumber)} confirmed. Total ৳${input.total.toLocaleString()}.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#f3f0ea;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;background:#faf8f5;border:1px solid #ded8ce;border-radius:18px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 20px 24px;background:#111111;">
              <a href="${escapeHtml(site)}" style="text-decoration:none;">
                <img src="${escapeHtml(site)}/images/logo/splaro-logo-white-premium.png" width="140" alt="${escapeHtml(input.storeName)}" style="display:block;width:140px;max-width:70%;height:auto;border:0;margin:0 auto;" />
              </a>
              <div style="width:42px;height:1px;background:#c8a97e;margin:18px auto 0;"></div>
              <p style="margin:11px 0 0;color:#c8a97e;font-size:10px;line-height:1.4;letter-spacing:3px;text-transform:uppercase;">Order confirmed</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 22px 22px;">
              <p style="margin:0 0 10px;color:#8a704d;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Thank you, ${escapeHtml(input.customerName)}</p>
              <h1 style="margin:0;color:#111111;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;font-weight:400;letter-spacing:-0.3px;">Your order is confirmed.</h1>
              <p style="margin:14px 0 0;color:#5d5a55;font-size:14px;line-height:1.7;">We received your order. The invoice summary is below — keep your order number for tracking and support.</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;margin-top:22px;background:#ffffff;border:1px solid #e5dfd5;border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;border-bottom:1px solid #eee9e1;">
                    <p style="margin:0;color:#8b877f;font-size:10px;line-height:1.4;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Order number</p>
                    <p style="margin:6px 0 0;color:#111111;font-size:17px;line-height:1.3;font-weight:700;">${escapeHtml(input.invoiceNumber)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0;color:#8b877f;font-size:10px;line-height:1.4;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Order total</p>
                    <p style="margin:6px 0 0;color:#111111;font-size:17px;line-height:1.3;font-weight:700;">৳${input.total.toLocaleString()}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px;border-collapse:collapse;">
                <tr>
                  <td style="border-radius:999px;background:#111111;">
                    <a href="${escapeHtml(trackUrl)}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Track order</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 14px 22px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #ded8ce;border-radius:14px;overflow:hidden;background:#ffffff;">
                <tr>
                  <td style="padding:0;">
                    ${input.invoiceHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 22px;background:#f4f0e9;border-top:1px solid #ded8ce;">
              <p style="margin:0;color:#77726a;font-size:11px;line-height:1.65;">Need help? Reply to this email or contact <a href="mailto:info@splaro.co" style="color:#8a704d;text-decoration:none;">info@splaro.co</a>.</p>
              <p style="margin:8px 0 0;color:#99938b;font-size:10px;line-height:1.5;">© ${new Date().getFullYear()} ${escapeHtml(input.storeName)} · Dhaka, Bangladesh</p>
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
    .replace(/'/g, '&#039;')
}

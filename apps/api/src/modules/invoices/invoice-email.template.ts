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
  <title>Order ${input.invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f3f0ea;font-family:Arial,'Helvetica Neue',sans-serif;color:#111111;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Order ${escapeHtml(input.invoiceNumber)} confirmed. Total ৳${input.total.toLocaleString()}.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f0ea;">
    <tr>
      <td align="center" style="padding:34px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;background:#faf8f5;border:1px solid #ded8ce;border-radius:20px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:32px 24px 28px;background:#111111;">
              <a href="${escapeHtml(site)}" style="text-decoration:none;">
                <img src="${escapeHtml(site)}/images/logo/splaro-logo-white-premium.png" width="150" alt="${escapeHtml(input.storeName)}" style="display:block;width:150px;max-width:100%;height:auto;border:0;" />
              </a>
              <div style="width:42px;height:1px;background:#c8a97e;margin:20px auto 0;"></div>
              <p style="margin:11px 0 0;color:#c8a97e;font-size:10px;line-height:1.4;letter-spacing:3px;text-transform:uppercase;">Order confirmed</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 36px 32px;">
              <p style="margin:0 0 10px;color:#8a704d;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Thank you, ${escapeHtml(input.customerName)}</p>
              <h1 style="margin:0;color:#111111;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;font-weight:400;letter-spacing:-0.5px;">Your order is confirmed.</h1>
              <p style="margin:17px 0 0;color:#5d5a55;font-size:15px;line-height:1.75;">We received your order and included complete invoice below. Keep order number for tracking and support.</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:26px;background:#ffffff;border:1px solid #e5dfd5;border-radius:14px;">
                <tr>
                  <td style="padding:19px 20px;border-bottom:1px solid #eee9e1;">
                    <p style="margin:0;color:#8b877f;font-size:10px;line-height:1.4;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Order number</p>
                    <p style="margin:6px 0 0;color:#111111;font-size:18px;line-height:1.3;font-weight:700;">${escapeHtml(input.invoiceNumber)}</p>
                  </td>
                  <td align="right" style="padding:19px 20px;border-bottom:1px solid #eee9e1;">
                    <p style="margin:0;color:#8b877f;font-size:10px;line-height:1.4;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Order total</p>
                    <p style="margin:6px 0 0;color:#111111;font-size:18px;line-height:1.3;font-weight:700;">৳${input.total.toLocaleString()}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:26px;">
                <tr>
                  <td style="border-radius:999px;background:#111111;">
                    <a href="${escapeHtml(trackUrl)}" style="display:inline-block;padding:14px 25px;color:#ffffff;text-decoration:none;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Track order</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 18px 26px;">
              <div style="border:1px solid #ded8ce;border-radius:14px;overflow:hidden;background:#ffffff;">
                ${input.invoiceHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 36px;background:#f4f0e9;border-top:1px solid #ded8ce;">
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

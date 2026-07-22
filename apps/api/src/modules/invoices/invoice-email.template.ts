export interface InvoiceEmailInput {
  customerName: string
  invoiceNumber: string
  total: number
  invoiceHtml: string
  siteUrl: string
  storeName: string
}

/** Always customer-facing — never leak localhost into the inbox. */
function publicSiteOrigin(raw: string): string {
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.localhost')
    ) {
      return 'https://splaro.co'
    }
    return url.origin
  } catch {
    return 'https://splaro.co'
  }
}

export function generateInvoiceEmailHTML(input: InvoiceEmailInput): string {
  const site = publicSiteOrigin(input.siteUrl).replace(/\/$/, '')
  const host = site.replace(/^https?:\/\//, '')
  const trackUrl = `${site}/track-order?invoice=${encodeURIComponent(input.invoiceNumber)}`
  const shopUrl = `${site}/shop`
  const firstName = input.customerName.trim().split(/\s+/)[0] || 'there'
  const year = new Date().getFullYear()
  const totalLabel = `৳${input.total.toLocaleString('en-BD')}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Order ${escapeHtml(input.invoiceNumber)} · ${escapeHtml(input.storeName)}</title>
  <!--[if mso]><style type="text/css">body,table,td{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#111111;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(input.invoiceNumber)} confirmed · ${totalLabel}. Track your SPLARO order anytime.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#f4f1eb;">
    <tr>
      <td align="center" style="padding:32px 14px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;border-collapse:collapse;">

          <!-- Brand masthead -->
          <tr>
            <td align="center" style="padding:0 0 18px;">
              <a href="${escapeHtml(site)}" style="text-decoration:none;">
                <img src="${escapeHtml(site)}/images/logo/splaro-logo-black-premium.webp" width="132" alt="${escapeHtml(input.storeName)}" style="display:block;width:132px;max-width:56%;height:auto;border:0;margin:0 auto;" />
              </a>
              <p style="margin:12px 0 0;color:#8a704d;font-size:10px;line-height:1.4;letter-spacing:0.32em;text-transform:uppercase;">Quiet luxury · Bangladesh</p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="border-radius:22px;overflow:hidden;border:1px solid #e4ddd2;background:#ffffff;box-shadow:0 18px 48px rgba(28,22,14,0.07);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="height:4px;background:linear-gradient(90deg,#111111 0%,#c8a97e 48%,#111111 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:34px 28px 8px;background:#111111;">
                    <p style="margin:0;color:#c8a97e;font-size:10px;line-height:1.4;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;">Order confirmed</p>
                    <h1 style="margin:12px 0 0;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:400;letter-spacing:-0.02em;">Thank you, ${escapeHtml(firstName)}.</h1>
                    <p style="margin:12px 0 0;color:rgba(255,255,255,0.62);font-size:14px;line-height:1.7;">Your order is confirmed and being prepared with care. Keep this email for your records.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 28px 26px;background:#111111;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;margin-top:22px;border:1px solid rgba(255,255,255,0.12);border-radius:14px;background:rgba(255,255,255,0.04);">
                      <tr>
                        <td width="50%" valign="top" style="width:50%;padding:16px 14px;border-right:1px solid rgba(255,255,255,0.08);">
                          <p style="margin:0;color:rgba(255,255,255,0.45);font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Order</p>
                          <p style="margin:8px 0 0;color:#ffffff;font-size:16px;line-height:1.3;font-weight:700;">${escapeHtml(input.invoiceNumber)}</p>
                        </td>
                        <td width="50%" valign="top" style="width:50%;padding:16px 14px;">
                          <p style="margin:0;color:rgba(255,255,255,0.45);font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Total</p>
                          <p style="margin:8px 0 0;color:#c8a97e;font-size:16px;line-height:1.3;font-weight:700;">${totalLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 28px 10px;">
                    <p style="margin:0 0 16px;color:#5d5a55;font-size:14px;line-height:1.75;">Track delivery status anytime, or continue shopping the latest from SPLARO.</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="border-radius:999px;background:#111111;">
                          <a href="${escapeHtml(trackUrl)}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Track order</a>
                        </td>
                        <td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
                        <td style="border-radius:999px;border:1px solid #d8d1c6;background:#faf8f5;">
                          <a href="${escapeHtml(shopUrl)}" style="display:inline-block;padding:14px 22px;color:#111111;text-decoration:none;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Shop more</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 20px 26px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #ebe4d9;border-radius:16px;overflow:hidden;background:#ffffff;">
                      <tr>
                        <td style="padding:0;">
                          ${input.invoiceHtml}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 28px 26px;background:#faf7f2;border-top:1px solid #ebe4d9;">
                    <p style="margin:0;color:#6f6a62;font-size:12px;line-height:1.7;">Need help? Reply to this email or write <a href="mailto:info@splaro.co" style="color:#8a704d;text-decoration:none;font-weight:700;">info@splaro.co</a>.</p>
                    <p style="margin:10px 0 0;color:#9a948c;font-size:11px;line-height:1.55;">© ${year} ${escapeHtml(input.storeName)} · <a href="${escapeHtml(site)}" style="color:#8a704d;text-decoration:none;">${escapeHtml(host)}</a></p>
                  </td>
                </tr>
              </table>
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

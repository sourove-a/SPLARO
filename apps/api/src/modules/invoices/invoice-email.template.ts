import { resolveEmailLogoUrl } from '@splaro/config'

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function generateInvoiceEmailHTML(input: InvoiceEmailInput): string {
  const site = publicSiteOrigin(input.siteUrl).replace(/\/$/, '')
  const host = site.replace(/^https?:\/\//, '')
  const logoUrl = resolveEmailLogoUrl(site)
  const trackUrl = `${site}/track-order?invoice=${encodeURIComponent(input.invoiceNumber)}`
  const shopUrl = `${site}/shop`
  const firstName = input.customerName.trim().split(/\s+/)[0] || 'there'
  const year = new Date().getFullYear()
  const totalLabel = `৳${input.total.toLocaleString('en-BD')}`

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>Order ${escapeHtml(input.invoiceNumber)} · ${escapeHtml(input.storeName)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style type="text/css">
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
    a { text-decoration: none; }
    .shell { width: 100% !important; max-width: 560px !important; }
    @media only screen and (max-width: 620px) {
      .shell { width: 100% !important; max-width: 100% !important; }
      .pad-outer { padding: 12px 0 24px !important; }
      .pad-x { padding-left: 18px !important; padding-right: 18px !important; }
      .hero-title { font-size: 26px !important; line-height: 1.2 !important; }
      .meta-cell { display: block !important; width: 100% !important; border-right: 0 !important; border-bottom: 1px solid #ebe6df !important; box-sizing: border-box !important; }
      .meta-cell-last { border-bottom: 0 !important; }
      .btn-link { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
      .card { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background:#f4f1ec;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#111111;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#f4f1ec;">
    ${escapeHtml(input.invoiceNumber)} confirmed · ${totalLabel}. Track your SPLARO order anytime.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#f4f1ec;">
    <tr>
      <td align="center" class="pad-outer" style="padding:24px 12px 36px;">
        <table role="presentation" class="shell" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;border-collapse:collapse;">

          <!-- Brand logo (PNG — WebP fails in Gmail/Outlook) -->
          <tr>
            <td align="center" style="padding:6px 16px 16px;">
              <a href="${escapeHtml(site)}" style="text-decoration:none;">
                <img src="${escapeHtml(logoUrl)}" width="132" height="70" alt="${escapeHtml(input.storeName)}" style="display:block;width:132px;max-width:48%;height:auto;border:0;margin:0 auto;" />
              </a>
              <p style="margin:8px 0 0;color:#9a8570;font-size:9px;line-height:1.4;letter-spacing:0.26em;text-transform:uppercase;">Quiet luxury</p>
            </td>
          </tr>

          <tr>
            <td class="card" style="border-radius:20px;overflow:hidden;border:1px solid #e5dfd4;background:#ffffff;box-shadow:0 12px 36px rgba(17,17,17,0.06);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                <tr><td style="height:3px;background:#111111;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr><td style="height:2px;background:#c8a97e;font-size:0;line-height:0;">&nbsp;</td></tr>

                <tr>
                  <td class="pad-x" style="padding:26px 24px 8px;">
                    <p style="margin:0;color:#a8895e;font-size:10px;line-height:1.4;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;">Order confirmed</p>
                    <h1 class="hero-title" style="margin:10px 0 0;color:#111111;font-family:Georgia,'Times New Roman',Times,serif;font-size:28px;line-height:1.18;font-weight:400;letter-spacing:-0.02em;">Thank you, ${escapeHtml(firstName)}.</h1>
                    <p style="margin:10px 0 0;color:#6b6760;font-size:14px;line-height:1.65;">Your order is confirmed and being prepared with care.</p>
                  </td>
                </tr>

                <tr>
                  <td class="pad-x" style="padding:14px 24px 4px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #ebe6df;border-radius:14px;background:#faf9f6;">
                      <tr>
                        <td class="meta-cell" width="50%" valign="top" style="width:50%;padding:14px 16px;border-right:1px solid #ebe6df;">
                          <p style="margin:0;color:#9a948c;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Order</p>
                          <p style="margin:6px 0 0;color:#111111;font-size:15px;line-height:1.3;font-weight:700;">${escapeHtml(input.invoiceNumber)}</p>
                        </td>
                        <td class="meta-cell meta-cell-last" width="50%" valign="top" style="width:50%;padding:14px 16px;">
                          <p style="margin:0;color:#9a948c;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Total</p>
                          <p style="margin:6px 0 0;color:#111111;font-size:15px;line-height:1.3;font-weight:700;">${totalLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td class="pad-x" style="padding:16px 24px 6px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td style="padding:0 0 8px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                            <tr>
                              <td align="center" style="border-radius:999px;background:#111111;">
                                <a class="btn-link" href="${escapeHtml(trackUrl)}" style="display:block;padding:14px 18px;color:#ffffff;text-decoration:none;font-size:12px;line-height:1.2;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-align:center;">Track order</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                            <tr>
                              <td align="center" style="border-radius:999px;border:1px solid #d5cec3;background:#ffffff;">
                                <a class="btn-link" href="${escapeHtml(shopUrl)}" style="display:block;padding:14px 18px;color:#111111;text-decoration:none;font-size:12px;line-height:1.2;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-align:center;">Continue shopping</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td class="pad-x" style="padding:10px 20px 4px;">
                    ${input.invoiceHtml}
                  </td>
                </tr>

                <tr>
                  <td class="pad-x" style="padding:16px 24px 22px;border-top:1px solid #f0ebe3;">
                    <p style="margin:0;color:#7a756e;font-size:12px;line-height:1.65;">Need help? <a href="mailto:info@splaro.co" style="color:#8a704d;text-decoration:none;font-weight:700;">info@splaro.co</a></p>
                    <p style="margin:8px 0 0;color:#a39e96;font-size:11px;line-height:1.5;">© ${year} ${escapeHtml(input.storeName)} · <a href="${escapeHtml(site)}" style="color:#8a704d;text-decoration:none;">${escapeHtml(host)}</a></p>
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

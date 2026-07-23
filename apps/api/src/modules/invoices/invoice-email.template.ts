import { resolveEmailLogoUrl, SPLARO_INVOICE_BRAND } from '@splaro/config'

export interface InvoiceEmailInput {
  customerName: string
  invoiceNumber: string
  total: number
  invoiceHtml: string
  siteUrl: string
  storeName: string
  /** HMAC invoice access token — required for one-tap Track / Invoice links. */
  accessKey: string
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
  const host = site.replace(/^https?:\/\//, '').replace(/^www\./, '')
  const logoUrl = resolveEmailLogoUrl(site)
  const invoice = encodeURIComponent(input.invoiceNumber)
  const key = encodeURIComponent(input.accessKey)
  // Signed links — customer taps once, no phone / OTP / key typing.
  const trackUrl = `${site}/order-confirmation/${invoice}?key=${key}`
  const invoiceUrl = `${site}/api/orders/${invoice}/invoice?key=${key}`
  const shopUrl = `${site}/shop`
  const supportEmail = SPLARO_INVOICE_BRAND.email
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
      .pad-outer { padding: 10px 0 22px !important; }
      .pad-x { padding-left: 18px !important; padding-right: 18px !important; }
      .hero-title { font-size: 26px !important; line-height: 1.2 !important; }
      .meta-cell { display: block !important; width: 100% !important; border-right: 0 !important; border-bottom: 1px solid #ebe6df !important; box-sizing: border-box !important; }
      .meta-cell-last { border-bottom: 0 !important; }
      .btn-link { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
      .btn-row td { display: block !important; width: 100% !important; padding: 0 0 8px !important; }
      .card { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background:#e8e2d6;font-family:Georgia,'Times New Roman',Times,serif;color:#111111;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#e8e2d6;">
    ${escapeHtml(input.invoiceNumber)} confirmed · ${totalLabel}. Tap Track or Invoice — opens instantly.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#e8e2d6;">
    <tr>
      <td align="center" class="pad-outer" style="padding:28px 12px 40px;">
        <table role="presentation" class="shell" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;border-collapse:collapse;">

          <!-- Brand mark -->
          <tr>
            <td align="center" style="padding:4px 16px 18px;">
              <a href="${escapeHtml(site)}" style="text-decoration:none;">
                <img src="${escapeHtml(logoUrl)}" width="140" height="74" alt="${escapeHtml(input.storeName)}" style="display:block;width:140px;max-width:52%;height:auto;border:0;margin:0 auto;" />
              </a>
              <p style="margin:10px 0 0;color:#9a8b6e;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:9px;line-height:1.4;letter-spacing:0.32em;text-transform:uppercase;">Modesty. Refined.</p>
            </td>
          </tr>

          <tr>
            <td class="card" style="border:1px solid #d9d0c3;background:#fffcf7;box-shadow:0 24px 48px rgba(30,24,16,0.1);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                <tr><td style="height:2px;background:#111111;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr><td style="height:2px;background:#9a8b6e;font-size:0;line-height:0;">&nbsp;</td></tr>

                <tr>
                  <td class="pad-x" style="padding:28px 28px 6px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <p style="margin:0;color:#9a8b6e;font-size:10px;line-height:1.4;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;">Order confirmed</p>
                    <h1 class="hero-title" style="margin:12px 0 0;color:#111111;font-family:Georgia,'Times New Roman',Times,serif;font-size:30px;line-height:1.15;font-weight:400;letter-spacing:-0.02em;">Thank you, ${escapeHtml(firstName)}.</h1>
                    <p style="margin:12px 0 0;color:#5c574f;font-size:14px;line-height:1.65;">Your order is confirmed and being prepared with care. Tap below — no extra typing needed.</p>
                  </td>
                </tr>

                <tr>
                  <td class="pad-x" style="padding:18px 28px 4px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #ebe6df;background:#f8f5ef;">
                      <tr>
                        <td class="meta-cell" width="50%" valign="top" style="width:50%;padding:16px 18px;border-right:1px solid #ebe6df;">
                          <p style="margin:0;color:#9a8b6e;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Order</p>
                          <p style="margin:8px 0 0;color:#111111;font-size:16px;line-height:1.3;font-weight:700;letter-spacing:0.02em;">${escapeHtml(input.invoiceNumber)}</p>
                        </td>
                        <td class="meta-cell meta-cell-last" width="50%" valign="top" style="width:50%;padding:16px 18px;">
                          <p style="margin:0;color:#9a8b6e;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Total due</p>
                          <p style="margin:8px 0 0;color:#111111;font-size:16px;line-height:1.3;font-weight:700;">${totalLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- One-tap actions -->
                <tr>
                  <td class="pad-x" style="padding:18px 28px 8px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <table role="presentation" class="btn-row" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td width="50%" valign="top" style="width:50%;padding:0 4px 0 0;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                            <tr>
                              <td align="center" style="background:#111111;">
                                <a class="btn-link" href="${escapeHtml(trackUrl)}" style="display:block;padding:15px 12px;color:#fffcf7;text-decoration:none;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;text-align:center;">Track order</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td width="50%" valign="top" style="width:50%;padding:0 0 0 4px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                            <tr>
                              <td align="center" style="border:1px solid #111111;background:#fffcf7;">
                                <a class="btn-link" href="${escapeHtml(invoiceUrl)}" style="display:block;padding:14px 12px;color:#111111;text-decoration:none;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;text-align:center;">View invoice</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:10px 0 0;color:#8a847a;font-size:11px;line-height:1.5;text-align:center;">Opens instantly — no phone or code required.</p>
                  </td>
                </tr>

                <tr>
                  <td class="pad-x" style="padding:10px 20px 4px;">
                    ${input.invoiceHtml}
                  </td>
                </tr>

                <tr>
                  <td class="pad-x" style="padding:8px 28px 6px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td align="center" style="border:1px solid #d5cec3;background:#ffffff;">
                          <a class="btn-link" href="${escapeHtml(shopUrl)}" style="display:block;padding:13px 18px;color:#3a3733;text-decoration:none;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-align:center;">Continue shopping</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td class="pad-x" style="padding:20px 28px 26px;border-top:1px solid #efeae2;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <p style="margin:0;color:#7a756e;font-size:12px;line-height:1.65;">Need help? <a href="mailto:${escapeHtml(supportEmail)}" style="color:#9a8b6e;text-decoration:none;font-weight:700;">${escapeHtml(supportEmail)}</a></p>
                    <p style="margin:10px 0 0;color:#a39e96;font-size:11px;line-height:1.55;">© ${year} ${escapeHtml(input.storeName)} · <a href="${escapeHtml(site)}" style="color:#9a8b6e;text-decoration:none;">www.${escapeHtml(host)}</a></p>
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

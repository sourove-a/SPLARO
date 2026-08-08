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
    .shell { width: 100% !important; max-width: 600px !important; }
    .rounded-table { border-collapse: separate !important; border-spacing: 0 !important; }
    @media only screen and (max-width: 620px) {
      .shell { width: 100% !important; max-width: 100% !important; }
      .pad-outer { padding: 10px 10px 24px !important; }
      .pad-x { padding-left: 20px !important; padding-right: 20px !important; }
      .hero-title { font-size: 28px !important; line-height: 1.15 !important; }
      .meta-cell { width: 50% !important; box-sizing: border-box !important; }
      .btn-link { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
      .btn-row td { display: block !important; width: 100% !important; padding: 0 0 8px !important; }
      .card { border-radius: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background:#f0efec;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#111111;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#f0efec;">
    ${escapeHtml(input.invoiceNumber)} confirmed · ${totalLabel}. Tap Track or Invoice — opens instantly.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#f0efec;">
    <tr>
      <td align="center" class="pad-outer" style="padding:26px 12px 42px;">
        <table role="presentation" class="shell" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;">

          <!-- Brand mark -->
          <tr>
            <td align="center" style="padding:2px 16px 18px;">
              <a href="${escapeHtml(site)}" style="text-decoration:none;">
                <img src="${escapeHtml(logoUrl)}" width="128" height="68" alt="${escapeHtml(input.storeName)}" style="display:block;width:128px;max-width:48%;height:auto;border:0;margin:0 auto;" />
              </a>
              <p style="margin:8px 0 0;color:#686762;font-size:9px;line-height:1.4;letter-spacing:0.3em;text-transform:uppercase;">Modesty. Refined.</p>
            </td>
          </tr>

          <tr>
            <td class="card" style="overflow:hidden;border:1px solid #e1e0dc;border-radius:24px;background:#ffffff;box-shadow:0 18px 54px rgba(20,20,18,0.08);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                <tr>
                  <td class="pad-x" style="padding:34px 32px 10px;background:#111111;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <p style="margin:0;color:#c8a97e;font-size:10px;line-height:1.4;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;"><span style="display:inline-block;width:7px;height:7px;margin:0 9px 1px 0;border-radius:999px;background:#c8a97e;font-size:0;line-height:0;">&nbsp;</span>Order confirmed</p>
                    <h1 class="hero-title" style="margin:14px 0 0;color:#ffffff;font-size:34px;line-height:1.12;font-weight:500;letter-spacing:-0.035em;">Thank you, ${escapeHtml(firstName)}.</h1>
                    <p style="margin:12px 0 0;max-width:440px;color:#c9c9c5;font-size:14px;line-height:1.65;">We’ve received your order and started preparing it for dispatch.</p>
                  </td>
                </tr>

                <tr>
                  <td class="pad-x" style="padding:18px 32px 30px;background:#111111;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;border-top:1px solid #363633;">
                      <tr>
                        <td class="meta-cell" width="50%" valign="top" style="width:50%;padding:17px 14px 0 0;border-right:1px solid #363633;">
                          <p style="margin:0;color:#8f8f89;font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Order</p>
                          <p style="margin:8px 0 0;color:#ffffff;font-size:18px;line-height:1.25;font-weight:700;letter-spacing:0.01em;">${escapeHtml(input.invoiceNumber)}</p>
                        </td>
                        <td class="meta-cell meta-cell-last" width="50%" valign="top" style="width:50%;padding:17px 0 0 18px;">
                          <p style="margin:0;color:#8f8f89;font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Total due</p>
                          <p style="margin:8px 0 0;color:#ffffff;font-size:18px;line-height:1.25;font-weight:700;">${totalLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- One-tap actions -->
                <tr>
                  <td class="pad-x" style="padding:24px 32px 8px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <table role="presentation" class="btn-row" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td width="58%" valign="top" style="width:58%;padding:0 4px 0 0;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                            <tr>
                              <td align="center" style="border-radius:999px;background:#111111;">
                                <a class="btn-link" href="${escapeHtml(trackUrl)}" style="display:block;padding:16px 12px;color:#ffffff;text-decoration:none;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;text-align:center;">Track order&nbsp;&nbsp;→</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td width="42%" valign="top" style="width:42%;padding:0 0 0 4px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                            <tr>
                              <td align="center" style="border:1px solid #d8d7d3;border-radius:999px;background:#f7f7f5;">
                                <a class="btn-link" href="${escapeHtml(invoiceUrl)}" style="display:block;padding:15px 12px;color:#111111;text-decoration:none;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;text-align:center;">View invoice</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:10px 0 0;color:#74746f;font-size:11px;line-height:1.5;text-align:center;">Secure one-tap access · No sign-in required</p>
                  </td>
                </tr>

                <tr>
                  <td class="pad-x" style="padding:14px 26px 4px;">
                    ${input.invoiceHtml}
                  </td>
                </tr>

                <tr>
                  <td class="pad-x" style="padding:8px 32px 14px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td align="center">
                          <a class="btn-link" href="${escapeHtml(shopUrl)}" style="display:inline-block;padding:10px 18px;color:#333330;text-decoration:none;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:0.11em;text-transform:uppercase;text-align:center;">Continue shopping&nbsp;&nbsp;→</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td class="pad-x" style="padding:20px 32px 26px;border-top:1px solid #ececea;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                    <p style="margin:0;color:#666660;font-size:12px;line-height:1.65;">Need help? <a href="mailto:${escapeHtml(supportEmail)}" style="color:#333330;text-decoration:none;font-weight:700;">${escapeHtml(supportEmail)}</a></p>
                    <p style="margin:10px 0 0;color:#858580;font-size:11px;line-height:1.55;">© ${year} ${escapeHtml(input.storeName)} · <a href="${escapeHtml(site)}" style="color:#555550;text-decoration:none;">www.${escapeHtml(host)}</a></p>
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

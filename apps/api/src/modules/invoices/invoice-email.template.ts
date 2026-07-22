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
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>Order ${escapeHtml(input.invoiceNumber)} · ${escapeHtml(input.storeName)}</title>
  <!--[if mso]><style type="text/css">body,table,td{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]-->
  <style type="text/css">
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
    a { text-decoration: none; }
    .shell { width: 100% !important; max-width: 560px !important; }
    @media only screen and (max-width: 620px) {
      .shell { width: 100% !important; max-width: 100% !important; }
      .pad-outer { padding: 16px 0 28px !important; }
      .pad-card { padding-left: 18px !important; padding-right: 18px !important; }
      .pad-hero { padding: 22px 18px 8px !important; }
      .pad-block { padding-left: 18px !important; padding-right: 18px !important; }
      .hero-title { font-size: 26px !important; line-height: 1.22 !important; }
      .hero-copy { font-size: 14px !important; }
      .meta-cell { display: block !important; width: 100% !important; border-right: 0 !important; border-bottom: 1px solid #ebe6df !important; padding: 14px 16px !important; box-sizing: border-box !important; }
      .meta-cell-last { border-bottom: 0 !important; }
      .btn-cell { display: block !important; width: 100% !important; padding: 0 0 10px !important; }
      .btn-cell-last { padding-bottom: 0 !important; }
      .btn-link {
        display: block !important;
        width: 100% !important;
        text-align: center !important;
        box-sizing: border-box !important;
        padding: 15px 18px !important;
      }
      .card { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
      .footer-pad { padding: 18px 18px 22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background:#f3f1ec;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#111111;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#f3f1ec;">
    ${escapeHtml(input.invoiceNumber)} confirmed · ${totalLabel}. Track your SPLARO order anytime.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#f3f1ec;">
    <tr>
      <td align="center" class="pad-outer" style="padding:28px 12px 40px;">
        <table role="presentation" class="shell" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;border-collapse:collapse;">

          <!-- Brand -->
          <tr>
            <td align="center" style="padding:4px 16px 18px;">
              <a href="${escapeHtml(site)}" style="text-decoration:none;">
                <img src="${escapeHtml(site)}/images/logo/splaro-logo-black-premium.webp" width="112" alt="${escapeHtml(input.storeName)}" style="display:block;width:112px;max-width:42%;height:auto;border:0;margin:0 auto;" />
              </a>
              <p style="margin:10px 0 0;color:#9a8570;font-size:9px;line-height:1.4;letter-spacing:0.28em;text-transform:uppercase;">Quiet luxury</p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="card" style="border-radius:22px;overflow:hidden;border:1px solid #e5dfd4;background:#ffffff;box-shadow:0 14px 40px rgba(17,17,17,0.06);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="height:3px;background:#111111;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="height:2px;background:#c8a97e;font-size:0;line-height:0;">&nbsp;</td>
                </tr>

                <!-- Hero -->
                <tr>
                  <td class="pad-hero" style="padding:28px 26px 10px;">
                    <p style="margin:0;color:#a8895e;font-size:10px;line-height:1.4;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;">Order confirmed</p>
                    <h1 class="hero-title" style="margin:12px 0 0;color:#111111;font-family:Georgia,'Times New Roman',Times,serif;font-size:30px;line-height:1.18;font-weight:400;letter-spacing:-0.02em;">Thank you, ${escapeHtml(firstName)}.</h1>
                    <p class="hero-copy" style="margin:12px 0 0;color:#6b6760;font-size:15px;line-height:1.7;">Your order is confirmed and being prepared with care.</p>
                  </td>
                </tr>

                <!-- Order / Total -->
                <tr>
                  <td class="pad-block" style="padding:16px 26px 6px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;border:1px solid #ebe6df;border-radius:16px;background:#faf9f6;">
                      <tr>
                        <td class="meta-cell" width="50%" valign="top" style="width:50%;padding:16px;border-right:1px solid #ebe6df;">
                          <p style="margin:0;color:#9a948c;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Order</p>
                          <p style="margin:8px 0 0;color:#111111;font-size:16px;line-height:1.3;font-weight:700;">${escapeHtml(input.invoiceNumber)}</p>
                        </td>
                        <td class="meta-cell meta-cell-last" width="50%" valign="top" style="width:50%;padding:16px;">
                          <p style="margin:0;color:#9a948c;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Total</p>
                          <p style="margin:8px 0 0;color:#111111;font-size:16px;line-height:1.3;font-weight:700;">${totalLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTAs — stacked full-width for mobile premium tap targets -->
                <tr>
                  <td class="pad-block" style="padding:18px 26px 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td class="btn-cell" style="padding:0 0 10px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                            <tr>
                              <td align="center" style="border-radius:999px;background:#111111;">
                                <a class="btn-link" href="${escapeHtml(trackUrl)}" style="display:block;padding:15px 20px;color:#ffffff;text-decoration:none;font-size:12px;line-height:1.2;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;text-align:center;">Track order</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td class="btn-cell btn-cell-last" style="padding:0;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
                            <tr>
                              <td align="center" style="border-radius:999px;border:1px solid #d5cec3;background:#ffffff;">
                                <a class="btn-link" href="${escapeHtml(shopUrl)}" style="display:block;padding:15px 20px;color:#111111;text-decoration:none;font-size:12px;line-height:1.2;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-align:center;">Continue shopping</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Receipt body -->
                <tr>
                  <td class="pad-card" style="padding:14px 22px 6px;">
                    ${input.invoiceHtml}
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td class="footer-pad" style="padding:18px 26px 26px;border-top:1px solid #f0ebe3;">
                    <p style="margin:0;color:#7a756e;font-size:12px;line-height:1.7;">Need help? Write <a href="mailto:info@splaro.co" style="color:#8a704d;text-decoration:none;font-weight:700;">info@splaro.co</a></p>
                    <p style="margin:10px 0 0;color:#a39e96;font-size:11px;line-height:1.55;">© ${year} ${escapeHtml(input.storeName)} · <a href="${escapeHtml(site)}" style="color:#8a704d;text-decoration:none;">${escapeHtml(host)}</a></p>
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

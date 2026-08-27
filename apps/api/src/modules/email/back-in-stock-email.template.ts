export interface BackInStockEmailInput {
  productName: string
  variantName?: string | null
  productUrl: string
  unsubscribeUrl: string
  imageUrl?: string | null
  storeName?: string
  siteUrl?: string
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Back-in-stock mail, in the same always-light styling as the verification and
 * password-reset templates: PNG wordmark, gold accent, force-light overrides so
 * a dark-mode client cannot invert it into something unreadable.
 */
export function generateBackInStockHTML(input: BackInStockEmailInput): string {
  const store = input.storeName?.trim() || 'SPLARO'
  const site = (input.siteUrl ?? 'https://splaro.co').replace(/\/$/, '')
  const host = site.replace(/^https?:\/\//, '')
  const year = new Date().getFullYear()
  const option = input.variantName?.trim()

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(input.productName)} is back in stock</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    :root { color-scheme: light only; }
    @media (prefers-color-scheme: dark) {
      .force-light { background-color: #f7f3ed !important; color: #111111 !important; }
      .force-card { background-color: #ffffff !important; color: #111111 !important; }
      .force-ink { color: #111111 !important; }
      .force-muted { color: #66615b !important; }
      .force-soft { color: #8a837b !important; }
      .force-btn { background-color: #111111 !important; color: #ffffff !important; }
      .force-rule { background-color: #e8e2d8 !important; }
    }
  </style>
</head>
<body class="force-light" style="margin:0;padding:0;background:#f7f3ed;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111111;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(input.productName)} is available again — stock is limited.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="force-light" style="background:#f7f3ed;padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;">
          <tr>
            <td align="center" style="padding:0 0 28px;">
              <a href="${escapeHtml(site)}" style="text-decoration:none;border:0;">
                <img
                  src="${escapeHtml(site)}/images/logo/splaro-logo-email.png"
                  alt="${escapeHtml(store)}"
                  width="148"
                  height="auto"
                  style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;max-width:148px;height:auto;"
                />
              </a>
            </td>
          </tr>
          <tr>
            <td class="force-card" style="overflow:hidden;background:#ffffff;border:1px solid rgba(17,17,17,0.08);border-radius:28px;box-shadow:0 24px 70px rgba(39,29,18,0.08);">
              <div style="height:4px;line-height:4px;font-size:0;background:linear-gradient(90deg,#111111 0%,#c8a97e 50%,#111111 100%);">&nbsp;</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:40px 36px 36px;">
                    <p style="margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#9b7a50;">
                      Back in stock
                    </p>
                    <h1 class="force-ink" style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:500;line-height:1.2;color:#111111;letter-spacing:-0.02em;">
                      ${escapeHtml(input.productName)}
                    </h1>
                    ${
                      option
                        ? `<p class="force-muted" style="margin:0 0 18px;font-size:13px;line-height:1.6;color:#66615b;">Option you asked about: <strong style="color:#111111;font-weight:600;">${escapeHtml(option)}</strong></p>`
                        : ''
                    }
                    ${
                      input.imageUrl
                        ? `<img src="${escapeHtml(input.imageUrl)}" alt="${escapeHtml(input.productName)}" width="468" style="display:block;width:100%;max-width:468px;height:auto;border:0;border-radius:18px;margin:0 0 24px;" />`
                        : ''
                    }
                    <p class="force-muted" style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#66615b;">
                      You asked us to let you know when this came back. It is available again — restocks tend to go quickly, so we would not wait.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
                      <tr>
                        <td class="force-btn" align="center" style="border-radius:999px;background:#111111;">
                          <a href="${escapeHtml(input.productUrl)}" class="force-btn" style="display:inline-block;padding:15px 32px;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;line-height:1.2;">
                            Shop it now
                          </a>
                        </td>
                      </tr>
                    </table>
                    <div class="force-rule" style="height:1px;line-height:1px;font-size:0;background:#ece7df;margin:0 0 22px;">&nbsp;</div>
                    <p class="force-soft" style="margin:0;font-size:11px;line-height:1.6;color:#9a938a;">
                      This is a one-off alert for an item you asked about — you are not subscribed to anything.
                      <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#8f714d;text-decoration:none;">Remove this reminder</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 12px 0;font-size:11px;line-height:1.7;color:#8d857c;">
              © ${year} ${escapeHtml(store)}
              <span style="color:#cfc8bd;"> · </span>
              <a href="${escapeHtml(site)}" style="color:#8f714d;text-decoration:none;">${escapeHtml(host)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function generateBackInStockText(input: BackInStockEmailInput): string {
  const option = input.variantName?.trim()
  return [
    `${input.productName}${option ? ` (${option})` : ''} is back in stock.`,
    '',
    'You asked us to let you know when this came back. Restocks go quickly:',
    input.productUrl,
    '',
    `Remove this reminder: ${input.unsubscribeUrl}`,
  ].join('\n')
}

export interface PasswordResetEmailInput {
  firstName: string
  resetUrl: string
  storeName?: string
  siteUrl?: string
}

function resolvePublicSite(raw?: string): string {
  const fallback = 'https://splaro.co'
  const value = (raw ?? fallback).replace(/\/$/, '')
  try {
    const u = new URL(value.startsWith('http') ? value : `https://${value}`)
    const h = u.hostname.replace(/^www\./, '').toLowerCase()
    if (!h || h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local') || h.endsWith('.localhost')) {
      return fallback
    }
    return u.origin
  } catch {
    return fallback
  }
}

function resolveResetUrl(inputResetUrl: string, site: string): string {
  try {
    const ru = new URL(inputResetUrl)
    const rh = ru.hostname.replace(/^www\./, '').toLowerCase()
    const isLoopback =
      !rh ||
      rh === 'localhost' ||
      rh === '127.0.0.1' ||
      rh.endsWith('.local') ||
      rh.endsWith('.localhost')
    if (isLoopback) {
      // Production emails must never deep-link to localhost. In local/dev, keep
      // the loopback URL so the token is redeemed against the same DB that minted it.
      if (process.env.NODE_ENV === 'production') {
        return `${site}${ru.pathname}${ru.search}`
      }
      return ru.toString()
    }
    return ru.toString()
  } catch {
    return `${site}/reset-password`
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Premium always-light password reset mail.
 * PNG wordmark only (no duplicate text under logo — WebP often breaks in Gmail).
 */
export function generatePasswordResetEmailHTML(input: PasswordResetEmailInput): string {
  const store = input.storeName?.trim() || 'SPLARO'
  const site = resolvePublicSite(input.siteUrl)
  const name = input.firstName?.trim() || 'there'
  const resetUrl = resolveResetUrl(input.resetUrl, site)
  const host = site.replace(/^https?:\/\//, '')
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>Reset your ${escapeHtml(store)} password</title>
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
    Reset your ${escapeHtml(store)} password — link expires in 1 hour.
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
                      Password reset
                    </p>
                    <h1 class="force-ink" style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:500;line-height:1.2;color:#111111;letter-spacing:-0.02em;">
                      Reset your password
                    </h1>
                    <p class="force-muted" style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#66615b;">
                      Hi ${escapeHtml(name)}, we received a request to reset the password for your ${escapeHtml(store)} account.
                      Use the button below to choose a new one. This link expires in <strong style="color:#111111;font-weight:600;">1 hour</strong>.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
                      <tr>
                        <td class="force-btn" align="center" style="border-radius:999px;background:#111111;">
                          <a href="${escapeHtml(resetUrl)}" class="force-btn" style="display:inline-block;padding:15px 32px;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;line-height:1.2;">
                            Reset password
                          </a>
                        </td>
                      </tr>
                    </table>
                    <div class="force-rule" style="height:1px;line-height:1px;font-size:0;background:#ece7df;margin:0 0 22px;">&nbsp;</div>
                    <p class="force-soft" style="margin:0 0 18px;font-size:13px;line-height:1.65;color:#8a837b;">
                      If you didn&apos;t request this, you can safely ignore this email — your password won&apos;t change.
                    </p>
                    <p class="force-soft" style="margin:0;font-size:11px;line-height:1.6;color:#9a938a;">
                      Button not working? Paste this link into your browser:<br />
                      <a href="${escapeHtml(resetUrl)}" style="color:#8f714d;text-decoration:none;word-break:break-all;">${escapeHtml(resetUrl)}</a>
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

export function generatePasswordResetEmailText(input: PasswordResetEmailInput): string {
  const name = input.firstName?.trim() || 'there'
  const site = resolvePublicSite(input.siteUrl)
  const resetUrl = resolveResetUrl(input.resetUrl, site)
  return `Hi ${name},\n\nReset your SPLARO password:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`
}

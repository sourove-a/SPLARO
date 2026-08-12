export interface AdminPasswordResetEmailInput {
  firstName: string
  resetUrl: string
  storeName?: string
  adminUrl?: string
}

function sanitizeAdminOrigin(raw?: string | null): string {
  const fallback = 'https://admin.splaro.co'
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Premium always-light admin reset mail — logo only, no redundant brand text. */
export function generateAdminPasswordResetEmailHTML(input: AdminPasswordResetEmailInput): string {
  const store = input.storeName?.trim() || 'SPLARO'
  const adminOrigin = sanitizeAdminOrigin(input.adminUrl)
  const site = 'https://splaro.co'
  const name = input.firstName?.trim() || 'there'
  const year = new Date().getFullYear()

  let resetUrl = input.resetUrl
  try {
    const ru = new URL(input.resetUrl)
    const rh = ru.hostname.replace(/^www\./, '').toLowerCase()
    if (!rh || rh === 'localhost' || rh === '127.0.0.1' || rh.endsWith('.local') || rh.endsWith('.localhost')) {
      resetUrl = `${adminOrigin}${ru.pathname}${ru.search}`
    }
  } catch {
    resetUrl = `${adminOrigin}/reset-password`
  }

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>Reset your ${escapeHtml(store)} admin password</title>
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
                      Admin password reset
                    </p>
                    <h1 class="force-ink" style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:500;line-height:1.2;color:#111111;letter-spacing:-0.02em;">
                      Reset admin password
                    </h1>
                    <p class="force-muted" style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#66615b;">
                      Hi ${escapeHtml(name)}, we received a request to reset your ${escapeHtml(store)} admin password.
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
                    <p class="force-soft" style="margin:0;font-size:13px;line-height:1.65;color:#8a837b;">
                      If you didn&apos;t request this, ignore this email — your password won&apos;t change.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 12px 0;font-size:11px;line-height:1.7;color:#8d857c;">
              © ${year} ${escapeHtml(store)} · Admin
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function generateAdminPasswordResetEmailText(input: AdminPasswordResetEmailInput): string {
  const name = input.firstName?.trim() || 'there'
  return `Hi ${name},\n\nReset your SPLARO admin password:\n${input.resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`
}

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

export function generateAdminPasswordResetEmailHTML(input: AdminPasswordResetEmailInput): string {
  const store = input.storeName?.trim() || 'SPLARO'
  const adminOrigin = sanitizeAdminOrigin(input.adminUrl)
  const site = 'https://splaro.co'
  const name = input.firstName?.trim() || 'there'

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
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your ${escapeHtml(store)} admin password</title>
</head>
<body style="margin:0;padding:0;background:#0a0c10;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#0a0c10 0%,#12151c 100%);padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="${escapeHtml(site)}/images/logo/splaro-logo-invoice-white.png" alt="${escapeHtml(store)}" width="132" height="auto" style="display:block;margin:0 auto 14px;max-width:132px;height:auto;" />
              <div style="font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:#c8a97e;">${escapeHtml(store)}</div>
              <div style="margin-top:8px;font-size:13px;color:rgba(255,255,255,0.45);">Commerce Admin</div>
            </td>
          </tr>
          <tr>
            <td style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:24px;padding:36px 32px;">
              <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#c8a97e;margin-bottom:12px;">Password reset</div>
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:600;line-height:1.25;color:#ffffff;">Reset admin password</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.72);">
                Hi ${escapeHtml(name)}, we received a request to reset your ${escapeHtml(store)} admin password.
                Tap below to choose a new one. This link expires in <strong style="color:#fff;">1 hour</strong>.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:999px;background:#ffffff;">
                    <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:14px 28px;color:#111111;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.5);">
                If you didn&apos;t request this, ignore this email — your password won&apos;t change.
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.35);word-break:break-all;">
                Or copy this link:<br />
                <a href="${escapeHtml(resetUrl)}" style="color:#c8a97e;text-decoration:none;">${escapeHtml(resetUrl)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.35);">
              © ${new Date().getFullYear()} ${escapeHtml(store)} · Admin
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

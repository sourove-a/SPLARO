export interface EmailVerificationInput {
  firstName: string
  verifyUrl: string
  storeName?: string
  siteUrl?: string
  expiresInMinutes?: number
}

export function generateEmailVerificationHTML(input: EmailVerificationInput): string {
  const store = input.storeName?.trim() || 'SPLARO'
  const raw = (input.siteUrl ?? 'https://splaro.co').replace(/\/$/, '')
  let site = 'https://splaro.co'
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    const h = u.hostname.replace(/^www\./, '').toLowerCase()
    if (h && h !== 'localhost' && h !== '127.0.0.1' && !h.endsWith('.local') && !h.endsWith('.localhost')) {
      site = u.origin
    }
  } catch {
    site = 'https://splaro.co'
  }
  const name = input.firstName?.trim() || 'there'
  const minutes = input.expiresInMinutes ?? 120

  let verifyUrl = input.verifyUrl
  try {
    const vu = new URL(input.verifyUrl)
    const vh = vu.hostname.replace(/^www\./, '').toLowerCase()
    if (!vh || vh === 'localhost' || vh === '127.0.0.1' || vh.endsWith('.local') || vh.endsWith('.localhost')) {
      // Keep localhost in local/dev so the button works on :3000.
      if (process.env.NODE_ENV === 'production') {
        verifyUrl = `${site}${vu.pathname}${vu.search}`
      }
    }
  } catch {
    verifyUrl = `${site}/verify-email`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your ${escapeHtml(store)} email</title>
</head>
<body style="margin:0;padding:0;background:#f6f2ec;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#faf8f5 0%,#eee7dd 100%);padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;">
        <tr><td align="center" style="padding-bottom:26px;">
          <img src="${escapeHtml(site)}/images/logo/splaro-logo-email.png" alt="${escapeHtml(store)}" width="132" style="display:block;max-width:132px;height:auto;margin:0 auto 12px;" />
          <div style="font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:#8f714d;">Quiet luxury · Bangladesh</div>
        </td></tr>
        <tr><td style="overflow:hidden;border:1px solid rgba(17,17,17,.09);border-radius:28px;background:#ffffff;box-shadow:0 24px 70px rgba(39,29,18,.10);">
          <div style="height:5px;background:linear-gradient(90deg,#111111 0%,#c8a97e 50%,#111111 100%);"></div>
          <div style="padding:38px 34px 34px;">
            <div style="margin-bottom:12px;font-size:10px;font-weight:700;letter-spacing:.25em;text-transform:uppercase;color:#9b7a50;">Email verification</div>
            <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:31px;font-weight:500;line-height:1.2;color:#111111;">Confirm your email</h1>
            <p style="margin:0 0 26px;font-size:15px;line-height:1.75;color:#66615b;">Hi ${escapeHtml(name)}, verification is optional. Tap the button below to confirm your email for ${escapeHtml(store)} — no code to type.</p>
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
              <tr>
                <td style="border-radius:999px;background:#111111;">
                  <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">
                    Verify email
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 12px;font-size:13px;line-height:1.65;color:#8a837b;">This link expires in ${minutes} minutes. If you did not request it, ignore this email.</p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#918a82;word-break:break-all;">
              Or copy this link:<br />
              <a href="${escapeHtml(verifyUrl)}" style="color:#8f714d;text-decoration:none;">${escapeHtml(verifyUrl)}</a>
            </p>
          </div>
        </td></tr>
        <tr><td align="center" style="padding-top:24px;font-size:11px;line-height:1.6;color:#8d857c;">© ${new Date().getFullYear()} ${escapeHtml(store)} · <a href="${escapeHtml(site)}" style="color:#8f714d;text-decoration:none;">${escapeHtml(site.replace(/^https?:\/\//, ''))}</a></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function generateEmailVerificationText(input: EmailVerificationInput): string {
  const name = input.firstName?.trim() || 'there'
  const minutes = input.expiresInMinutes ?? 120
  return `Hi ${name},\n\nVerify your SPLARO email (optional) by opening this link:\n${input.verifyUrl}\n\nThis link expires in ${minutes} minutes. No code needed.\n\nIf you did not request this, ignore this email.`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface EmailVerificationInput {
  firstName: string
  code: string
  storeName?: string
  siteUrl?: string
  expiresInMinutes?: number
}

export function generateEmailVerificationHTML(input: EmailVerificationInput): string {
  const store = input.storeName?.trim() || 'SPLARO'
  const site = (input.siteUrl ?? 'https://splaro.co').replace(/\/$/, '')
  const name = input.firstName?.trim() || 'there'
  const minutes = input.expiresInMinutes ?? 10

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
          <img src="${escapeHtml(site)}/images/logo/splaro-logo-black-premium.webp" alt="${escapeHtml(store)}" width="138" style="display:block;max-width:138px;height:auto;margin:0 auto 12px;" />
          <div style="font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:#8f714d;">Quiet luxury · Bangladesh</div>
        </td></tr>
        <tr><td style="overflow:hidden;border:1px solid rgba(17,17,17,.09);border-radius:28px;background:#ffffff;box-shadow:0 24px 70px rgba(39,29,18,.10);">
          <div style="height:5px;background:linear-gradient(90deg,#111111 0%,#c8a97e 50%,#111111 100%);"></div>
          <div style="padding:38px 34px 34px;">
            <div style="margin-bottom:12px;font-size:10px;font-weight:700;letter-spacing:.25em;text-transform:uppercase;color:#9b7a50;">Email verification</div>
            <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:31px;font-weight:500;line-height:1.2;color:#111111;">Confirm your email</h1>
            <p style="margin:0 0 26px;font-size:15px;line-height:1.75;color:#66615b;">Hi ${escapeHtml(name)}, use this private code to verify your ${escapeHtml(store)} account. Verification is optional, but helps protect your account and order updates.</p>
            <div style="padding:24px 16px;border:1px solid rgba(200,169,126,.45);border-radius:20px;background:#faf8f5;text-align:center;">
              <div style="margin-bottom:10px;font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#8f714d;">Your verification code</div>
              <div style="font-family:'Courier New',monospace;font-size:38px;font-weight:700;letter-spacing:.22em;color:#111111;">${escapeHtml(input.code)}</div>
              <div style="margin-top:10px;font-size:12px;color:#8a837b;">Expires in ${minutes} minutes</div>
            </div>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.65;color:#918a82;">Never share this code. SPLARO will never ask for it by phone, chat, or social media. If you did not request it, safely ignore this email.</p>
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
  const minutes = input.expiresInMinutes ?? 10
  return `Hi ${name},\n\nYour SPLARO email verification code is: ${input.code}\n\nThis code expires in ${minutes} minutes. Never share it with anyone.\n\nIf you did not request this code, ignore this email.`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

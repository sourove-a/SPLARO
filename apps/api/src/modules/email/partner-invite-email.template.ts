/** Partner equity invite — confirmation email (transactional). */

export interface PartnerInviteEmailInput {
  partnerName: string
  partnerEmail: string
  storeName: string
  sharePercent: number
  confirmUrl: string
  siteUrl?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function resolveSite(raw?: string): string {
  const fallback = 'https://splaro.co'
  const input = (raw?.trim() || fallback).replace(/\/$/, '')
  try {
    const u = new URL(input.startsWith('http') ? input : `https://${input}`)
    const h = u.hostname.replace(/^www\./, '').toLowerCase()
    if (!h || h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return fallback
    return u.origin
  } catch {
    return fallback
  }
}

export function generatePartnerInviteEmailHTML(input: PartnerInviteEmailInput): string {
  const site = resolveSite(input.siteUrl)
  const name = escapeHtml(input.partnerName)
  const store = escapeHtml(input.storeName)
  const share = escapeHtml(String(input.sharePercent))
  const confirm = escapeHtml(input.confirmUrl)
  const email = escapeHtml(input.partnerEmail)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Partner invitation — ${store}</title>
</head>
<body style="margin:0;padding:0;background:#f3f0ea;color:#111111;font-family:Arial,'Helvetica Neue',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f0ea;">
    <tr>
      <td align="center" style="padding:34px 14px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#faf8f5;border:1px solid #ded8ce;border-radius:20px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:34px 28px 29px;background:#111111;">
              <a href="${escapeHtml(site)}" style="text-decoration:none;">
                <img src="${escapeHtml(site)}/images/logo/splaro-logo-white-premium.png" width="150" alt="SPLARO" style="display:block;width:150px;max-width:100%;height:auto;border:0;" />
              </a>
              <p style="margin:16px 0 0;color:#c8a974;font-size:10px;letter-spacing:3px;text-transform:uppercase;">Partner invitation</p>
            </td>
          </tr>
          <tr>
            <td style="padding:42px 38px 36px;">
              <p style="margin:0 0 12px;color:#8a704d;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Equity partnership</p>
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:400;">Hello ${name},</h1>
              <p style="margin:18px 0 0;color:#5d5a55;font-size:15px;line-height:1.75;">
                You have been added as a partner of <strong style="color:#111">${store}</strong> with an equity share of
                <strong style="color:#111">${share}%</strong>.
              </p>
              <p style="margin:14px 0 0;color:#5d5a55;font-size:15px;line-height:1.75;">
                Please confirm this invitation to acknowledge your partnership. This does not create a login — it confirms your details on record.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:30px;">
                <tr>
                  <td style="border-radius:999px;background:#111111;">
                    <a href="${confirm}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Confirm partnership</a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;color:#9a958d;font-size:12px;line-height:1.6;">Sent to ${email}. If you did not expect this, ignore the message or contact the store owner.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 38px;background:#f4f0e9;border-top:1px solid #ded8ce;">
              <p style="margin:0;color:#7a756d;font-size:11px;line-height:1.65;">© ${new Date().getFullYear()} SPLARO · Dhaka, Bangladesh</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function generatePartnerInviteEmailText(input: PartnerInviteEmailInput): string {
  return [
    `Hello ${input.partnerName},`,
    '',
    `You have been added as a partner of ${input.storeName} with ${input.sharePercent}% equity share.`,
    '',
    `Confirm your partnership: ${input.confirmUrl}`,
    '',
    'This confirms your details on record — it does not create a login.',
    '',
    '— SPLARO',
  ].join('\n')
}

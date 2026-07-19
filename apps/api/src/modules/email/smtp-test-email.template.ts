export interface SmtpTestEmailInput {
  recipient: string
  siteUrl?: string
  sentAt?: Date
}

export function generateSmtpTestEmailHTML(input: SmtpTestEmailInput): string {
  const site = (input.siteUrl?.trim() || 'https://splaro.co').replace(/\/$/, '')
  const sentAt = (input.sentAt ?? new Date()).toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <title>SPLARO email connection confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f3f0ea;color:#111111;font-family:Arial,'Helvetica Neue',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your SPLARO transactional email connection is working correctly.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f0ea;">
    <tr>
      <td align="center" style="padding:34px 14px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#faf8f5;border:1px solid #ded8ce;border-radius:20px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:34px 28px 29px;background:#111111;">
              <a href="${escapeHtml(site)}" style="text-decoration:none;">
                <img src="${escapeHtml(site)}/images/logo/splaro-logo-white-premium.png" width="150" alt="SPLARO" style="display:block;width:150px;max-width:100%;height:auto;border:0;" />
              </a>
              <div style="width:42px;height:1px;background:#c8a97e;margin:22px auto 0;"></div>
              <p style="margin:12px 0 0;color:#c8a97e;font-size:10px;line-height:1.4;letter-spacing:3px;text-transform:uppercase;">Quiet luxury · Bangladesh</p>
            </td>
          </tr>
          <tr>
            <td style="padding:42px 38px 36px;">
              <p style="margin:0 0 13px;color:#8a704d;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;">Email system check</p>
              <h1 style="margin:0;color:#111111;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;font-weight:400;letter-spacing:-0.5px;">Connection confirmed.</h1>
              <p style="margin:18px 0 0;color:#5d5a55;font-size:15px;line-height:1.75;">This message travelled through SPLARO SMTP successfully. Order confirmations, invoices, password resets, and customer updates can now use this channel.</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:28px;background:#ffffff;border:1px solid #e5dfd5;border-radius:14px;">
                <tr>
                  <td width="52" valign="top" style="padding:20px 0 20px 20px;">
                    <div style="width:32px;height:32px;border-radius:50%;background:#e7f5ec;color:#176b3a;font-size:18px;line-height:32px;text-align:center;font-weight:700;">✓</div>
                  </td>
                  <td style="padding:20px 20px 20px 14px;">
                    <p style="margin:0;color:#176b3a;font-size:12px;line-height:1.4;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">SMTP accepted</p>
                    <p style="margin:7px 0 0;color:#6b6862;font-size:13px;line-height:1.55;word-break:break-word;">Recipient: ${escapeHtml(input.recipient)}<br />Bangladesh time: ${escapeHtml(sentAt)}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:30px;">
                <tr>
                  <td style="border-radius:999px;background:#111111;">
                    <a href="${escapeHtml(site)}" style="display:inline-block;padding:14px 25px;color:#ffffff;text-decoration:none;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Visit SPLARO</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 38px;background:#f4f0e9;border-top:1px solid #ded8ce;">
              <p style="margin:0;color:#7a756d;font-size:11px;line-height:1.65;">Automated system email from SPLARO. Replies go to <a href="mailto:info@splaro.co" style="color:#8a704d;text-decoration:none;">info@splaro.co</a>.</p>
              <p style="margin:8px 0 0;color:#9a958d;font-size:10px;line-height:1.5;">© ${new Date().getFullYear()} SPLARO · Dhaka, Bangladesh</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function generateSmtpTestEmailText(input: SmtpTestEmailInput): string {
  return `SPLARO email connection confirmed.\n\nSMTP accepted the test message for ${input.recipient}.\n\nVisit https://splaro.co\nReply: info@splaro.co`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function generateCampaignEmailHTML(input: {
  subject: string
  body: string
  customerName: string
  siteUrl?: string
}): string {
  const raw = (input.siteUrl?.trim() || 'https://splaro.co').replace(/\/$/, '')
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
  const paragraphs = escapeHtml(input.body).replace(/\n/g, '<br />')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;background:#f3f0ea;color:#111;font-family:Arial,'Helvetica Neue',sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.subject)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f0ea"><tr><td align="center" style="padding:34px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#faf8f5;border:1px solid #ded8ce;border-radius:20px;overflow:hidden">
<tr><td align="center" style="padding:34px 24px 28px;background:#111"><img src="${escapeHtml(site)}/images/logo/splaro-logo-white-premium.png" width="150" alt="SPLARO" style="display:block;width:150px;height:auto;border:0"><div style="width:42px;height:1px;background:#c8a97e;margin:20px auto 0"></div><p style="margin:11px 0 0;color:#c8a97e;font-size:10px;letter-spacing:3px;text-transform:uppercase">A private offer from SPLARO</p></td></tr>
<tr><td style="padding:42px 38px 38px"><p style="margin:0 0 12px;color:#8a704d;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">For ${escapeHtml(input.customerName || 'you')}</p><h1 style="margin:0;color:#111;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;font-weight:400">${escapeHtml(input.subject)}</h1><p style="margin:20px 0 0;color:#5d5a55;font-size:15px;line-height:1.8">${paragraphs}</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:30px"><tr><td style="border-radius:999px;background:#111"><a href="${escapeHtml(site)}/shop" style="display:inline-block;padding:14px 26px;color:#fff;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase">Shop collection</a></td></tr></table></td></tr>
<tr><td style="padding:22px 38px;background:#f4f0e9;border-top:1px solid #ded8ce"><p style="margin:0;color:#77726a;font-size:11px;line-height:1.65">You received this because you accepted SPLARO marketing. Manage preferences from your account or reply to <a href="mailto:info@splaro.co" style="color:#8a704d;text-decoration:none">info@splaro.co</a>.</p><p style="margin:8px 0 0;color:#99938b;font-size:10px">© ${new Date().getFullYear()} SPLARO · Dhaka, Bangladesh</p></td></tr>
</table></td></tr></table></body></html>`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

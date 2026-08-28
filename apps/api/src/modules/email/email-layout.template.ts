/**
 * The shell every new transactional mail is built in.
 *
 * The eight templates that predate this file each carried their own copy of the
 * same markup — wordmark, gold rule, white card, forced-light overrides — and
 * they had already drifted apart by a few pixels. Rather than rewrite working
 * mail, this is the one shell new documents use, matching that house style
 * exactly so a purchase order and a back-in-stock alert still look like they
 * came from the same shop.
 *
 * Everything is table markup with inline styles: Outlook ignores <div> layout
 * and strips <style> blocks, and Gmail drops classes it does not recognise. The
 * `force-*` classes only carry the dark-mode overrides, which is the one thing
 * inline styles cannot express.
 */

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Taka, grouped the way Bangladeshi readers expect (3,50,000 — not 350,000).
 *
 * en-IN rather than en-BD: the lakh/crore grouping is the point, and Node's
 * ICU data for en-BD falls back to Western grouping on some builds, which would
 * silently make a supplier's invoice read wrong on the VPS but right locally.
 */
export function formatEmailTaka(value: unknown): string {
  const n = Number(value)
  const safe = Number.isFinite(n) ? n : 0
  const body = safe.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `Tk ${body}`
}

/** "28 Aug 2026" — unambiguous for a reader who writes dates day-first. */
export function formatEmailDate(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export interface EmailLayoutInput {
  /** Small uppercase line above the heading — what kind of document this is. */
  eyebrow: string
  heading: string
  /** Optional sentence under the heading, before the body blocks. */
  intro?: string | undefined
  /** Pre-rendered HTML blocks, in order. Build them with the helpers below. */
  blocks: string[]
  /** Optional single call to action. */
  action?: { label: string; url: string } | undefined
  /** Small print above the footer rule. */
  footnote?: string | undefined
  /** Hidden preheader — the grey line a client shows next to the subject. */
  preheader?: string | undefined
  storeName?: string | undefined
  siteUrl?: string | undefined
}

export function renderEmailLayout(input: EmailLayoutInput): string {
  const store = input.storeName?.trim() || 'SPLARO'
  const site = (input.siteUrl ?? 'https://splaro.co').replace(/\/$/, '')
  const host = site.replace(/^https?:\/\//, '')
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(input.heading)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    :root { color-scheme: light only; }
    @media (prefers-color-scheme: dark) {
      .force-light { background-color: #f7f3ed !important; color: #111111 !important; }
      .force-card { background-color: #ffffff !important; color: #111111 !important; }
      .force-panel { background-color: #faf7f2 !important; }
      .force-ink { color: #111111 !important; }
      .force-muted { color: #66615b !important; }
      .force-soft { color: #8a837b !important; }
      .force-btn { background-color: #111111 !important; color: #ffffff !important; }
      .force-rule { background-color: #ece7df !important; }
    }
    @media only screen and (max-width: 520px) {
      .pad { padding-left: 22px !important; padding-right: 22px !important; }
      .stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body class="force-light" style="margin:0;padding:0;background:#f7f3ed;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111111;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(input.preheader ?? input.intro ?? input.heading)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="force-light" style="background:#f7f3ed;padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
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
                  <td class="pad" style="padding:40px 36px 36px;">
                    <p style="margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#9b7a50;">
                      ${escapeHtml(input.eyebrow)}
                    </p>
                    <h1 class="force-ink" style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:500;line-height:1.25;color:#111111;letter-spacing:-0.02em;">
                      ${escapeHtml(input.heading)}
                    </h1>
                    ${
                      input.intro
                        ? `<p class="force-muted" style="margin:0 0 26px;font-size:15px;line-height:1.75;color:#66615b;">${escapeHtml(input.intro)}</p>`
                        : ''
                    }
                    ${input.blocks.join('\n')}
                    ${
                      input.action
                        ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 26px;">
                      <tr>
                        <td class="force-btn" align="center" style="border-radius:999px;background:#111111;">
                          <a href="${escapeHtml(input.action.url)}" class="force-btn" style="display:inline-block;padding:15px 32px;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;line-height:1.2;">
                            ${escapeHtml(input.action.label)}
                          </a>
                        </td>
                      </tr>
                    </table>`
                        : ''
                    }
                    ${
                      input.footnote
                        ? `<div class="force-rule" style="height:1px;line-height:1px;font-size:0;background:#ece7df;margin:6px 0 22px;">&nbsp;</div>
                    <p class="force-soft" style="margin:0;font-size:11px;line-height:1.65;color:#9a938a;">${escapeHtml(input.footnote)}</p>`
                        : ''
                    }
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

/** Label/value pairs — reference numbers, dates, contacts. */
export function renderMetaBlock(rows: Array<[string, string]>): string {
  const visible = rows.filter(([, value]) => value && value !== '—')
  if (!visible.length) return ''
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="force-panel" style="margin:0 0 24px;background:#faf7f2;border-radius:16px;">
  <tr><td style="padding:18px 20px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${visible
        .map(
          ([label, value]) => `<tr>
        <td style="padding:5px 0;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9a938a;white-space:nowrap;">${escapeHtml(label)}</td>
        <td align="right" class="force-ink" style="padding:5px 0;font-size:13px;font-weight:600;color:#111111;">${escapeHtml(value)}</td>
      </tr>`,
        )
        .join('')}
    </table>
  </td></tr>
</table>`
}

export interface EmailLineItem {
  name: string
  /** SKU, option, or anything that identifies the exact thing. */
  detail?: string | null
  quantity: number
  /** Omitted for a document where price is not the point (a goods-received note). */
  unitCost?: number | null
  lineTotal?: number | null
}

/**
 * The goods table.
 *
 * Money columns are dropped entirely when no line carries a price, so a
 * receiving note does not print a column of dashes where costs would go.
 */
export function renderLineItemsBlock(items: EmailLineItem[], title = 'Items'): string {
  if (!items.length) return ''
  const withMoney = items.some((item) => item.unitCost != null || item.lineTotal != null)
  const th = `padding:0 0 9px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9a938a;`
  const td = `padding:11px 0;font-size:13px;line-height:1.5;border-top:1px solid #ece7df;`

  return `<p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#9b7a50;">${escapeHtml(title)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
  <tr>
    <th align="left" style="${th}">Item</th>
    <th align="right" style="${th}">Qty</th>
    ${withMoney ? `<th align="right" style="${th}">Rate</th><th align="right" style="${th}">Amount</th>` : ''}
  </tr>
  ${items
    .map(
      (item) => `<tr>
    <td align="left" class="force-ink" style="${td}color:#111111;">
      <strong style="font-weight:600;">${escapeHtml(item.name)}</strong>
      ${item.detail ? `<br /><span class="force-soft" style="font-size:11px;color:#9a938a;">${escapeHtml(item.detail)}</span>` : ''}
    </td>
    <td align="right" class="force-ink" style="${td}color:#111111;white-space:nowrap;">${escapeHtml(String(item.quantity))}</td>
    ${
      withMoney
        ? `<td align="right" class="force-muted" style="${td}color:#66615b;white-space:nowrap;">${item.unitCost == null ? '—' : escapeHtml(formatEmailTaka(item.unitCost))}</td>
    <td align="right" class="force-ink" style="${td}color:#111111;font-weight:600;white-space:nowrap;">${item.lineTotal == null ? '—' : escapeHtml(formatEmailTaka(item.lineTotal))}</td>`
        : ''
    }
  </tr>`,
    )
    .join('')}
</table>`
}

export interface EmailTotalRow {
  label: string
  value: number
  /** Draws the row bigger, with a rule above it — the one number that matters. */
  emphasis?: boolean
  /** Keeps a zero row (discount, transport) out of the printed document. */
  hideWhenZero?: boolean
}

export function renderTotalsBlock(rows: EmailTotalRow[]): string {
  const visible = rows.filter((row) => !(row.hideWhenZero && Number(row.value) === 0))
  if (!visible.length) return ''
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="force-panel" style="margin:0 0 26px;background:#faf7f2;border-radius:16px;">
  <tr><td style="padding:18px 20px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${visible
        .map((row) =>
          row.emphasis
            ? `<tr>
        <td style="padding:13px 0 0;border-top:1px solid #e6dfd3;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#111111;">${escapeHtml(row.label)}</td>
        <td align="right" class="force-ink" style="padding:13px 0 0;border-top:1px solid #e6dfd3;font-size:18px;font-weight:700;color:#111111;white-space:nowrap;">${escapeHtml(formatEmailTaka(row.value))}</td>
      </tr>`
            : `<tr>
        <td style="padding:4px 0;font-size:13px;color:#66615b;">${escapeHtml(row.label)}</td>
        <td align="right" class="force-ink" style="padding:4px 0;font-size:13px;color:#111111;white-space:nowrap;">${escapeHtml(formatEmailTaka(row.value))}</td>
      </tr>`,
        )
        .join('')}
    </table>
  </td></tr>
</table>`
}

/** A short highlighted sentence — an ETA, a warning, a next step. */
export function renderCalloutBlock(text: string, tone: 'neutral' | 'warn' = 'neutral'): string {
  const accent = tone === 'warn' ? '#b4541f' : '#8f714d'
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
  <tr><td style="padding:14px 18px;border-left:3px solid ${accent};background:#faf7f2;border-radius:0 12px 12px 0;">
    <p class="force-muted" style="margin:0;font-size:13.5px;line-height:1.65;color:#66615b;">${escapeHtml(text)}</p>
  </td></tr>
</table>`
}

/** Free paragraph — notes typed by an operator. */
export function renderNoteBlock(label: string, body: string): string {
  if (!body.trim()) return ''
  return `<p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#9b7a50;">${escapeHtml(label)}</p>
<p class="force-muted" style="margin:0 0 24px;font-size:13.5px;line-height:1.7;color:#66615b;white-space:pre-line;">${escapeHtml(body)}</p>`
}

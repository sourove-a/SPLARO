import type {
  BotCommand,
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  KeyboardButton,
  ReplyKeyboardMarkup,
} from 'node-telegram-bot-api'
import { escapeTelegramHtml } from './telegram.util'
import { TG_UI, tgEmoji, tgSectionTitle } from './telegram-ui-config'

/** Reply keyboard button labels — also used as route keys */
export const TG_BTN = {
  MENU: 'Control Center',
  DASHBOARD: 'Live Status',
  ORDERS_TODAY: 'Orders Today',
  SALES_TODAY: 'Sales Today',
  PENDING: 'Pending Orders',
  LOW_STOCK: 'Low Stock',
  FINANCE: 'Finance Hub',
  ADMIN_LOGIN: 'Admin Login',
  API_HEALTH: 'API Health',
  AI_CHAT: 'AI Chat',
  GROUP_LINK: 'Link Chat',
  GROUP_INFO: 'Chat Info',
  BACK: 'Back',
} as const

export const TG_CALLBACK = {
  MENU_MAIN: 'menu:main',
  MENU_ORDERS: 'menu:orders',
  MENU_COURIER: 'menu:courier',
  MENU_FINANCE: 'menu:finance',
  MENU_INVENTORY: 'menu:inventory',
  MENU_ADMIN: 'menu:admin',
  MENU_AI: 'menu:ai',
  STATUS_SUMMARY: 'act:status_summary',
  ORDERS_LIST: 'act:orders_list',
  COURIER_SNAPSHOT: 'act:courier_snapshot',
  INVENTORY_SNAPSHOT: 'act:inventory_snapshot',
  INVENTORY_LOOKUP_HELP: 'act:inventory_lookup_help',
  DELIVERY_DIAGNOSTICS: 'act:delivery_diagnostics',
  LINKED_ADMINS: 'act:linked_admins',
  AI_PROMPT_SALES: 'act:ai_prompt_sales',
  AI_PROMPT_RISK: 'act:ai_prompt_risk',
  AI_PROMPT_STOCK: 'act:ai_prompt_stock',
  ORDERS_TODAY: 'act:orders_today',
  SALES_TODAY: 'act:sales_today',
  PENDING: 'act:pending',
  LOW_STOCK: 'act:low_stock',
  DELIVERED_TODAY: 'act:delivered_today',
  REPORT_TODAY: 'act:report_today',
  PROFIT_TODAY: 'act:profit_today',
  PROFIT_MONTH: 'act:profit_month',
  EXPENSES_TODAY: 'act:expenses_today',
  API_HEALTH: 'act:api_health',
  ADMIN_LOGIN: 'act:admin_login',
  SYNC_SHEETS: 'act:sync_sheets',
  LINK_GROUP: 'act:link_group',
  GROUP_INFO: 'act:group_info',
} as const

export function listCallback(kind: 'orders', page: number): string {
  return `list:${kind}:${page}`
}

export function parseListCallback(data: string): { kind: 'orders'; page: number } | null {
  const m = /^list:(orders):(\d+)$/.exec(data)
  if (!m) return null
  return { kind: 'orders', page: Number(m[2] ?? '0') || 0 }
}

export function orderCallback(action: 'confirm' | 'courier' | 'track', invoice: string): string {
  return `order:${action}:${invoice}`
}

export function parseOrderCallback(data: string): { action: 'confirm' | 'courier' | 'track'; invoice: string } | null {
  const m = /^order:(confirm|courier|track):(.+)$/.exec(data)
  if (!m) return null
  return { action: m[1] as 'confirm' | 'courier' | 'track', invoice: m[2]! }
}

export function mainReplyKeyboard(): ReplyKeyboardMarkup {
  const row = (labels: string[]) => labels as unknown as KeyboardButton[]
  return {
    keyboard: [
      row([TG_BTN.MENU, TG_BTN.DASHBOARD]),
      row([TG_BTN.ORDERS_TODAY, TG_BTN.PENDING]),
      row([TG_BTN.FINANCE, TG_BTN.LOW_STOCK]),
      row([TG_BTN.ADMIN_LOGIN, TG_BTN.AI_CHAT]),
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: 'SPL-1001 · or ask SPLARO AI…',
  }
}

export function inlineMainMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: `${TG_UI.sections.orders.icon} ${TG_UI.sections.orders.label}`, callback_data: TG_CALLBACK.MENU_ORDERS },
        { text: `${TG_UI.sections.courier.icon} ${TG_UI.sections.courier.label}`, callback_data: TG_CALLBACK.MENU_COURIER },
      ],
      [
        { text: `${TG_UI.sections.finance.icon} ${TG_UI.sections.finance.label}`, callback_data: TG_CALLBACK.MENU_FINANCE },
        { text: `${TG_UI.sections.inventory.icon} ${TG_UI.sections.inventory.label}`, callback_data: TG_CALLBACK.MENU_INVENTORY },
      ],
      [
        { text: `${TG_UI.sections.admin.icon} ${TG_UI.sections.admin.label}`, callback_data: TG_CALLBACK.MENU_ADMIN },
        { text: `${TG_UI.sections.ai.icon} ${TG_UI.sections.ai.label}`, callback_data: TG_CALLBACK.MENU_AI },
      ],
      [
        { text: 'Status Snapshot', callback_data: TG_CALLBACK.STATUS_SUMMARY },
        { text: 'Delivery Logs', callback_data: TG_CALLBACK.DELIVERY_DIAGNOSTICS },
      ],
    ],
  }
}

export function inlineOrdersMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Today', callback_data: TG_CALLBACK.ORDERS_TODAY },
        { text: 'Pending', callback_data: TG_CALLBACK.PENDING },
      ],
      [
        { text: 'Sales', callback_data: TG_CALLBACK.SALES_TODAY },
        { text: 'Latest', callback_data: TG_CALLBACK.ORDERS_LIST },
      ],
      [
        { text: 'Delivered', callback_data: TG_CALLBACK.DELIVERED_TODAY },
        { text: 'Daily Report', callback_data: TG_CALLBACK.REPORT_TODAY },
      ],
      [{ text: 'Open Courier Hub', callback_data: TG_CALLBACK.MENU_COURIER }],
      [{ text: 'Back to Main', callback_data: TG_CALLBACK.MENU_MAIN }],
    ],
  }
}

export function inlineCourierMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Courier Snapshot', callback_data: TG_CALLBACK.COURIER_SNAPSHOT },
        { text: 'Pending Queue', callback_data: TG_CALLBACK.PENDING },
      ],
      [
        { text: 'Delivery Logs', callback_data: TG_CALLBACK.DELIVERY_DIAGNOSTICS },
        { text: 'Book by Invoice', callback_data: TG_CALLBACK.MENU_ORDERS },
      ],
      [{ text: 'Back to Main', callback_data: TG_CALLBACK.MENU_MAIN }],
    ],
  }
}

export function inlineFinanceMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Profit Today', callback_data: TG_CALLBACK.PROFIT_TODAY },
        { text: 'Profit Month', callback_data: TG_CALLBACK.PROFIT_MONTH },
      ],
      [
        { text: 'Expenses', callback_data: TG_CALLBACK.EXPENSES_TODAY },
        { text: 'Sync Sheets', callback_data: TG_CALLBACK.SYNC_SHEETS },
      ],
      [{ text: 'AI Sales Brief', callback_data: TG_CALLBACK.AI_PROMPT_SALES }],
      [{ text: 'Back to Main', callback_data: TG_CALLBACK.MENU_MAIN }],
    ],
  }
}

export function inlineInventoryMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Low Stock', callback_data: TG_CALLBACK.LOW_STOCK },
        { text: 'Stock Snapshot', callback_data: TG_CALLBACK.INVENTORY_SNAPSHOT },
      ],
      [
        { text: 'SKU Lookup Help', callback_data: TG_CALLBACK.INVENTORY_LOOKUP_HELP },
        { text: 'AI Stock Brief', callback_data: TG_CALLBACK.AI_PROMPT_STOCK },
      ],
      [{ text: 'Back to Main', callback_data: TG_CALLBACK.MENU_MAIN }],
    ],
  }
}

export function inlineAdminMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Admin Login', callback_data: TG_CALLBACK.ADMIN_LOGIN },
        { text: 'API Health', callback_data: TG_CALLBACK.API_HEALTH },
      ],
      [
        { text: 'Linked Admins', callback_data: TG_CALLBACK.LINKED_ADMINS },
        { text: 'Chat Info', callback_data: TG_CALLBACK.GROUP_INFO },
      ],
      [
        { text: 'Link Chat', callback_data: TG_CALLBACK.LINK_GROUP },
        { text: 'Delivery Logs', callback_data: TG_CALLBACK.DELIVERY_DIAGNOSTICS },
      ],
      [{ text: 'Back to Main', callback_data: TG_CALLBACK.MENU_MAIN }],
    ],
  }
}

export function inlineAiMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Sales Brief', callback_data: TG_CALLBACK.AI_PROMPT_SALES },
        { text: 'COD Risk', callback_data: TG_CALLBACK.AI_PROMPT_RISK },
      ],
      [
        { text: 'Stock Risk', callback_data: TG_CALLBACK.AI_PROMPT_STOCK },
        { text: 'Live Status', callback_data: TG_CALLBACK.STATUS_SUMMARY },
      ],
      [{ text: 'Back to Main', callback_data: TG_CALLBACK.MENU_MAIN }],
    ],
  }
}

export function orderListKeyboard(page: number, hasMore: boolean): InlineKeyboardMarkup {
  const nav: InlineKeyboardButton[] = []
  if (page > 0) nav.push({ text: 'Previous', callback_data: listCallback('orders', page - 1) })
  if (hasMore) nav.push({ text: 'Next', callback_data: listCallback('orders', page + 1) })
  return {
    inline_keyboard: [
      ...(nav.length > 0 ? [nav] : []),
      [{ text: 'Orders Hub', callback_data: TG_CALLBACK.MENU_ORDERS }],
    ],
  }
}

export function premiumHeader(title: string, subtitle?: string): string {
  return `
┌──────────────────────────┐
│  <b>${escapeTelegramHtml(title)}</b>
└──────────────────────────┘${subtitle ? `\n${escapeTelegramHtml(subtitle)}` : ''}
`.trim()
}

export function controlCenterSections(): string {
  return [
    tgSectionTitle(tgEmoji('orders', TG_UI.sections.orders.icon), TG_UI.sections.orders.label),
    tgSectionTitle(tgEmoji('courier', TG_UI.sections.courier.icon), TG_UI.sections.courier.label),
    tgSectionTitle(tgEmoji('finance', TG_UI.sections.finance.icon), TG_UI.sections.finance.label),
    tgSectionTitle(tgEmoji('inventory', TG_UI.sections.inventory.icon), TG_UI.sections.inventory.label),
    tgSectionTitle(tgEmoji('admin', TG_UI.sections.admin.icon), TG_UI.sections.admin.label),
    tgSectionTitle(tgEmoji('ai', TG_UI.sections.ai.icon), TG_UI.sections.ai.label),
  ].join('\n')
}

export function aiPromptForAction(action: string): string | null {
  if (action === TG_CALLBACK.AI_PROMPT_SALES) return TG_UI.aiPrompts.salesToday
  if (action === TG_CALLBACK.AI_PROMPT_RISK) return TG_UI.aiPrompts.codRisk
  if (action === TG_CALLBACK.AI_PROMPT_STOCK) return TG_UI.aiPrompts.stockRisk
  return null
}

export function aiPromptLabel(action: string): string {
  if (action === TG_CALLBACK.AI_PROMPT_SALES) return 'AI Sales Brief'
  if (action === TG_CALLBACK.AI_PROMPT_RISK) return 'AI COD Risk Brief'
  if (action === TG_CALLBACK.AI_PROMPT_STOCK) return 'AI Stock Risk Brief'
  return 'AI Prompt'
}

export function deliveryDiagnosticsKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'API Health', callback_data: TG_CALLBACK.API_HEALTH },
        { text: 'Linked Admins', callback_data: TG_CALLBACK.LINKED_ADMINS },
      ],
      [{ text: 'Back to Admin', callback_data: TG_CALLBACK.MENU_ADMIN }],
    ],
  }
}

export function linkedAdminsKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Link Chat', callback_data: TG_CALLBACK.LINK_GROUP },
        { text: 'Chat Info', callback_data: TG_CALLBACK.GROUP_INFO },
      ],
      [{ text: 'Back to Admin', callback_data: TG_CALLBACK.MENU_ADMIN }],
    ],
  }
}

export function formatWhatsAppUrl(phone?: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  let normalized = digits
  if (normalized.startsWith('01') && normalized.length === 11) {
    normalized = `88${normalized}`
  } else if (normalized.startsWith('8801') && normalized.length === 13) {
    // already 8801...
  }
  return `https://wa.me/${normalized}`
}

export function orderActionKeyboard(
  invoiceNumber: string,
  links?: { adminOrderUrl?: string; storefrontUrl?: string; phone?: string | null },
): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [
    [
      { text: '✅ Confirm Order', callback_data: orderCallback('confirm', invoiceNumber) },
      { text: '🚚 Book Courier', callback_data: orderCallback('courier', invoiceNumber) },
    ],
  ]
  const second: InlineKeyboardButton[] = [
    { text: '📍 Track Order', callback_data: orderCallback('track', invoiceNumber) },
  ]
  if (links?.phone) {
    const wa = formatWhatsAppUrl(links.phone)
    if (wa) {
      second.push({ text: '💬 WhatsApp', url: wa })
    }
  }
  rows.push(second)

  const third: InlineKeyboardButton[] = []
  if (links?.adminOrderUrl) {
    third.push({ text: '🖥 Admin', url: links.adminOrderUrl })
  } else if (links?.storefrontUrl) {
    third.push({ text: '🌐 Store', url: links.storefrontUrl })
  }
  if (third.length > 0) {
    rows.push(third)
  }

  return { inline_keyboard: rows }
}

/** Always copy XXXX-XXXX so admin paste matches the on-screen field. */
export function formatLoginTokenDisplay(code: string): string {
  const raw = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (raw.length <= 4) return raw
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

export function loginCopyKeyboard(code: string): InlineKeyboardMarkup {
  const display = formatLoginTokenDisplay(code)
  return {
    inline_keyboard: [
      [
        {
          text: '📋 Copy Login Token',
          copy_text: { text: display },
        } as InlineKeyboardButton,
      ],
      [{ text: '⬅️ Menu', callback_data: TG_CALLBACK.MENU_MAIN }],
    ],
  }
}

export function welcomeMessage(opts: {
  name?: string
  isGroup: boolean
  storeLinked: boolean
}): string {
  // A Telegram display name is arbitrary user text. Interpolating it raw into
  // parse_mode: 'HTML' made Telegram reject the whole message — a real account
  // named "…<Udman>!" got no /start reply at all, so the bot looked dead.
  const greet = opts.name ? `Hi <b>${escapeTelegramHtml(opts.name)}</b>` : 'Welcome'
  const mode = opts.isGroup ? 'Store Command Center' : 'Personal Command Center'
  const linkHint = opts.storeLinked
    ? '✅ This chat is linked to SPLARO notifications.'
    : '⚠️ Chat not linked yet — tap <b>Link This Chat</b> or send /link_group (admin only).'

  return `
┌──────────────────────────┐
│  ✦ <b>${TG_UI.brandTitle}</b>  │
└──────────────────────────┘

${greet} · ${mode}

${linkHint}

━━━━━━━━━━━━━━━━━━━━

<b>Control sections</b>
${controlCenterSections()}

Type <code>SPL-1001</code> to track an order
Type anything for SPLARO AI

━━━━━━━━━━━━━━━━━━━━
<i>Ops-first control center for daily actions</i>
`.trim()
}

export function menuMessage(): string {
  return `
┌──────────────────────────┐
│  ✨ <b>SPLARO Control Panel</b>  │
└──────────────────────────┘

${controlCenterSections()}

━━━━━━━━━━━━━━━━━━━━
<b>Commands</b>
<code>/status</code> · <code>/orders</code> · <code>/order SPL-1001</code>
<code>/invoice SPL-1001</code> · <code>/confirm</code> · <code>/courier</code> · <code>/stock SKU123</code>
`.trim()
}

export const BOT_COMMANDS: BotCommand[] = [
  { command: 'start', description: 'Welcome & open menu' },
  { command: 'menu', description: 'Control panel' },
  { command: 'login', description: 'Link admin or get login token' },
  { command: 'status', description: 'API & order summary' },
  { command: 'orders', description: 'Latest orders' },
  { command: 'order', description: 'Order details by invoice' },
  { command: 'check', description: 'Check customer number & fraud score' },
  { command: 'invoice', description: 'View & share invoice' },
  { command: 'confirm', description: 'Confirm order' },
  { command: 'cancel', description: 'Cancel order' },
  { command: 'courier', description: 'Book courier' },
  { command: 'link_group', description: 'Link group for notifications' },
  { command: 'group_info', description: 'Show chat ID' },
  { command: 'help', description: 'All commands' },
]

export const BUTTON_ROUTES: Record<string, string> = {
  [TG_BTN.MENU]: TG_CALLBACK.MENU_MAIN,
  [TG_BTN.DASHBOARD]: TG_CALLBACK.STATUS_SUMMARY,
  [TG_BTN.ORDERS_TODAY]: TG_CALLBACK.ORDERS_TODAY,
  [TG_BTN.SALES_TODAY]: TG_CALLBACK.SALES_TODAY,
  [TG_BTN.PENDING]: TG_CALLBACK.PENDING,
  [TG_BTN.LOW_STOCK]: TG_CALLBACK.LOW_STOCK,
  [TG_BTN.FINANCE]: TG_CALLBACK.MENU_FINANCE,
  [TG_BTN.AI_CHAT]: TG_CALLBACK.MENU_AI,
  [TG_BTN.ADMIN_LOGIN]: TG_CALLBACK.ADMIN_LOGIN,
  [TG_BTN.API_HEALTH]: TG_CALLBACK.API_HEALTH,
  [TG_BTN.GROUP_LINK]: TG_CALLBACK.LINK_GROUP,
  [TG_BTN.GROUP_INFO]: TG_CALLBACK.GROUP_INFO,
}

export function formatTelegramAiReply(raw: string): string {
  if (!raw) return ''
  const lines = raw.split('\n')
  const formatted: string[] = []
  let tableHeaders: string[] = []
  let inTable = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').map((s) => s.trim()).filter(Boolean)
      if (!inTable) {
        tableHeaders = cells.map((c) => c.replace(/\*\*/g, ''))
        inTable = true
      } else if (trimmed.includes('---')) {
        // Skip markdown separator
      } else {
        const rowStr = cells
          .map((cell, idx) => {
            const h = tableHeaders[idx] || `Item ${idx + 1}`
            return `• <b>${h}</b>: ${cell}`
          })
          .join('\n')
        formatted.push(rowStr)
      }
    } else {
      inTable = false
      tableHeaders = []
      formatted.push(line)
    }
  }

  return formatted.join('\n')
}


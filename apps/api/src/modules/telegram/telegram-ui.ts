import type {
  BotCommand,
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  KeyboardButton,
  ReplyKeyboardMarkup,
} from 'node-telegram-bot-api'
import { escapeTelegramHtml } from './telegram.util'
import { TG_UI, tgEmoji, tgSectionTitle } from './telegram-ui-config'
import { tgCard, tgCopyButton, tgCopyValue, tgHeader, tgJoin } from './telegram-format'

/** Reply keyboard button labels — also used as route keys */
export const TG_BTN = {
  MENU: 'Control Center',
  DASHBOARD: 'Live Status',
  ORDERS_TODAY: 'Orders Today',
  SALES_TODAY: 'Sales Today',
  PENDING: 'Pending Orders',
  LOW_STOCK: 'Low Stock',
  FINANCE: 'Finance Hub',
  CUSTOMERS: 'Customers',
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
  MENU_CUSTOMERS: 'menu:customers',
  MENU_AI: 'menu:ai',
  STATUS_SUMMARY: 'act:status_summary',
  ORDERS_LIST: 'act:orders_list',
  COURIER_SNAPSHOT: 'act:courier_snapshot',
  INVENTORY_SNAPSHOT: 'act:inventory_snapshot',
  INVENTORY_LOOKUP_HELP: 'act:inventory_lookup_help',
  CUSTOMER_LOOKUP_HELP: 'act:customer_lookup_help',
  TOP_CUSTOMERS: 'act:top_customers',
  ORDER_SEARCH_HELP: 'act:order_search_help',
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
  /** Legacy — reachable only from a stale pinned keyboard, no longer shown in any menu. */
  ADMIN_LOGIN: 'act:admin_login',
  SYNC_SHEETS: 'act:sync_sheets',
  LINK_GROUP: 'act:link_group',
  GROUP_INFO: 'act:group_info',
} as const

export type TelegramListKind = 'orders' | 'pending'

export function listCallback(kind: TelegramListKind, page: number): string {
  return `list:${kind}:${page}`
}

export function parseListCallback(data: string): { kind: TelegramListKind; page: number } | null {
  const m = /^list:(orders|pending):(\d+)$/.exec(data)
  if (!m) return null
  return { kind: m[1] as TelegramListKind, page: Number(m[2] ?? '0') || 0 }
}

export const ORDER_ACTIONS = [
  'confirm',
  'courier',
  'track',
  'cancel',
  'invoice',
  'processing',
  'delivered',
  'returned',
  'open',
] as const

export type TelegramOrderAction = (typeof ORDER_ACTIONS)[number]

export function orderCallback(action: TelegramOrderAction, invoice: string): string {
  return `order:${action}:${invoice}`
}

export function parseOrderCallback(
  data: string,
): { action: TelegramOrderAction; invoice: string } | null {
  const m = new RegExp(`^order:(${ORDER_ACTIONS.join('|')}):(.+)$`).exec(data)
  if (!m) return null
  return { action: m[1] as TelegramOrderAction, invoice: m[2]! }
}

/** Status transition each inline action asks OrderStatusService for. */
export const ORDER_ACTION_STATUS: Partial<Record<TelegramOrderAction, string>> = {
  processing: 'PROCESSING',
  delivered: 'DELIVERED',
  returned: 'RETURNED',
  cancel: 'CANCELLED',
}

export function mainReplyKeyboard(): ReplyKeyboardMarkup {
  const row = (labels: string[]) => labels as unknown as KeyboardButton[]
  return {
    keyboard: [
      row([TG_BTN.MENU, TG_BTN.DASHBOARD]),
      row([TG_BTN.ORDERS_TODAY, TG_BTN.PENDING]),
      row([TG_BTN.FINANCE, TG_BTN.LOW_STOCK]),
      row([TG_BTN.CUSTOMERS, TG_BTN.AI_CHAT]),
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: 'SPL-#### · 01XXXXXXXXX · or Control Center',
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
        { text: '◐ Customer Desk', callback_data: TG_CALLBACK.MENU_CUSTOMERS },
        { text: `${TG_UI.sections.ai.icon} ${TG_UI.sections.ai.label}`, callback_data: TG_CALLBACK.MENU_AI },
      ],
      [
        { text: 'Live Status', callback_data: TG_CALLBACK.STATUS_SUMMARY },
        { text: `${TG_UI.sections.admin.icon} ${TG_UI.sections.admin.label}`, callback_data: TG_CALLBACK.MENU_ADMIN },
      ],
    ],
  }
}

export function inlineOrdersMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Today', callback_data: TG_CALLBACK.ORDERS_TODAY },
        { text: 'Pending Queue', callback_data: TG_CALLBACK.PENDING },
      ],
      [
        { text: 'Sales', callback_data: TG_CALLBACK.SALES_TODAY },
        { text: 'Latest Orders', callback_data: TG_CALLBACK.ORDERS_LIST },
      ],
      [
        { text: 'Delivered', callback_data: TG_CALLBACK.DELIVERED_TODAY },
        { text: 'Daily Report', callback_data: TG_CALLBACK.REPORT_TODAY },
      ],
      [
        { text: 'Find Order', callback_data: TG_CALLBACK.ORDER_SEARCH_HELP },
        { text: 'Courier Hub', callback_data: TG_CALLBACK.MENU_COURIER },
      ],
      [{ text: '← Main', callback_data: TG_CALLBACK.MENU_MAIN }],
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
        { text: 'Find Order', callback_data: TG_CALLBACK.ORDER_SEARCH_HELP },
      ],
      [{ text: '← Main', callback_data: TG_CALLBACK.MENU_MAIN }],
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
      [
        { text: 'Sales Today', callback_data: TG_CALLBACK.SALES_TODAY },
        { text: 'Daily Report', callback_data: TG_CALLBACK.REPORT_TODAY },
      ],
      [{ text: '← Main', callback_data: TG_CALLBACK.MENU_MAIN }],
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
        { text: 'SKU Lookup', callback_data: TG_CALLBACK.INVENTORY_LOOKUP_HELP },
        { text: 'AI Stock Brief', callback_data: TG_CALLBACK.AI_PROMPT_STOCK },
      ],
      [{ text: '← Main', callback_data: TG_CALLBACK.MENU_MAIN }],
    ],
  }
}

export function inlineCustomersMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Top Customers', callback_data: TG_CALLBACK.TOP_CUSTOMERS },
        { text: 'Phone Lookup', callback_data: TG_CALLBACK.CUSTOMER_LOOKUP_HELP },
      ],
      [
        { text: 'COD Risk Brief', callback_data: TG_CALLBACK.AI_PROMPT_RISK },
        { text: 'Find Order', callback_data: TG_CALLBACK.ORDER_SEARCH_HELP },
      ],
      [{ text: '← Main', callback_data: TG_CALLBACK.MENU_MAIN }],
    ],
  }
}

/** No login button here — login tokens arrive automatically from the admin panel. */
export function inlineAdminMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'API Health', callback_data: TG_CALLBACK.API_HEALTH },
        { text: 'Login Delivery', callback_data: TG_CALLBACK.DELIVERY_DIAGNOSTICS },
      ],
      [
        { text: 'Linked Admins', callback_data: TG_CALLBACK.LINKED_ADMINS },
        { text: 'Chat Info', callback_data: TG_CALLBACK.GROUP_INFO },
      ],
      [
        { text: 'Link This Chat', callback_data: TG_CALLBACK.LINK_GROUP },
        { text: 'Live Status', callback_data: TG_CALLBACK.STATUS_SUMMARY },
      ],
      [{ text: '← Main', callback_data: TG_CALLBACK.MENU_MAIN }],
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
      [{ text: '← Main', callback_data: TG_CALLBACK.MENU_MAIN }],
    ],
  }
}

export function orderListKeyboard(
  page: number,
  hasMore: boolean,
  kind: TelegramListKind = 'orders',
): InlineKeyboardMarkup {
  const nav: InlineKeyboardButton[] = []
  if (page > 0) nav.push({ text: '‹ Prev', callback_data: listCallback(kind, page - 1) })
  if (hasMore) nav.push({ text: 'Next ›', callback_data: listCallback(kind, page + 1) })
  return {
    inline_keyboard: [
      ...(nav.length > 0 ? [nav] : []),
      [
        { text: 'Refresh', callback_data: listCallback(kind, page) },
        { text: 'Orders Hub', callback_data: TG_CALLBACK.MENU_ORDERS },
      ],
    ],
  }
}

/** Screen title. Kept as premiumHeader for callers; no ASCII box any more. */
export function premiumHeader(title: string, subtitle?: string): string {
  return tgHeader('✦', title, subtitle)
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
      [{ text: '← Admin Desk', callback_data: TG_CALLBACK.MENU_ADMIN }],
    ],
  }
}

export function linkedAdminsKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Link This Chat', callback_data: TG_CALLBACK.LINK_GROUP },
        { text: 'Chat Info', callback_data: TG_CALLBACK.GROUP_INFO },
      ],
      [{ text: '← Admin Desk', callback_data: TG_CALLBACK.MENU_ADMIN }],
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

export interface OrderActionKeyboardLinks {
  adminOrderUrl?: string
  storefrontUrl?: string
  phone?: string | null
  address?: string | null
  status?: string | null
}

const CLOSED_STATUSES = new Set(['DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'])

/**
 * Order action row set. The first row follows the order's current status so the
 * operator sees the next real step instead of a fixed pair of buttons, and the
 * copy row puts phone + address one tap from the clipboard.
 */
export function orderActionKeyboard(
  invoiceNumber: string,
  links?: OrderActionKeyboardLinks,
): InlineKeyboardMarkup {
  const status = (links?.status ?? 'PENDING').toUpperCase()
  const rows: InlineKeyboardButton[][] = []

  if (status === 'PENDING') {
    rows.push([
      { text: '✅ Confirm', callback_data: orderCallback('confirm', invoiceNumber) },
      { text: '🚚 Book Courier', callback_data: orderCallback('courier', invoiceNumber) },
    ])
  } else if (status === 'CONFIRMED' || status === 'PROCESSING' || status === 'READY_TO_SHIP') {
    rows.push([
      { text: '🚚 Book Courier', callback_data: orderCallback('courier', invoiceNumber) },
      { text: '🎉 Delivered', callback_data: orderCallback('delivered', invoiceNumber) },
    ])
  } else if (!CLOSED_STATUSES.has(status)) {
    rows.push([
      { text: '📍 Track', callback_data: orderCallback('track', invoiceNumber) },
      { text: '🎉 Delivered', callback_data: orderCallback('delivered', invoiceNumber) },
    ])
  } else {
    rows.push([
      { text: '📍 Track', callback_data: orderCallback('track', invoiceNumber) },
      { text: '🧾 Invoice', callback_data: orderCallback('invoice', invoiceNumber) },
    ])
  }

  const copyRow: InlineKeyboardButton[] = []
  if (links?.phone?.trim()) {
    copyRow.push(tgCopyButton('📞 Copy phone', tgCopyValue(links.phone)))
  }
  if (links?.address?.trim()) {
    copyRow.push(tgCopyButton('📍 Copy address', tgCopyValue(links.address)))
  }
  if (copyRow.length > 0) rows.push(copyRow)

  const contactRow: InlineKeyboardButton[] = []
  const wa = formatWhatsAppUrl(links?.phone ?? null)
  if (wa) contactRow.push({ text: '💬 WhatsApp', url: wa })
  if (links?.adminOrderUrl) {
    contactRow.push({ text: '🖥 Admin', url: links.adminOrderUrl })
  } else if (links?.storefrontUrl) {
    contactRow.push({ text: '🌐 Store', url: links.storefrontUrl })
  }
  if (contactRow.length > 0) rows.push(contactRow)

  const tailRow: InlineKeyboardButton[] = [
    tgCopyButton('🧾 Copy invoice', tgCopyValue(invoiceNumber)),
  ]
  if (!CLOSED_STATUSES.has(status)) {
    tailRow.push({ text: '❌ Cancel', callback_data: orderCallback('cancel', invoiceNumber) })
  }
  rows.push(tailRow)

  return { inline_keyboard: rows }
}

/** Copy row for a customer record — phone first, address second. */
export function customerCopyKeyboard(opts: {
  phone?: string | null
  address?: string | null
  invoice?: string | null
}): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = []
  const copyRow: InlineKeyboardButton[] = []
  if (opts.phone?.trim()) copyRow.push(tgCopyButton('📞 Copy phone', tgCopyValue(opts.phone)))
  if (opts.address?.trim()) copyRow.push(tgCopyButton('📍 Copy address', tgCopyValue(opts.address)))
  if (copyRow.length > 0) rows.push(copyRow)

  const actionRow: InlineKeyboardButton[] = []
  const wa = formatWhatsAppUrl(opts.phone ?? null)
  if (wa) actionRow.push({ text: '💬 WhatsApp', url: wa })
  if (opts.invoice?.trim()) {
    actionRow.push({ text: '📦 Open order', callback_data: orderCallback('open', opts.invoice.trim()) })
  }
  if (actionRow.length > 0) rows.push(actionRow)

  rows.push([{ text: '← Customer Desk', callback_data: TG_CALLBACK.MENU_CUSTOMERS }])
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
      [tgCopyButton('📋 Copy Login Token', display)],
      [{ text: '← Control Center', callback_data: TG_CALLBACK.MENU_MAIN }],
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

  return tgJoin(
    `✦ <b>${escapeTelegramHtml(TG_UI.brandTitle)}</b>\n${greet} · ${escapeTelegramHtml(mode)}`,
    linkHint,
    `<b>Desks</b>\n${tgCard([controlCenterSections()])}`,
    `Send <code>SPL-1001</code> to open an order · <code>01XXXXXXXXX</code> to check a customer\nTap <b>AI Chat</b> to ask SPLARO AI`,
  )
}

export function menuMessage(): string {
  return tgJoin(
    tgHeader('✦', 'SPLARO Control Panel', 'Every desk from one place'),
    `<b>Desks</b>\n${tgCard([controlCenterSections()])}`,
    `<b>Commands</b>\n${tgCard([
      '<code>/status</code> — live status',
      '<code>/orders</code> — latest orders',
      '<code>/order SPL-1001</code> — order card',
      '<code>/find 01712345678</code> — customer + orders',
      '<code>/invoice SPL-1001</code> — invoice link',
      '<code>/confirm</code> · <code>/courier</code> · <code>/cancel</code> — order actions',
      '<code>/stock SKU123</code> — stock lookup',
    ])}`,
  )
}

export const BOT_COMMANDS: BotCommand[] = [
  { command: 'start', description: 'Welcome & open menu' },
  { command: 'menu', description: 'Control panel' },
  { command: 'status', description: 'API & order summary' },
  { command: 'orders', description: 'Latest orders' },
  { command: 'order', description: 'Order details by invoice' },
  { command: 'find', description: 'Find customer & orders by phone' },
  { command: 'check', description: 'Check customer number & fraud score' },
  { command: 'invoice', description: 'View & share invoice' },
  { command: 'confirm', description: 'Confirm order' },
  { command: 'cancel', description: 'Cancel order' },
  { command: 'courier', description: 'Book courier' },
  { command: 'stock', description: 'Stock by SKU' },
  { command: 'login', description: 'Link this Telegram to an admin account' },
  { command: 'link_group', description: 'Link group for notifications' },
  { command: 'group_info', description: 'Show chat ID' },
  { command: 'help', description: 'All commands' },
]

export const BUTTON_ROUTES: Record<string, string> = {
  [TG_BTN.MENU]: TG_CALLBACK.MENU_MAIN,
  Menu: TG_CALLBACK.MENU_MAIN,
  [TG_BTN.BACK]: TG_CALLBACK.MENU_MAIN,
  [TG_BTN.DASHBOARD]: TG_CALLBACK.STATUS_SUMMARY,
  Dashboard: TG_CALLBACK.STATUS_SUMMARY,
  [TG_BTN.ORDERS_TODAY]: TG_CALLBACK.ORDERS_TODAY,
  [TG_BTN.SALES_TODAY]: TG_CALLBACK.SALES_TODAY,
  [TG_BTN.PENDING]: TG_CALLBACK.PENDING,
  Pending: TG_CALLBACK.PENDING,
  [TG_BTN.LOW_STOCK]: TG_CALLBACK.LOW_STOCK,
  [TG_BTN.FINANCE]: TG_CALLBACK.MENU_FINANCE,
  Finance: TG_CALLBACK.MENU_FINANCE,
  [TG_BTN.CUSTOMERS]: TG_CALLBACK.MENU_CUSTOMERS,
  [TG_BTN.AI_CHAT]: TG_CALLBACK.MENU_AI,
  // Legacy label from keyboards pinned before login moved to the admin panel.
  [TG_BTN.ADMIN_LOGIN]: TG_CALLBACK.ADMIN_LOGIN,
  [TG_BTN.API_HEALTH]: TG_CALLBACK.API_HEALTH,
  [TG_BTN.GROUP_LINK]: TG_CALLBACK.LINK_GROUP,
  [TG_BTN.GROUP_INFO]: TG_CALLBACK.GROUP_INFO,
}

const CURRENT_KEYBOARD_LABELS = new Set<string>([
  TG_BTN.MENU,
  TG_BTN.DASHBOARD,
  TG_BTN.ORDERS_TODAY,
  TG_BTN.PENDING,
  TG_BTN.FINANCE,
  TG_BTN.LOW_STOCK,
  TG_BTN.CUSTOMERS,
  TG_BTN.AI_CHAT,
])

/** Strip emoji / VS16 so a stale persistent keyboard still routes. */
export function normalizeTelegramButtonLabel(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\uFE0F\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function resolveTelegramButtonRoute(text: string): string | undefined {
  const exact = BUTTON_ROUTES[text]
  if (exact) return exact
  const normalized = normalizeTelegramButtonLabel(text)
  if (!normalized) return undefined
  if (BUTTON_ROUTES[normalized]) return BUTTON_ROUTES[normalized]
  const lower = normalized.toLowerCase()
  for (const [label, route] of Object.entries(BUTTON_ROUTES)) {
    if (label.toLowerCase() === lower) return route
  }
  return undefined
}

export function isStaleTelegramKeyboardLabel(text: string): boolean {
  return !CURRENT_KEYBOARD_LABELS.has(text)
}

export const TELEGRAM_OPS_HINT =
  'Invoice (SPL-####) বা ফোন (01XXXXXXXXX) লিখো, অথবা Control Center চাপো। AI চাইলে AI Chat।'

export function telegramOpsHint(latestInvoice?: string | null): string {
  const inv = latestInvoice?.trim()
  if (inv && /^SPL-\d+/i.test(inv)) {
    return `${inv} লিখো, অথবা ফোন নম্বর দাও (01XXXXXXXXX)। Control Center চাপলে সব ডেস্ক। AI চাইলে AI Chat।`
  }
  return TELEGRAM_OPS_HINT
}

export const TELEGRAM_AI_UNAVAILABLE =
  'AI is not configured. Use Control Center for orders, or tap AI Chat after keys are set.'

export function isTelegramAiAction(action: string): boolean {
  return action === TG_CALLBACK.MENU_AI || action.startsWith('act:ai_prompt')
}

export function shouldRouteUnmatchedTextToAi(opts: { aiMode: boolean; isGroup: boolean }): boolean {
  return opts.aiMode && !opts.isGroup
}

export function sanitizeTelegramAiError(raw: string): string {
  const t = (raw ?? '').trim()
  if (!t) return TELEGRAM_AI_UNAVAILABLE
  if (
    /invalid bearer token|authentication_error|your request was blocked/i.test(t) ||
    /^\s*[{[]/.test(t) ||
    /"type"\s*:\s*"error"/i.test(t)
  ) {
    return TELEGRAM_AI_UNAVAILABLE
  }
  return t
}

export function collectNewOrderChatIds(input: {
  configChatId?: string | null
  linkedTelegramIds?: Array<string | null | undefined>
  envAdminUserId?: string | null
}): string[] {
  const ids = new Set<string>()
  const add = (v?: string | null) => {
    const t = v?.trim()
    if (t) ids.add(t)
  }
  add(input.configChatId)
  for (const id of input.linkedTelegramIds ?? []) add(id)
  add(input.envAdminUserId)
  return [...ids]
}

/** Dual Confirm buttons (channel + DM) must not re-send invoice after the first tap. */
export function telegramConfirmInvoiceAction(
  status: string,
): 'confirm' | 'already' | 'blocked' {
  if (status === 'CANCELLED' || status === 'REFUNDED') return 'blocked'
  if (status !== 'PENDING') return 'already'
  return 'confirm'
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

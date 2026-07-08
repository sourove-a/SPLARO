import type TelegramBot from 'node-telegram-bot-api'

/** Reply keyboard button labels — also used as route keys */
export const TG_BTN = {
  MENU: '📋 Menu',
  DASHBOARD: '📊 Dashboard',
  ORDERS_TODAY: '📦 Orders Today',
  SALES_TODAY: '💰 Sales Today',
  PENDING: '⏳ Pending',
  LOW_STOCK: '⚠️ Low Stock',
  FINANCE: '💹 Finance',
  ADMIN_LOGIN: '🔐 Admin Login',
  API_HEALTH: '🩺 API Health',
  AI_CHAT: '🤖 AI Chat',
  GROUP_LINK: '🔗 Link Group',
  GROUP_INFO: 'ℹ️ Group Info',
  BACK: '◀️ Back',
} as const

export const TG_CALLBACK = {
  MENU_MAIN: 'menu:main',
  MENU_ORDERS: 'menu:orders',
  MENU_FINANCE: 'menu:finance',
  MENU_ADMIN: 'menu:admin',
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

export function orderCallback(action: 'confirm' | 'courier' | 'track', invoice: string): string {
  return `order:${action}:${invoice}`
}

export function parseOrderCallback(data: string): { action: 'confirm' | 'courier' | 'track'; invoice: string } | null {
  const m = /^order:(confirm|courier|track):(.+)$/.exec(data)
  if (!m) return null
  return { action: m[1] as 'confirm' | 'courier' | 'track', invoice: m[2]! }
}

export function mainReplyKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  const row = (labels: string[]) => labels as unknown as TelegramBot.KeyboardButton[]
  return {
    keyboard: [
      row([TG_BTN.DASHBOARD, TG_BTN.PENDING]),
      row([TG_BTN.ORDERS_TODAY, TG_BTN.SALES_TODAY]),
      row([TG_BTN.FINANCE, TG_BTN.LOW_STOCK]),
      row([TG_BTN.ADMIN_LOGIN, TG_BTN.API_HEALTH]),
      row([TG_BTN.MENU, TG_BTN.AI_CHAT]),
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: 'SPL-1001 · or ask SPLARO AI…',
  }
}

export function inlineMainMenu(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📦 Orders', callback_data: TG_CALLBACK.MENU_ORDERS },
        { text: '💹 Finance', callback_data: TG_CALLBACK.MENU_FINANCE },
      ],
      [
        { text: '🔐 Admin Login', callback_data: TG_CALLBACK.ADMIN_LOGIN },
        { text: '🩺 API Health', callback_data: TG_CALLBACK.API_HEALTH },
      ],
      [
        { text: '🔗 Link This Group', callback_data: TG_CALLBACK.LINK_GROUP },
        { text: 'ℹ️ Chat ID', callback_data: TG_CALLBACK.GROUP_INFO },
      ],
    ],
  }
}

export function inlineOrdersMenu(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📦 Today', callback_data: TG_CALLBACK.ORDERS_TODAY },
        { text: '💰 Sales', callback_data: TG_CALLBACK.SALES_TODAY },
      ],
      [
        { text: '⏳ Pending', callback_data: TG_CALLBACK.PENDING },
        { text: '✅ Delivered', callback_data: TG_CALLBACK.DELIVERED_TODAY },
      ],
      [
        { text: '⚠️ Low Stock', callback_data: TG_CALLBACK.LOW_STOCK },
        { text: '📊 Daily Report', callback_data: TG_CALLBACK.REPORT_TODAY },
      ],
      [{ text: '◀️ Main Menu', callback_data: TG_CALLBACK.MENU_MAIN }],
    ],
  }
}

export function inlineFinanceMenu(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📈 Profit Today', callback_data: TG_CALLBACK.PROFIT_TODAY },
        { text: '📅 Profit Month', callback_data: TG_CALLBACK.PROFIT_MONTH },
      ],
      [
        { text: '💸 Expenses', callback_data: TG_CALLBACK.EXPENSES_TODAY },
        { text: '📊 Sync Sheets', callback_data: TG_CALLBACK.SYNC_SHEETS },
      ],
      [{ text: '◀️ Main Menu', callback_data: TG_CALLBACK.MENU_MAIN }],
    ],
  }
}

export function orderActionKeyboard(invoiceNumber: string): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ Confirm', callback_data: orderCallback('confirm', invoiceNumber) },
        { text: '🚚 Book Courier', callback_data: orderCallback('courier', invoiceNumber) },
      ],
      [{ text: '📦 Track Order', callback_data: orderCallback('track', invoiceNumber) }],
    ],
  }
}

export function loginCopyKeyboard(code: string): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: '📋 Copy Token',
          copy_text: { text: code },
        } as TelegramBot.InlineKeyboardButton,
      ],
      [{ text: '◀️ Menu', callback_data: TG_CALLBACK.MENU_MAIN }],
    ],
  }
}

export function welcomeMessage(opts: {
  name?: string
  isGroup: boolean
  storeLinked: boolean
}): string {
  const greet = opts.name ? `Hi <b>${opts.name}</b>` : 'Welcome'
  const mode = opts.isGroup ? 'Group Command Center' : 'Personal Command Center'
  const linkHint = opts.storeLinked
    ? '✅ This chat is linked to SPLARO store notifications.'
    : '⚠️ Chat not linked yet — tap <b>Link This Group</b> or send /link_group (admin only).'

  return `
✨ <b>SPLARO Commerce OS</b>
${greet} · ${mode}

${linkHint}

<b>Quick access</b>
• Menu buttons below
• Send <code>SPL-1001</code> to track an order
• Type any question for SPLARO AI

<i>ERP · OMS · Finance · Courier · AI Agent</i>
`.trim()
}

export function menuMessage(): string {
  return `
📋 <b>SPLARO Control Panel</b>

Use the buttons below or the keyboard at the bottom.

<b>Orders</b> — today, pending, courier, tracking
<b>Finance</b> — profit, expenses, sheets
<b>Admin</b> — secure login token for panel
<b>Commands</b> — /status · /orders · /order SPL-1001 · /confirm · /cancel · /courier
<b>AI</b> — type any message (authorized users)
`.trim()
}

export const BOT_COMMANDS: TelegramBot.BotCommand[] = [
  { command: 'start', description: 'Welcome & open menu' },
  { command: 'menu', description: 'Control panel' },
  { command: 'login', description: 'Link admin or get login token' },
  { command: 'status', description: 'API & order summary' },
  { command: 'orders', description: 'Latest orders' },
  { command: 'order', description: 'Order details by invoice' },
  { command: 'confirm', description: 'Confirm order' },
  { command: 'cancel', description: 'Cancel order' },
  { command: 'courier', description: 'Book courier' },
  { command: 'link_group', description: 'Link group for notifications' },
  { command: 'group_info', description: 'Show chat ID' },
  { command: 'help', description: 'All commands' },
]

export const BUTTON_ROUTES: Record<string, string> = {
  [TG_BTN.MENU]: TG_CALLBACK.MENU_MAIN,
  [TG_BTN.DASHBOARD]: TG_CALLBACK.MENU_MAIN,
  [TG_BTN.ORDERS_TODAY]: TG_CALLBACK.ORDERS_TODAY,
  [TG_BTN.SALES_TODAY]: TG_CALLBACK.SALES_TODAY,
  [TG_BTN.PENDING]: TG_CALLBACK.PENDING,
  [TG_BTN.LOW_STOCK]: TG_CALLBACK.LOW_STOCK,
  [TG_BTN.FINANCE]: TG_CALLBACK.MENU_FINANCE,
  [TG_BTN.ADMIN_LOGIN]: TG_CALLBACK.ADMIN_LOGIN,
  [TG_BTN.API_HEALTH]: TG_CALLBACK.API_HEALTH,
  [TG_BTN.GROUP_LINK]: TG_CALLBACK.LINK_GROUP,
  [TG_BTN.GROUP_INFO]: TG_CALLBACK.GROUP_INFO,
}

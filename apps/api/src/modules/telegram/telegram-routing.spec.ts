import {
  BUTTON_ROUTES,
  TELEGRAM_AI_UNAVAILABLE,
  TG_BTN,
  TG_CALLBACK,
  collectNewOrderChatIds,
  isStaleTelegramKeyboardLabel,
  telegramConfirmInvoiceAction,
  resolveTelegramButtonRoute,
  sanitizeTelegramAiError,
  shouldRouteUnmatchedTextToAi,
  telegramOpsHint,
} from './telegram-ui'

describe('Telegram button aliases', () => {
  it('maps current reply-keyboard labels to ops callbacks', () => {
    expect(resolveTelegramButtonRoute(TG_BTN.DASHBOARD)).toBe(TG_CALLBACK.STATUS_SUMMARY)
    expect(resolveTelegramButtonRoute(TG_BTN.PENDING)).toBe(TG_CALLBACK.PENDING)
    expect(resolveTelegramButtonRoute(TG_BTN.MENU)).toBe(TG_CALLBACK.MENU_MAIN)
    expect(resolveTelegramButtonRoute(TG_BTN.FINANCE)).toBe(TG_CALLBACK.MENU_FINANCE)
    expect(BUTTON_ROUTES[TG_BTN.DASHBOARD]).toBe(TG_CALLBACK.STATUS_SUMMARY)
  })

  it('maps stale keyboard labels to the same ops callbacks', () => {
    expect(BUTTON_ROUTES['Dashboard']).toBe(TG_CALLBACK.STATUS_SUMMARY)
    expect(BUTTON_ROUTES['Pending']).toBe(TG_CALLBACK.PENDING)
    expect(BUTTON_ROUTES['Menu']).toBe(TG_CALLBACK.MENU_MAIN)
    expect(BUTTON_ROUTES['Finance']).toBe(TG_CALLBACK.MENU_FINANCE)
    expect(BUTTON_ROUTES['Back']).toBe(TG_CALLBACK.MENU_MAIN)
  })

  it('routes emoji leftover keyboards and does not invent SPL-1881', () => {
    expect(resolveTelegramButtonRoute('📊 Dashboard')).toBe(TG_CALLBACK.STATUS_SUMMARY)
    expect(resolveTelegramButtonRoute('⏳ Pending')).toBe(TG_CALLBACK.PENDING)
    expect(resolveTelegramButtonRoute('📉 Finance')).toBe(TG_CALLBACK.MENU_FINANCE)
    expect(resolveTelegramButtonRoute('📖 Menu')).toBe(TG_CALLBACK.MENU_MAIN)
    expect(resolveTelegramButtonRoute('📦 Orders Today')).toBe(TG_CALLBACK.ORDERS_TODAY)
    expect(resolveTelegramButtonRoute('💰 Sales Today')).toBe(TG_CALLBACK.SALES_TODAY)
    expect(resolveTelegramButtonRoute('⚠️ Low Stock')).toBe(TG_CALLBACK.LOW_STOCK)
    expect(resolveTelegramButtonRoute('🔐 Admin Login')).toBe(TG_CALLBACK.ADMIN_LOGIN)
    expect(resolveTelegramButtonRoute('🩺 API Health')).toBe(TG_CALLBACK.API_HEALTH)
    expect(resolveTelegramButtonRoute('🤖 AI Chat')).toBe(TG_CALLBACK.MENU_AI)
    expect(isStaleTelegramKeyboardLabel('📊 Dashboard')).toBe(true)
    expect(isStaleTelegramKeyboardLabel(TG_BTN.DASHBOARD)).toBe(false)
    expect(telegramOpsHint(null)).not.toMatch(/1881/)
    expect(telegramOpsHint('SPL-1007')).toContain('SPL-1007')
  })
})

describe('Telegram AI opt-in', () => {
  it('does not send unmatched text to the agent unless AI Chat is on', () => {
    expect(shouldRouteUnmatchedTextToAi({ aiMode: false, isGroup: false })).toBe(false)
    expect(shouldRouteUnmatchedTextToAi({ aiMode: true, isGroup: false })).toBe(true)
  })

  it('never routes group or channel unmatched text to AI', () => {
    expect(shouldRouteUnmatchedTextToAi({ aiMode: true, isGroup: true })).toBe(false)
    expect(shouldRouteUnmatchedTextToAi({ aiMode: false, isGroup: true })).toBe(false)
  })

  it('strips Anthropic 401/403 dumps from bot replies', () => {
    expect(sanitizeTelegramAiError('403 Your request was blocked')).toBe(TELEGRAM_AI_UNAVAILABLE)
    expect(
      sanitizeTelegramAiError(
        '{"type":"error","error":{"type":"authentication_error","message":"Invalid bearer token"}}',
      ),
    ).toBe(TELEGRAM_AI_UNAVAILABLE)
    expect(sanitizeTelegramAiError('Pending 3 orders ready to confirm')).toBe(
      'Pending 3 orders ready to confirm',
    )
  })
})

describe('New order fan-out destinations', () => {
  it('includes channel chatId, linked admin DMs, and env admin id without duplicates', () => {
    expect(
      collectNewOrderChatIds({
        configChatId: '-100123',
        linkedTelegramIds: ['555', '-100123', '  ', null],
        envAdminUserId: '555',
      }).sort(),
    ).toEqual(['-100123', '555'])
  })

  it('keeps env admin when they are not already in the linked set', () => {
    expect(
      collectNewOrderChatIds({
        configChatId: '-100123',
        linkedTelegramIds: ['555'],
        envAdminUserId: '999',
      }).sort(),
    ).toEqual(['-100123', '555', '999'])
  })
})

describe('Telegram confirm dual-button guard', () => {
  it('confirms only from PENDING and skips invoice on a second tap', () => {
    expect(telegramConfirmInvoiceAction('PENDING')).toBe('confirm')
    expect(telegramConfirmInvoiceAction('CONFIRMED')).toBe('already')
    expect(telegramConfirmInvoiceAction('PROCESSING')).toBe('already')
    expect(telegramConfirmInvoiceAction('CANCELLED')).toBe('blocked')
  })
})

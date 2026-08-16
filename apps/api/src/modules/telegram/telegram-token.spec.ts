import { TelegramService } from './telegram.service'

/**
 * The admin panel is the only place an operator can change the bot token.
 * Two defects made "paste token → save" a no-op in production:
 *   1. resolveBotToken preferred TELEGRAM_BOT_TOKEN, which production sets, so
 *      the saved token was stored and then ignored.
 *   2. Nothing verified the token, so a typo surfaced only as repeated
 *      `ETELEGRAM: 401 Unauthorized` in a log (11 of them on the live store).
 */
describe('TelegramService.verifyBotToken', () => {
  const service = Object.create(TelegramService.prototype) as TelegramService
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('rejects an empty token without calling Telegram', async () => {
    const spy = jest.fn()
    global.fetch = spy as unknown as typeof fetch
    await expect(service.verifyBotToken('   ')).resolves.toEqual({
      ok: false,
      error: 'Token is empty',
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('rejects anything that is not shaped like a bot token', async () => {
    const spy = jest.fn()
    global.fetch = spy as unknown as typeof fetch
    const result = await service.verifyBotToken('not-a-token')
    expect(result.ok).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('accepts a token Telegram confirms, returning the bot username', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true, result: { id: 8210047127, username: 'splaro_bot' } }),
    }) as unknown as typeof fetch

    await expect(
      service.verifyBotToken('8210047127:AAExampleTokenValue1234567890abcd'),
    ).resolves.toEqual({ ok: true, username: 'splaro_bot', botId: 8210047127 })
  })

  it('surfaces the reason when Telegram rejects the token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      json: async () => ({ ok: false, description: 'Unauthorized' }),
    }) as unknown as typeof fetch

    await expect(
      service.verifyBotToken('8210047127:AAWrongTokenValue1234567890abcdef'),
    ).resolves.toEqual({ ok: false, error: 'Unauthorized' })
  })

  it('does not throw when api.telegram.org is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ENOTFOUND')) as unknown as typeof fetch

    const result = await service.verifyBotToken('8210047127:AAExampleTokenValue1234567890abcd')
    expect(result).toEqual({ ok: false, error: 'ENOTFOUND' })
  })
})

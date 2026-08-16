import { welcomeMessage } from './telegram-ui'
import { escapeTelegramHtml, stripTelegramHtml } from './telegram.util'

/**
 * A Telegram display name is arbitrary user text. Telegram rejects the *entire*
 * message with 400 "can't parse entities" if a stray `<` reaches parse_mode HTML,
 * which is how a real account named "🐊 …<Udman>!" got no /start reply at all.
 */
describe('Telegram HTML safety', () => {
  const HOSTILE = '🐊 𝕄𝕒Řˇᵏ<Udman>!'

  it('escapes a display name that would break the HTML parser', () => {
    const html = welcomeMessage({ name: HOSTILE, isGroup: false, storeLinked: true })
    expect(html).not.toContain('<Udman>')
    expect(html).toContain('&lt;Udman&gt;')
  })

  it('keeps the greeting readable after escaping', () => {
    const html = welcomeMessage({ name: HOSTILE, isGroup: false, storeLinked: true })
    expect(html).toContain('🐊')
    expect(html).toContain('Hi <b>')
  })

  it('leaves the template markup intact', () => {
    const html = welcomeMessage({ name: 'Sourove', isGroup: false, storeLinked: true })
    expect(html).toContain('<b>SPLARO Commerce OS</b>')
    expect(html).toContain('Hi <b>Sourove</b>')
  })

  it('handles a missing name without emitting "undefined"', () => {
    const html = welcomeMessage({ isGroup: true, storeLinked: false })
    expect(html).toContain('Welcome')
    expect(html).not.toContain('undefined')
  })

  describe('escapeTelegramHtml', () => {
    it('escapes the three characters Telegram treats as markup', () => {
      expect(escapeTelegramHtml('a<b>&c')).toBe('a&lt;b&gt;&amp;c')
    })

    it('is safe to run on text with no markup', () => {
      expect(escapeTelegramHtml('Pink Printed Cotton Saree')).toBe('Pink Printed Cotton Saree')
    })
  })

  describe('stripTelegramHtml (plain-text fallback)', () => {
    it('produces readable text from a formatted message', () => {
      const plain = stripTelegramHtml('✨ <b>SPLARO</b>\nHi <b>Sourove</b> · <i>ready</i>')
      expect(plain).toBe('✨ SPLARO\nHi Sourove · ready')
    })

    it('restores escaped characters so the reader sees the real name', () => {
      const html = welcomeMessage({ name: HOSTILE, isGroup: false, storeLinked: true })
      expect(stripTelegramHtml(html)).toContain('<Udman>')
    })

    it('turns <br> into a newline', () => {
      expect(stripTelegramHtml('one<br/>two')).toBe('one\ntwo')
    })
  })
})

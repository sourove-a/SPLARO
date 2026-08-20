import {
  resolveTelegramOperationalView,
  resolveTelegramTransportMode,
  webhookUrlsMatch,
} from './telegram-health.util'

const live = {
  tokenConfigured: true,
  botRunning: true,
  transportMode: 'webhook' as const,
  webhookRegistered: true,
  networkVerified: true,
  lastDeliveryStatus: 'success' as const,
  recentSuccesses: 21,
}

describe('telegram-health.util', () => {
  it('matches webhook URLs ignoring trailing slashes', () => {
    expect(
      webhookUrlsMatch('https://api.splaro.co/api/v1/telegram-webhook/', 'https://api.splaro.co/api/v1/telegram-webhook'),
    ).toBe(true)
    expect(webhookUrlsMatch('https://a.example/hook', 'https://b.example/hook')).toBe(false)
  })

  it('does not report transport disabled when a token + webhook URL exist', () => {
    expect(
      resolveTelegramTransportMode({
        botPresent: false,
        tokenConfigured: true,
        webhookUrl: 'https://api.splaro.co/api/v1/telegram-webhook',
        pollingEnabled: false,
      }),
    ).toBe('webhook')
  })

  it('shows a single Online state when webhook is registered and messages deliver', () => {
    const view = resolveTelegramOperationalView(live)
    expect(view.state).toBe('online')
    expect(view.chipLabel).toBe('ONLINE')
    expect(view.syncLabel).toBe('Online · webhook')
    expect(view.transportValue).toBe('Online')
    expect(view.transportDetail).toBe('webhook registered')
  })

  it('stays Online from deliveries even if the live probe says disabled', () => {
    const view = resolveTelegramOperationalView({
      ...live,
      botRunning: false,
      transportMode: 'disabled',
      networkVerified: false,
    })
    expect(view.state).toBe('online')
    expect(view.transportValue).toBe('Online')
    expect(view.transportDetail).not.toBe('needs verification')
  })

  it('does not say needs verification while the bot is actually working', () => {
    const view = resolveTelegramOperationalView({
      ...live,
      networkVerified: false,
      lastDeliveryStatus: 'none',
    })
    expect(view.state).toBe('online')
    expect(view.transportDetail).toBe('webhook registered')
  })
})

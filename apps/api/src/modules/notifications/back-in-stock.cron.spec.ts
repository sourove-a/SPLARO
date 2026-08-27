import { BackInStockCron } from './back-in-stock.cron'

function alert(id: string, channel: 'EMAIL' | 'SMS', contact: string) {
  return {
    id,
    channel,
    contact,
    unsubscribeToken: `tok-${id}`,
    variant: null,
    product: { id: 'prod-1', name: 'Oxford Shirt', slug: 'oxford-shirt' },
  }
}

function buildCron(ready: unknown[]) {
  const prisma = {
    store: { findMany: jest.fn().mockResolvedValue([{ id: 'store-1', name: 'SPLARO' }]) },
  }
  const stockAlerts = {
    findReady: jest.fn().mockResolvedValue(ready),
    markNotified: jest.fn().mockResolvedValue(undefined),
    variantLabelFor: jest.fn().mockReturnValue(null),
  }
  const email = { sendForStore: jest.fn().mockResolvedValue(true) }
  const sms = { send: jest.fn().mockResolvedValue({ sent: true }) }

  return {
    cron: new BackInStockCron(prisma as never, stockAlerts as never, email as never, sms as never),
    stockAlerts,
    email,
    sms,
  }
}

describe('BackInStockCron', () => {
  it('sends a transactional email and marks the alert notified', async () => {
    const { cron, stockAlerts, email } = buildCron([alert('a1', 'EMAIL', 'shopper@example.com')])
    await cron.sweep()

    expect(email.sendForStore).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-1',
        to: 'shopper@example.com',
        subject: 'Oxford Shirt is back in stock',
        // The shopper asked for this one message — it must not be gated on the
        // store's newsletter toggle.
        transactional: true,
      }),
    )
    expect(stockAlerts.markNotified).toHaveBeenCalledWith(['a1'])
  })

  it('puts the unsubscribe token in the email body', async () => {
    const { cron, email } = buildCron([alert('a1', 'EMAIL', 'shopper@example.com')])
    await cron.sweep()

    expect(email.sendForStore.mock.calls[0][0].text).toContain('tok-a1')
  })

  it('leaves an alert waiting when the send fails, rather than losing it', async () => {
    const { cron, stockAlerts, email } = buildCron([alert('a1', 'EMAIL', 'shopper@example.com')])
    email.sendForStore.mockResolvedValue(false)
    await cron.sweep()

    expect(stockAlerts.markNotified).toHaveBeenCalledWith([])
  })

  it('does not lose the batch when one send throws', async () => {
    const { cron, stockAlerts, email } = buildCron([
      alert('a1', 'EMAIL', 'bad@example.com'),
      alert('a2', 'EMAIL', 'good@example.com'),
    ])
    email.sendForStore
      .mockRejectedValueOnce(new Error('smtp down'))
      .mockResolvedValueOnce(true)

    await cron.sweep()

    expect(stockAlerts.markNotified).toHaveBeenCalledWith(['a2'])
  })

  it('routes an SMS alert through the SMS provider', async () => {
    const { cron, sms, stockAlerts } = buildCron([alert('a1', 'SMS', '01712345678')])
    await cron.sweep()

    expect(sms.send).toHaveBeenCalledWith(
      '01712345678',
      expect.stringContaining('Oxford Shirt is back in stock'),
      'store-1',
    )
    expect(stockAlerts.markNotified).toHaveBeenCalledWith(['a1'])
  })

  it('keeps an SMS alert waiting when the provider reports it unsent', async () => {
    const { cron, sms, stockAlerts } = buildCron([alert('a1', 'SMS', '01712345678')])
    sms.send.mockResolvedValue({ sent: false, error: 'no provider configured' })
    await cron.sweep()

    expect(stockAlerts.markNotified).toHaveBeenCalledWith([])
  })
})

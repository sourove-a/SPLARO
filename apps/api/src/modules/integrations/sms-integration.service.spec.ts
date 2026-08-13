import { SmsIntegrationService } from './sms-integration.service'

describe('SmsIntegrationService.isConfigured', () => {
  const service = new SmsIntegrationService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  )

  it('requires API key for BDBulkSMS', () => {
    expect(
      service.isConfigured({ apiKey: 'live-key-abc', apiUrl: 'https://bulksmsbd.net/api/smsapi' }, 'bdbulksms'),
    ).toBe(true)
    expect(service.isConfigured({ apiKey: '', apiUrl: 'https://bulksmsbd.net/api/smsapi' }, 'bdbulksms')).toBe(
      false,
    )
    expect(service.isConfigured({ apiKey: 'your-sms-api-key', apiUrl: 'https://x' }, 'bdbulksms')).toBe(false)
  })

  it('requires username + password for GreenWeb', () => {
    expect(service.isConfigured({ username: 'u', password: 'p', apiUrl: 'https://x' }, 'greenweb')).toBe(true)
    expect(service.isConfigured({ username: 'u', password: '', apiUrl: 'https://x' }, 'greenweb')).toBe(false)
  })

  it('requires both key and URL for custom gateway', () => {
    expect(service.isConfigured({ apiKey: 'k', apiUrl: 'https://sms.example.com/send' }, 'custom')).toBe(true)
    expect(service.isConfigured({ apiKey: 'k', apiUrl: '' }, 'custom')).toBe(false)
  })
})

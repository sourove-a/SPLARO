import { resolveCustomerFacingApiBase } from '@splaro/config'

/**
 * Mirrors InfrastructureIntegrationService.buildSteadfastCallbackUrl —
 * Steadfast portal must never receive localhost / loopback.
 */
function buildSteadfastCallbackUrl(): string {
  return `${resolveCustomerFacingApiBase().replace(/\/+$/, '')}/webhooks/steadfast`
}

describe('Steadfast webhook Callback Url', () => {
  const prev = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    API_URL: process.env.API_URL,
  }

  afterEach(() => {
    if (prev.NEXT_PUBLIC_API_URL === undefined) delete process.env.NEXT_PUBLIC_API_URL
    else process.env.NEXT_PUBLIC_API_URL = prev.NEXT_PUBLIC_API_URL
    if (prev.API_URL === undefined) delete process.env.API_URL
    else process.env.API_URL = prev.API_URL
  })

  it('skips localhost NEXT_PUBLIC_API_URL and uses splaro.co', () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000/api/v1'
    process.env.API_URL = 'http://127.0.0.1:4000'
    expect(buildSteadfastCallbackUrl()).toBe(
      'https://splaro.co/api/v1/webhooks/steadfast',
    )
  })

  it('keeps a real public API base when configured', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://splaro.co/api/v1'
    expect(buildSteadfastCallbackUrl()).toBe(
      'https://splaro.co/api/v1/webhooks/steadfast',
    )
  })
})

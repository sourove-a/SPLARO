import { getStorefrontProbeOrigin } from '@splaro/config'

describe('getStorefrontProbeOrigin', () => {
  it('uses IPv4 loopback in non-production even if SITE_URL is splaro.co', () => {
    expect(getStorefrontProbeOrigin('development', '3000')).toBe('http://127.0.0.1:3000')
    expect(getStorefrontProbeOrigin('test', '3005')).toBe('http://127.0.0.1:3005')
  })

  it('keeps production on the configured public site when it is not loopback', () => {
    const origin = getStorefrontProbeOrigin('production')
    expect(origin.length).toBeGreaterThan(0)
    expect(origin).not.toMatch(/\/$/)
  })
})

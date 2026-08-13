import { getStorefrontProbeOrigin } from '@splaro/config'

describe('getStorefrontProbeOrigin', () => {
  it('uses IPv4 loopback in development even if SITE_URL is production', () => {
    expect(getStorefrontProbeOrigin('development', '3000')).toBe('http://127.0.0.1:3000')
    expect(getStorefrontProbeOrigin('test', '3005')).toBe('http://127.0.0.1:3005')
  })

  it('does not rewrite production to IPv4 loopback', () => {
    expect(getStorefrontProbeOrigin('production')).not.toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })
})

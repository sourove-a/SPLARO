import { sanitizeRequestUrl } from './logging.interceptor'

describe('sanitizeRequestUrl', () => {
  it('redacts token-like query values', () => {
    expect(sanitizeRequestUrl('/api/v1/x?token=abc&ok=1')).toBe('/api/v1/x?token=[REDACTED]&ok=1')
    expect(sanitizeRequestUrl('/login?credential=eyJhbGciOi')).toBe('/login?credential=[REDACTED]')
  })

  it('leaves ordinary query strings intact', () => {
    expect(sanitizeRequestUrl('/shop?page=2&sort=new')).toBe('/shop?page=2&sort=new')
  })
})

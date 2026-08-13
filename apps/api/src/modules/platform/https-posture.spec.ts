import { httpsEnforcedPosture } from './https-posture'

describe('httpsEnforcedPosture', () => {
  it('is ok on localhost even when NODE_ENV is development', () => {
    expect(httpsEnforcedPosture('http://localhost:3000', 'development')).toEqual({
      label: 'HTTPS enforced',
      value: 'Off on localhost — expected',
      ok: true,
    })
  })

  it('is ok on loopback even if NODE_ENV is production', () => {
    expect(httpsEnforcedPosture('http://127.0.0.1:3000', 'production').ok).toBe(true)
  })

  it('is active when production site is https', () => {
    expect(httpsEnforcedPosture('https://splaro.co', 'production')).toEqual({
      label: 'HTTPS enforced',
      value: 'Active',
      ok: true,
    })
  })

  it('fails when production SITE_URL is http', () => {
    expect(httpsEnforcedPosture('http://splaro.co', 'production')).toEqual({
      label: 'HTTPS enforced',
      value: 'SITE_URL is not https',
      ok: false,
    })
  })
})

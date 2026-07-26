import {
  buildFraudFlags,
  maskDeviceId,
  summarizeUserAgent,
} from './customer-fraud-signals'

describe('customer-fraud-signals', () => {
  it('masks device ids', () => {
    expect(maskDeviceId('a1b2c3d4-e5f6-4789-a012-3456789abcde')).toBe('a1b2c3d4…bcde')
    expect(maskDeviceId(null)).toBeNull()
  })

  it('summarizes user agents', () => {
    expect(summarizeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Safari')).toContain(
      'Mobile',
    )
    expect(summarizeUserAgent('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36')).toContain('Desktop')
    expect(summarizeUserAgent(null)).toBe('Unknown device')
  })

  it('builds conservative flags only', () => {
    expect(
      buildFraudFlags({
        sameIpOrderCount: 2,
        sameDeviceOrderCount: 2,
        distinctPhonesOnDevice: 1,
        distinctPhonesOnIp: 1,
      }),
    ).toEqual([])

    expect(
      buildFraudFlags({
        sameIpOrderCount: 5,
        sameDeviceOrderCount: 5,
        distinctPhonesOnDevice: 3,
        distinctPhonesOnIp: 2,
      }),
    ).toEqual([
      'Repeated device across multiple phones',
      'High order volume from one IP',
      'High order volume from one device',
    ])
  })
})

import {
  buildFraudFlags,
  isPrivateOrLoopbackIp,
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

  it('treats private / loopback IPs as non-public', () => {
    expect(isPrivateOrLoopbackIp('127.0.0.1')).toBe(true)
    expect(isPrivateOrLoopbackIp('10.0.0.5')).toBe(true)
    expect(isPrivateOrLoopbackIp('192.168.1.10')).toBe(true)
    expect(isPrivateOrLoopbackIp('103.1.2.3')).toBe(false)
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

    // Shared IP volume without multi-phone must not flag (CGNAT / office Wi-Fi).
    expect(
      buildFraudFlags({
        sameIpOrderCount: 9,
        sameDeviceOrderCount: 2,
        distinctPhonesOnDevice: 1,
        distinctPhonesOnIp: 1,
      }),
    ).toEqual([])

    expect(
      buildFraudFlags({
        sameIpOrderCount: 9,
        sameDeviceOrderCount: 5,
        distinctPhonesOnDevice: 3,
        distinctPhonesOnIp: 2,
      }),
    ).toEqual([
      'Repeated device across multiple phones',
      'High order volume from one IP (30d)',
      'High order volume from one device (30d)',
    ])
  })
})

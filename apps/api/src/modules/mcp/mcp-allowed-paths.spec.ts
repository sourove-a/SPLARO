import { isMcpAllowedApiPath } from './mcp-allowed-paths'

describe('isMcpAllowedApiPath', () => {
  it('allows order status and variant stock patches', () => {
    expect(isMcpAllowedApiPath('admin/orders/abc/status', 'PATCH')).toBe(true)
    expect(isMcpAllowedApiPath('admin/products/p1/variants/v1', 'PATCH')).toBe(true)
  })

  it('rejects other admin surfaces', () => {
    expect(isMcpAllowedApiPath('admin/orders', 'GET')).toBe(false)
    expect(isMcpAllowedApiPath('admin/settings', 'PATCH')).toBe(false)
    expect(isMcpAllowedApiPath('admin/mcp/tokens', 'POST')).toBe(false)
    expect(isMcpAllowedApiPath('admin/security/sessions', 'DELETE')).toBe(false)
  })
})

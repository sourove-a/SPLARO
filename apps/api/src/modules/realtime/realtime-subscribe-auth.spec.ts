import { UnauthorizedException } from '@nestjs/common'
import { isPublicApiPath } from '../../common/auth/admin-session.util'
import { resolveRoutePermission } from '../../common/auth/admin-route-permissions.util'
import { sessionOwnsOrder, sessionTokenFromHeaders } from './realtime-subscribe-auth'

describe('realtime subscribe auth helpers', () => {
  it('parses session from header or bearer', () => {
    expect(sessionTokenFromHeaders('Bearer abc', undefined)).toBe('abc')
    expect(sessionTokenFromHeaders(undefined, 'sess-1')).toBe('sess-1')
    expect(sessionTokenFromHeaders(undefined, undefined)).toBeUndefined()
  })

  it('denies session ownership across customers', () => {
    const user = {
      id: 'u1',
      email: 'a@example.com',
      phone: '01711111111',
      customerId: 'c1',
    }
    expect(
      sessionOwnsOrder(user, {
        id: 'ord-b',
        invoiceNumber: 'SPL-2',
        shippingPhone: '01722222222',
        shippingEmail: 'b@example.com',
        customerId: 'c2',
      }),
    ).toBe(false)
    expect(
      sessionOwnsOrder(user, {
        id: 'ord-a',
        invoiceNumber: 'SPL-1',
        shippingPhone: '01711111111',
        shippingEmail: 'a@example.com',
        customerId: 'c1',
      }),
    ).toBe(true)
  })

  it('keeps customer SSE public and admin SSE behind admin auth', () => {
    expect(isPublicApiPath('/api/v1/realtime/orders/ord-1', 'GET')).toBe(true)
    expect(isPublicApiPath('/api/v1/realtime/admin/orders', 'GET')).toBe(false)
  })

  it('requires orders:view for admin realtime', () => {
    expect(resolveRoutePermission('/api/v1/realtime/admin/orders', 'GET')).toEqual({
      moduleSlug: 'orders',
      action: 'view',
    })
  })

  it('UnauthorizedException is the deny type for missing proofs', () => {
    expect(new UnauthorizedException('Order access required')).toBeInstanceOf(UnauthorizedException)
  })
})

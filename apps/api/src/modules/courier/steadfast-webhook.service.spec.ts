import { mapSteadfastDeliveryStatus } from './steadfast-webhook.service'

describe('mapSteadfastDeliveryStatus', () => {
  it('maps delivered variants to DELIVERED', () => {
    expect(mapSteadfastDeliveryStatus('delivered')).toBe('DELIVERED')
    expect(mapSteadfastDeliveryStatus('delivered_approval_pending')).toBe('DELIVERED')
    expect(mapSteadfastDeliveryStatus('partial_delivered')).toBe('DELIVERED')
  })

  it('maps cancelled to RETURNED', () => {
    expect(mapSteadfastDeliveryStatus('cancelled')).toBe('RETURNED')
    expect(mapSteadfastDeliveryStatus('cancelled_approval_pending')).toBe('RETURNED')
  })

  it('maps early lifecycle to BOOKED / IN_TRANSIT', () => {
    expect(mapSteadfastDeliveryStatus('in_review')).toBe('BOOKED')
    expect(mapSteadfastDeliveryStatus('pending')).toBe('BOOKED')
    expect(mapSteadfastDeliveryStatus('hold')).toBe('IN_TRANSIT')
  })

  it('returns null for unknown / empty', () => {
    expect(mapSteadfastDeliveryStatus('unknown')).toBeNull()
    expect(mapSteadfastDeliveryStatus('')).toBeNull()
    expect(mapSteadfastDeliveryStatus(undefined)).toBeNull()
  })
})

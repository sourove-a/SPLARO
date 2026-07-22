import {
  computeExpectedDeliveryChargeBdt,
  isDhakaDistrict,
  resolveOrderDistrict,
} from './delivery-charge.util'

describe('delivery-charge.util', () => {
  const settings = { dhakaDeliveryCharge: 60, outsideDhakaCharge: 120, freeDeliveryThreshold: 0 }

  it('resolves district from city when district is absent', () => {
    expect(resolveOrderDistrict({ city: 'Chittagong' })).toBe('Chittagong')
  })

  it('prefers explicit district over city', () => {
    expect(resolveOrderDistrict({ city: 'Dhaka', district: 'Chittagong' })).toBe('Chittagong')
  })

  it('charges Dhaka metro rate only for Dhaka district', () => {
    expect(isDhakaDistrict('Dhaka')).toBe(true)
    expect(isDhakaDistrict('Dhaka City')).toBe(true)
    expect(isDhakaDistrict('  dhaka  ')).toBe(true)
    expect(isDhakaDistrict('Gazipur')).toBe(false)
    expect(computeExpectedDeliveryChargeBdt('Dhaka', settings)).toBe(60)
    expect(computeExpectedDeliveryChargeBdt('Chittagong', settings)).toBe(120)
  })

  it('rejects outside-Dhaka customer paying Dhaka rate (manipulation scenario)', () => {
    const district = 'Chittagong'
    const clientDelivery = 60
    const expected = computeExpectedDeliveryChargeBdt(district, settings)
    expect(expected).toBe(120)
    expect(clientDelivery).not.toBe(expected)
  })

  it('returns zero when free shipping coupon applies', () => {
    expect(
      computeExpectedDeliveryChargeBdt('Chittagong', settings, { subtotal: 5000, freeShipping: true }),
    ).toBe(0)
  })
})

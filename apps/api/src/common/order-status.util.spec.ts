import { BadRequestException } from '@nestjs/common'
import { assertOrderStatusTransition, isOrderStatus } from './order-status.util'

describe('assertOrderStatusTransition', () => {
  it('allows PENDING → CONFIRMED', () => {
    expect(assertOrderStatusTransition('PENDING', 'CONFIRMED')).toBe('CONFIRMED')
  })

  it('rejects DELIVERED → PENDING', () => {
    expect(() => assertOrderStatusTransition('DELIVERED', 'PENDING')).toThrow(BadRequestException)
  })

  it('rejects CANCELLED → SHIPPED', () => {
    expect(() => assertOrderStatusTransition('CANCELLED', 'SHIPPED')).toThrow(BadRequestException)
  })

  it('allows same status no-op', () => {
    expect(assertOrderStatusTransition('PACKED', 'PACKED')).toBe('PACKED')
  })

  it('rejects unknown status', () => {
    expect(() => assertOrderStatusTransition('PENDING', 'NOPE')).toThrow(BadRequestException)
  })

  it('isOrderStatus detects enum members', () => {
    expect(isOrderStatus('COURIER_BOOKED')).toBe(true)
    expect(isOrderStatus('bogus')).toBe(false)
  })
})

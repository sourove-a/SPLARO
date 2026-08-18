import { isSafeRealtimeId, orderRealtimeChannel } from './realtime-channels'
import {
  phonesMatchLast10,
  sanitizeRealtimeNotificationEvent,
  sanitizeRealtimeOrderEvent,
  shouldApplyRealtimeEvent,
} from './realtime-event.util'

describe('realtime event sanitizer', () => {
  it('accepts a minimal order.status_changed payload', () => {
    const event = sanitizeRealtimeOrderEvent({
      type: 'order.status_changed',
      orderId: 'ord_1',
      status: 'PROCESSING',
      updatedAt: '2026-08-10T01:00:00.000Z',
      seq: 3,
    })
    expect(event).toEqual({
      type: 'order.status_changed',
      orderId: 'ord_1',
      status: 'PROCESSING',
      updatedAt: '2026-08-10T01:00:00.000Z',
      seq: 3,
    })
  })

  it('drops PII and unknown fields', () => {
    const event = sanitizeRealtimeOrderEvent({
      type: 'order.created',
      orderId: 'ord_2',
      invoiceNumber: 'SPL-1001',
      updatedAt: '2026-08-10T01:00:00.000Z',
      seq: 1,
      shippingPhone: '01700000000',
      email: 'a@b.com',
      address: 'secret',
      items: [{ name: 'leak' }],
    })
    expect(event).toEqual({
      type: 'order.created',
      orderId: 'ord_2',
      invoiceNumber: 'SPL-1001',
      updatedAt: '2026-08-10T01:00:00.000Z',
      seq: 1,
    })
  })

  it('rejects missing seq, unknown type, or bad dates', () => {
    expect(sanitizeRealtimeOrderEvent({ type: 'order.status_changed', orderId: 'x' })).toBeNull()
    expect(
      sanitizeRealtimeOrderEvent({
        type: 'finance.updated',
        orderId: 'x',
        updatedAt: '2026-08-10T01:00:00.000Z',
        seq: 1,
      }),
    ).toBeNull()
    expect(
      sanitizeRealtimeOrderEvent({
        type: 'order.status_changed',
        orderId: 'x',
        updatedAt: 'not-a-date',
        seq: 1,
      }),
    ).toBeNull()
  })
})

describe('sanitizeRealtimeNotificationEvent', () => {
  it('accepts a notification ping and drops extra fields', () => {
    expect(
      sanitizeRealtimeNotificationEvent({
        type: 'notification.created',
        updatedAt: '2026-08-18T18:00:00.000Z',
        subject: 'secret',
      }),
    ).toEqual({ type: 'notification.created', updatedAt: '2026-08-18T18:00:00.000Z' })
    expect(sanitizeRealtimeNotificationEvent({ type: 'order.created' })).toBeNull()
  })
})

describe('shouldApplyRealtimeEvent', () => {
  it('ignores older seq and older updatedAt', () => {
    expect(
      shouldApplyRealtimeEvent(
        { seq: 2, updatedAt: '2026-08-10T02:00:00.000Z' },
        { seq: 4, updatedAt: '2026-08-10T03:00:00.000Z' },
      ),
    ).toBe(false)
    expect(
      shouldApplyRealtimeEvent(
        { seq: 5, updatedAt: '2026-08-10T01:00:00.000Z' },
        { seq: 4, updatedAt: '2026-08-10T03:00:00.000Z' },
      ),
    ).toBe(false)
  })

  it('applies newer seq when updatedAt is not older', () => {
    expect(
      shouldApplyRealtimeEvent(
        { seq: 5, updatedAt: '2026-08-10T04:00:00.000Z' },
        { seq: 4, updatedAt: '2026-08-10T03:00:00.000Z' },
      ),
    ).toBe(true)
  })
})

describe('realtime channels + phone match', () => {
  it('rejects unsafe channel ids', () => {
    expect(isSafeRealtimeId('ord_1')).toBe(true)
    expect(isSafeRealtimeId('SPL-1001')).toBe(true)
    expect(isSafeRealtimeId('a*b')).toBe(false)
    expect(isSafeRealtimeId('a b')).toBe(false)
    expect(() => orderRealtimeChannel('../etc')).toThrow()
  })

  it('matches BD phones on last 10 digits', () => {
    expect(phonesMatchLast10('+8801712345678', '01712345678')).toBe(true)
    expect(phonesMatchLast10('01712345678', '01812345678')).toBe(false)
  })
})

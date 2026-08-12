import { BadRequestException } from '@nestjs/common'
import { CustomersService } from './customers.service'

type PhoneOwner = {
  id: string
  email: string | null
  passwordHash: string | null
  googleId: string | null
  customer: { id: string } | null
} | null

function buildService(opts: { phoneOwner?: PhoneOwner; targetHasCustomer?: boolean }) {
  let adoptedCustomerId: string | null = null

  const tx = {
    user: {
      findFirst: jest.fn().mockResolvedValue(opts.phoneOwner ?? null),
      // Reflects the adoption that ran earlier in the same transaction.
      findUnique: jest.fn().mockImplementation(async () => ({
        id: 'user-google',
        email: 'shopper@example.com',
        firstName: 'Shopper',
        lastName: 'Example',
        customer: adoptedCustomerId ? { id: adoptedCustomerId, storeId: 'store-1' } : null,
      })),
      update: jest.fn().mockResolvedValue({}),
    },
    customer: {
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.targetHasCustomer ? { id: 'customer-target' } : null),
      update: jest
        .fn()
        .mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          if (data['userId']) adoptedCustomerId = where.id
          return { id: where.id, loyaltyTier: 'BRONZE', ...data }
        }),
      create: jest.fn().mockResolvedValue({ id: 'customer-new', loyaltyTier: 'BRONZE' }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    store: { findUnique: jest.fn().mockResolvedValue({ id: 'store-1' }) },
    $queryRaw: jest.fn().mockResolvedValue([{ next: 12 }]),
  }

  const prisma = {
    ...tx,
    $transaction: jest.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(tx)),
  }

  return { service: new CustomersService(prisma as never), tx }
}

describe('CustomersService.completeGoogleSignup', () => {
  it('gives an actionable error when the phone belongs to a real account', async () => {
    const { service, tx } = buildService({
      phoneOwner: {
        id: 'user-other',
        email: 'other@example.com',
        passwordHash: 'salt:hash',
        googleId: null,
        customer: { id: 'customer-other' },
      },
    })

    await expect(
      service.completeGoogleSignup('store-1', 'user-google', {
        phone: '01712345678',
        phoneVerified: true,
      }),
    ).rejects.toThrow(/already registered.*different number/i)
    expect(tx.customer.update).not.toHaveBeenCalled()
  })

  it('points at the store, not a sign-in page, when the record has no way in', async () => {
    const { service } = buildService({
      phoneOwner: {
        id: 'user-record-only',
        email: null,
        passwordHash: null,
        googleId: null,
        customer: { id: 'customer-record-only' },
      },
    })

    await expect(
      service.completeGoogleSignup('store-1', 'user-google', {
        phone: '01712345678',
        phoneVerified: false,
      }),
    ).rejects.toMatchObject({
      response: { code: 'phone_taken_no_recovery' },
    })
  })

  it('offers sign-in when the phone is on an account with an email to reset', async () => {
    const { service } = buildService({
      phoneOwner: {
        id: 'user-other',
        email: 'other@example.com',
        passwordHash: null,
        googleId: null,
        customer: { id: 'customer-other' },
      },
    })

    await expect(
      service.completeGoogleSignup('store-1', 'user-google', {
        phone: '01712345678',
        phoneVerified: false,
      }),
    ).rejects.toMatchObject({
      response: { code: 'phone_taken' },
    })
  })

  it('refuses to adopt a guest account when the phone was not OTP-verified', async () => {
    const { service } = buildService({
      phoneOwner: {
        id: 'user-guest',
        email: null,
        passwordHash: null,
        googleId: null,
        customer: { id: 'customer-guest' },
      },
    })

    await expect(
      service.completeGoogleSignup('store-1', 'user-google', {
        phone: '01712345678',
        phoneVerified: false,
      }),
    ).rejects.toMatchObject({
      response: { code: 'phone_taken_no_recovery' },
    })
  })

  it('adopts a guest-checkout account once the phone is OTP-verified', async () => {
    const { service, tx } = buildService({
      phoneOwner: {
        id: 'user-guest',
        email: null,
        passwordHash: null,
        googleId: null,
        customer: { id: 'customer-guest' },
      },
    })

    await service.completeGoogleSignup('store-1', 'user-google', {
      phone: '01712345678',
      phoneVerified: true,
    })

    // Guest row retired so its unique phone is free for the real account.
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-guest' },
      data: { phone: null, isActive: false },
    })
    // Order history follows the Customer row onto the signed-in user.
    expect(tx.customer.update).toHaveBeenCalledWith({
      where: { id: 'customer-guest' },
      data: { userId: 'user-google' },
    })
  })

  it('will not adopt when both sides already have order history', async () => {
    const { service } = buildService({
      phoneOwner: {
        id: 'user-guest',
        email: null,
        passwordHash: null,
        googleId: null,
        customer: { id: 'customer-guest' },
      },
      targetHasCustomer: true,
    })

    await expect(
      service.completeGoogleSignup('store-1', 'user-google', {
        phone: '01712345678',
        phoneVerified: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})

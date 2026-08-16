import { UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'

/**
 * Google proves identity; the admin table decides access. These pin the rule
 * that adding a second sign-in door never widens who may walk through it.
 */
describe('AuthService.loginWithGoogle', () => {
  const buildService = (user: unknown) => {
    // Private members are stubbed through an index signature — the test drives
    // loginWithGoogle's decision logic, not the lockout/audit plumbing.
    const service = Object.create(AuthService.prototype) as AuthService
    const internals = service as unknown as Record<string, unknown>
    internals.prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue({}),
      },
      staffRole: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ permissions: ['*'], role: 'SUPER_ADMIN' }),
      },
      store: { findFirst: jest.fn().mockResolvedValue({ id: 'store-1' }) },
    }
    internals.assertIpNotLockedOut = jest.fn().mockResolvedValue(undefined)
    internals.assertNotLockedOut = jest.fn().mockResolvedValue(undefined)
    internals.recordIpFailedAttempt = jest.fn().mockResolvedValue(undefined)
    internals.recordLoginAttempt = jest.fn().mockResolvedValue(undefined)
    return service
  }

  const profile = {
    email: 'splaro.bd@gmail.com',
    emailVerified: true,
    firstName: 'Sourove',
    lastName: 'Ahammed',
  }

  it('rejects a Google account whose email is not verified', async () => {
    const service = buildService({ id: 'u1', email: profile.email, role: 'SUPER_ADMIN' })
    await expect(
      service.loginWithGoogle({ ...profile, emailVerified: false }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rejects an email that has no user record', async () => {
    const service = buildService(null)
    await expect(service.loginWithGoogle(profile)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rejects a real customer account — customers are not admins', async () => {
    const service = buildService({
      id: 'u2',
      email: 'shopper@example.com',
      firstName: 'Shopper',
      lastName: '',
      role: 'CUSTOMER',
    })
    await expect(
      service.loginWithGoogle({ ...profile, email: 'shopper@example.com' }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('gives the same message for unknown and non-admin, so admins cannot be enumerated', async () => {
    const unknown = await buildService(null)
      .loginWithGoogle(profile)
      .catch((e: Error) => e.message)
    const customer = await buildService({
      id: 'u3',
      email: profile.email,
      firstName: 'X',
      lastName: '',
      role: 'CUSTOMER',
    })
      .loginWithGoogle(profile)
      .catch((e: Error) => e.message)

    expect(unknown).toBe(customer)
  })

  it('signs in an active admin and returns the session payload', async () => {
    const service = buildService({
      id: 'u4',
      email: profile.email,
      firstName: 'Sourove',
      lastName: 'Ahammed',
      role: 'SUPER_ADMIN',
    })

    const result = await service.loginWithGoogle(profile)
    expect(result).toMatchObject({
      userId: 'u4',
      email: profile.email,
      role: 'SUPER_ADMIN',
      storeId: 'store-1',
    })
    expect(result.name).toBe('Sourove Ahammed')
  })

  it('only queries active users, so a deactivated admin cannot sign in', async () => {
    const service = buildService({
      id: 'u5',
      email: profile.email,
      firstName: 'A',
      lastName: '',
      role: 'MANAGER',
    })
    await service.loginWithGoogle(profile)

    const findFirst = (service as unknown as { prisma: { user: { findFirst: jest.Mock } } }).prisma
      .user.findFirst
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    )
  })
})

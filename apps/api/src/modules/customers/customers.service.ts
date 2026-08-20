import { BadRequestException, ConflictException, Injectable, OnModuleInit } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { bdPhoneLookupVariants, isValidBdMobile, normalizeBdPhone } from '../../common/bd-phone.util'
import { backfillCustomerCodes, createCustomerWithCode } from '../../common/customer-code.util'
import { PrismaService } from '../../common/prisma.service'

export interface RegisterCustomerInput {
  name: string
  email: string
  phone: string
  passwordHash?: string
  source?: string
  /** Website signup must fail on duplicate email/phone instead of overwriting. */
  rejectIfExists?: boolean
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] ?? 'Customer'
  const lastName = parts.slice(1).join(' ') || firstName
  return { firstName, lastName }
}

export const STAFF_CUSTOMER_TAG = 'staff'
export const GUEST_CUSTOMER_TAG = 'guest'

function isStaffUserRole(role: string | null | undefined) {
  return Boolean(role && role !== 'CUSTOMER')
}

/** The number is on an account the shopper can still get into (sign in / email reset). */
export const PHONE_TAKEN_CODE = 'phone_taken'
/**
 * The number is on a record with no way in — no password, no Google, no email to
 * send a reset to (typically a customer an admin added by phone alone). Offering
 * "sign in" there sends the shopper to a door that cannot open, so say so plainly
 * and let the store fix the record.
 */
export const PHONE_TAKEN_NO_RECOVERY_CODE = 'phone_taken_no_recovery'

function phoneTakenError(owner?: {
  email?: string | null
  passwordHash?: string | null
  googleId?: string | null
}) {
  const canRecover =
    !owner || Boolean(owner.email) || Boolean(owner.passwordHash) || Boolean(owner.googleId)

  return new BadRequestException(
    canRecover
      ? {
          statusCode: 400,
          code: PHONE_TAKEN_CODE,
          message:
            'This phone number is already registered. Sign in to that account, or use a different number.',
        }
      : {
          statusCode: 400,
          code: PHONE_TAKEN_NO_RECOVERY_CODE,
          message:
            'This number is already on a customer record from an earlier order. Contact us to link it to your account, or continue with a different number.',
        },
  )
}

function accountExistsMessage(user: {
  googleId?: string | null
  authProvider?: string | null
  passwordHash?: string | null
}) {
  const viaGoogle = Boolean(user.googleId) || user.authProvider === 'google'
  return viaGoogle && !user.passwordHash
    ? 'An account with this email already exists. Sign in with Google.'
    : 'An account with this email or phone already exists. Please sign in.'
}

@Injectable()
export class CustomersService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    void this.backfillLegacyCustomerCodes()
  }

  private async backfillLegacyCustomerCodes() {
    try {
      const stores = await this.prisma.store.findMany({ select: { id: true } })
      for (const { id } of stores) {
        for (let batch = 0; batch < 40; batch++) {
          const fixed = await backfillCustomerCodes(this.prisma, id, 100)
          if (fixed === 0) break
        }
      }
    } catch {
      // DB offline in partial dev shells — skip.
    }
  }

  /**
   * Persist storefront signup as User + Customer in one transaction.
   * Website path rejects duplicates; internal events may upsert safely.
   */
  async registerFromSignup(storeId: string, input: RegisterCustomerInput) {
    const email = normalizeEmail(input.email)
    const phone = normalizeBdPhone(input.phone)
    const { firstName, lastName } = splitName(input.name)

    if (!email || !phone) {
      throw new BadRequestException('Valid email and phone are required')
    }
    if (!isValidBdMobile(phone)) {
      throw new BadRequestException('Enter a valid Bangladesh mobile number (01XXXXXXXXX)')
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findFirst({
          where: { OR: [{ email }, { phone: { in: bdPhoneLookupVariants(phone) } }] },
        })

        if (existingUser && input.rejectIfExists) {
          throw new ConflictException(accountExistsMessage(existingUser))
        }

        let userId: string

        if (!existingUser) {
          if (!input.passwordHash?.trim()) {
            throw new BadRequestException('passwordHash required for new customer')
          }
          const created = await tx.user.create({
            data: {
              email,
              phone,
              passwordHash: input.passwordHash,
              firstName,
              lastName,
              role: 'CUSTOMER',
              isActive: true,
              authProvider: 'password',
            },
            select: { id: true },
          })
          userId = created.id
        } else {
          const updated = await tx.user.update({
            where: { id: existingUser.id },
            data: {
              email: existingUser.email ?? email,
              phone: existingUser.phone ? normalizeBdPhone(existingUser.phone) || phone : phone,
              firstName,
              lastName,
              // Never overwrite an existing password — blocks signup-based account takeover.
              ...(input.passwordHash?.trim() && !existingUser.passwordHash
                ? { passwordHash: input.passwordHash }
                : {}),
            },
            select: { id: true },
          })
          userId = updated.id
        }

        const existingCustomer = await tx.customer.findUnique({
          where: { userId },
          select: { id: true, customerCode: true },
        })

        if (existingCustomer) {
          return tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              storeId,
              firstName,
              lastName,
              email,
              phone,
            },
          })
        }

        const sourceTag = input.source?.trim()
        return createCustomerWithCode(tx, {
          userId,
          storeId,
          firstName,
          lastName,
          email,
          phone,
          ...(sourceTag ? { tags: [sourceTag] } : {}),
        })
      })
    } catch (err) {
      if (err instanceof ConflictException || err instanceof BadRequestException) throw err
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          'An account with this email or phone already exists. Please sign in.',
        )
      }
      throw err
    }
  }

  /** Finish Google signup — attach BD phone and create Customer row atomically. */
  async completeGoogleSignup(
    storeId: string,
    userId: string,
    input: { phone: string; phoneVerified: boolean },
  ) {
    const phone = normalizeBdPhone(input.phone)
    if (!isValidBdMobile(phone)) {
      throw new BadRequestException('Enter a valid Bangladesh mobile number (01XXXXXXXXX)')
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const phoneOwner = await tx.user.findFirst({
          where: { phone: { in: bdPhoneLookupVariants(phone) }, NOT: { id: userId } },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            googleId: true,
            customer: { select: { id: true } },
          },
        })
        if (phoneOwner) {
          // A guest-checkout account (phone only, no way to sign in) may be adopted,
          // but only when this signup proved ownership of the number by OTP.
          const isGuestOnly =
            !phoneOwner.passwordHash && !phoneOwner.googleId && !phoneOwner.email
          if (!input.phoneVerified || !isGuestOnly) {
            throw phoneTakenError(phoneOwner)
          }
          await this.adoptGuestAccount(tx, {
            guestUserId: phoneOwner.id,
            guestCustomerId: phoneOwner.customer?.id ?? null,
            targetUserId: userId,
          })
        }

        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            customer: { select: { id: true, storeId: true } },
          },
        })
        if (!user) throw new BadRequestException('Account not found')

        await tx.user.update({
          where: { id: userId },
          data: {
            phone,
            phoneVerified: input.phoneVerified,
          },
        })

        const email = user.email ? normalizeEmail(user.email) : null
        const existing = user.customer

        if (existing) {
          const customer = await tx.customer.update({
            where: { id: existing.id },
            data: {
              storeId,
              firstName: user.firstName,
              lastName: user.lastName,
              ...(email ? { email } : {}),
              phone,
            },
          })
          return { customer, created: false as const }
        }

        const customer = await createCustomerWithCode(tx, {
          userId: user.id,
          storeId,
          firstName: user.firstName,
          lastName: user.lastName,
          ...(email ? { email } : {}),
          phone,
          tags: ['Google signup'],
        })
        return { customer, created: true as const }
      })
    } catch (err) {
      if (err instanceof BadRequestException) throw err
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Race: another request claimed the phone. We don't have the owner row here —
        // offer sign-in rather than "contact store" so a real account isn't dead-ended.
        throw phoneTakenError()
      }
      throw err
    }
  }

  /**
   * Move a guest-checkout account's Customer row (orders, addresses, loyalty) onto a
   * real account and retire the guest User so its unique phone is free to re-use.
   * Caller must have proven phone ownership first.
   */
  private async adoptGuestAccount(
    tx: Prisma.TransactionClient,
    input: { guestUserId: string; guestCustomerId: string | null; targetUserId: string },
  ) {
    const targetCustomer = await tx.customer.findUnique({
      where: { userId: input.targetUserId },
      select: { id: true },
    })
    if (targetCustomer) {
      // Both sides already have order history — merging those is an admin decision.
      // The other side is guest-only, so there is no account to send them to.
      throw phoneTakenError({})
    }

    await tx.user.update({
      where: { id: input.guestUserId },
      data: { phone: null, isActive: false },
    })

    if (input.guestCustomerId) {
      await tx.customer.update({
        where: { id: input.guestCustomerId },
        data: { userId: input.targetUserId },
      })
    }
  }

  /** Admin panel — create a customer without storefront signup (phone-only account). */
  async createFromAdmin(
    storeId: string,
    input: { firstName: string; lastName?: string; phone: string; email?: string },
  ) {
    const phone = normalizeBdPhone(input.phone)
    const firstName = input.firstName.trim()
    const lastName = (input.lastName ?? '').trim() || firstName
    const email = input.email?.trim() ? normalizeEmail(input.email) : null

    if (!firstName) throw new BadRequestException('First name is required')
    if (!isValidBdMobile(phone)) {
      throw new BadRequestException('Enter a valid Bangladesh mobile number (01XXXXXXXXX)')
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findFirst({
          where: {
            OR: [
              { phone: { in: bdPhoneLookupVariants(phone) } },
              ...(email ? [{ email }] : []),
            ],
          },
          select: { id: true, customer: { select: { id: true, storeId: true } } },
        })

        if (existingUser?.customer) {
          if (existingUser.customer.storeId === storeId) {
            throw new ConflictException('A customer with this phone or email already exists.')
          }
          return tx.customer.update({
            where: { id: existingUser.customer.id },
            data: { storeId, firstName, lastName, email, phone },
          })
        }
        if (existingUser) {
          throw new ConflictException('A user with this phone or email exists but has no customer profile.')
        }

        const user = await tx.user.create({
          data: {
            phone,
            email,
            firstName,
            lastName,
            role: 'CUSTOMER',
            isActive: true,
            authProvider: 'password',
          },
          select: { id: true },
        })

        return createCustomerWithCode(tx, {
          userId: user.id,
          storeId,
          firstName,
          lastName,
          email,
          phone,
          tags: ['admin-created'],
        })
      })
    } catch (err) {
      if (err instanceof ConflictException || err instanceof BadRequestException) throw err
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A customer with this phone or email already exists.')
      }
      throw err
    }
  }

  /**
   * Guest / POS checkout: reuse the customer with this phone, or create a profile
   * from the shipping details so the order shows up in CRM.
   */
  async ensureFromCheckout(
    storeId: string,
    input: {
      name: string
      phone: string
      email?: string | null
      address?: string | null
      city?: string | null
      district?: string | null
      division?: string | null
    },
  ) {
    const phone = normalizeBdPhone(input.phone)
    if (!isValidBdMobile(phone)) {
      throw new BadRequestException('Enter a valid Bangladesh mobile number (01XXXXXXXXX)')
    }
    const { firstName, lastName } = splitName(input.name || 'Customer')
    const emailRaw = input.email?.trim() ? normalizeEmail(input.email) : null
    const variants = bdPhoneLookupVariants(phone)

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingCustomer = await tx.customer.findFirst({
          where: { storeId, phone: { in: variants } },
          include: { user: { select: { role: true } }, addresses: { select: { id: true }, take: 1 } },
        })
        if (existingCustomer) {
          await this.attachOrphanOrders(tx, storeId, existingCustomer.id, variants)
          await this.maybeAddCheckoutAddress(tx, existingCustomer.id, existingCustomer.addresses.length > 0, {
            firstName: existingCustomer.firstName,
            lastName: existingCustomer.lastName,
            phone,
            address: input.address,
            city: input.city,
            district: input.district,
            division: input.division,
          })
          return existingCustomer
        }

        const userByPhone = await tx.user.findFirst({
          where: { phone: { in: variants } },
          include: { customer: true, staffRoles: { select: { id: true }, take: 1 } },
        })

        let userId: string
        let staff = false
        if (userByPhone) {
          userId = userByPhone.id
          staff = isStaffUserRole(userByPhone.role) || userByPhone.staffRoles.length > 0
          if (userByPhone.customer) {
            if (userByPhone.customer.storeId !== storeId) {
              await tx.customer.update({
                where: { id: userByPhone.customer.id },
                data: { storeId, phone, ...(emailRaw && !userByPhone.customer.email ? { email: emailRaw } : {}) },
              })
            }
            await this.attachOrphanOrders(tx, storeId, userByPhone.customer.id, variants)
            return tx.customer.findUniqueOrThrow({ where: { id: userByPhone.customer.id } })
          }
        } else {
          const emailTaken = emailRaw
            ? await tx.user.findFirst({ where: { email: emailRaw }, select: { id: true } })
            : null
          const created = await tx.user.create({
            data: {
              phone,
              ...(emailRaw && !emailTaken ? { email: emailRaw } : {}),
              firstName,
              lastName,
              role: 'CUSTOMER',
              isActive: true,
              authProvider: 'guest',
            },
            select: { id: true },
          })
          userId = created.id
        }

        const tags = staff ? [STAFF_CUSTOMER_TAG] : [GUEST_CUSTOMER_TAG]
        const customer = await createCustomerWithCode(tx, {
          userId,
          storeId,
          firstName,
          lastName,
          email: emailRaw,
          phone,
          tags,
        })
        await this.maybeAddCheckoutAddress(tx, customer.id, false, {
          firstName,
          lastName,
          phone,
          address: input.address,
          city: input.city,
          district: input.district,
          division: input.division,
        })
        await this.attachOrphanOrders(tx, storeId, customer.id, variants)
        return customer
      })
    } catch (err) {
      if (err instanceof BadRequestException) throw err
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await this.prisma.customer.findFirst({
          where: { storeId, phone: { in: variants } },
        })
        if (again) return again
      }
      throw err
    }
  }

  async backfillOrphanGuestOrders(storeId: string, limit = 40) {
    const orphans = await this.prisma.order.findMany({
      where: { storeId, customerId: null, shippingPhone: { not: '' } },
      select: {
        shippingPhone: true,
        shippingName: true,
        shippingEmail: true,
        shippingAddress: true,
        shippingCity: true,
        shippingDistrict: true,
        shippingDivision: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(limit * 3, 40),
    })
    const seen = new Set<string>()
    const unique: typeof orphans = []
    for (const row of orphans) {
      const key = normalizeBdPhone(row.shippingPhone)
      if (!key || seen.has(key)) continue
      seen.add(key)
      unique.push(row)
      if (unique.length >= limit) break
    }
    let linked = 0
    for (const row of unique) {
      try {
        if (!isValidBdMobile(row.shippingPhone)) continue
        const customer = await this.ensureFromCheckout(storeId, {
          name: row.shippingName,
          phone: row.shippingPhone,
          email: row.shippingEmail,
          address: row.shippingAddress,
          city: row.shippingCity,
          district: row.shippingDistrict,
          division: row.shippingDivision,
        })
        await this.refreshSpendStats(this.prisma, customer.id)
        linked += 1
      } catch {
        /* skip a bad orphan — list still loads */
      }
    }
    return linked
  }

  async mergeCustomers(storeId: string, keepId: string, mergeIds: string[]) {
    const absorbIds = [...new Set(mergeIds.filter((id) => id && id !== keepId))]
    if (!absorbIds.length) throw new BadRequestException('Select at least one duplicate to merge into the kept profile.')
    if (absorbIds.length > 20) throw new BadRequestException('Merge at most 20 duplicates at a time.')

    const keep = await this.prisma.customer.findFirst({
      where: { id: keepId, storeId },
      select: { id: true, userId: true },
    })
    if (!keep) throw new BadRequestException('Keep customer was not found in this store.')

    const absorb = await this.prisma.customer.findMany({
      where: { id: { in: absorbIds }, storeId },
      select: { id: true, userId: true },
    })
    if (absorb.length !== absorbIds.length) {
      throw new BadRequestException('One of the duplicate profiles is not in this store.')
    }

    await this.prisma.$transaction(async (tx) => {
      for (const row of absorb) {
        await tx.order.updateMany({ where: { customerId: row.id }, data: { customerId: keep.id } })
        await tx.couponRedemption.updateMany({ where: { customerId: row.id }, data: { customerId: keep.id } })
        await tx.review.updateMany({ where: { customerId: row.id }, data: { customerId: keep.id } })
        await tx.notification.updateMany({ where: { customerId: row.id }, data: { customerId: keep.id } })
        await tx.cartSession.updateMany({ where: { customerId: row.id }, data: { customerId: keep.id } })
        await tx.webPushToken.updateMany({ where: { customerId: row.id }, data: { customerId: keep.id } })
        await tx.rMA.updateMany({ where: { customerId: row.id }, data: { customerId: keep.id } })
        await tx.loyaltyHistory.updateMany({ where: { customerId: row.id }, data: { customerId: keep.id } })
        await tx.customerNote.updateMany({ where: { customerId: row.id }, data: { customerId: keep.id } })
        await tx.address.updateMany({ where: { customerId: row.id }, data: { customerId: keep.id } })
        await tx.referral.updateMany({ where: { referrerId: row.id }, data: { referrerId: keep.id } })

        const absorbWish = await tx.wishlist.findUnique({
          where: { customerId: row.id },
          include: { items: { select: { productId: true } } },
        })
        if (absorbWish) {
          const keepWish = await tx.wishlist.findUnique({ where: { customerId: keep.id } })
          const target =
            keepWish ??
            (await tx.wishlist.create({ data: { customerId: keep.id } }))
          const have = new Set(
            (
              await tx.wishlistItem.findMany({
                where: { wishlistId: target.id },
                select: { productId: true },
              })
            ).map((item) => item.productId),
          )
          for (const item of absorbWish.items) {
            if (have.has(item.productId)) continue
            await tx.wishlistItem.create({ data: { wishlistId: target.id, productId: item.productId } })
            have.add(item.productId)
          }
          await tx.wishlist.delete({ where: { id: absorbWish.id } })
        }

        await tx.customer.delete({ where: { id: row.id } })
        const login = await tx.user.findFirst({
          where: { id: row.userId },
          select: {
            id: true,
            email: true,
            staffRoles: { select: { id: true }, take: 1 },
            ownedStores: { select: { id: true }, take: 1 },
            vendor: { select: { id: true } },
            passwordHash: true,
            googleId: true,
          },
        })
        if (login && !login.staffRoles.length && !login.ownedStores.length && !login.vendor && !login.passwordHash && !login.googleId) {
          await tx.auditLog.updateMany({ where: { userId: login.id }, data: { userId: null } })
          await tx.user.delete({ where: { id: login.id } })
        }
      }
      await this.refreshSpendStats(tx, keep.id)
    }, { maxWait: 10_000, timeout: 120_000 })

    return this.prisma.customer.findFirstOrThrow({
      where: { id: keep.id },
      select: {
        id: true,
        customerCode: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        totalOrders: true,
        totalSpent: true,
      },
    })
  }

  private async attachOrphanOrders(
    tx: Prisma.TransactionClient,
    storeId: string,
    customerId: string,
    phones: string[],
  ) {
    if (!phones.length) return
    await tx.order.updateMany({
      where: { storeId, customerId: null, shippingPhone: { in: phones } },
      data: { customerId },
    })
  }

  private async maybeAddCheckoutAddress(
    tx: Prisma.TransactionClient,
    customerId: string,
    hasAddress: boolean,
    input: {
      firstName: string
      lastName: string
      phone: string
      address?: string | null
      city?: string | null
      district?: string | null
      division?: string | null
    },
  ) {
    const line = input.address?.trim()
    if (!line || hasAddress) return
    const city = (input.city ?? '').trim() || 'Dhaka'
    const district = (input.district ?? city).trim() || 'Dhaka'
    await tx.address.create({
      data: {
        customerId,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        addressLine1: line,
        city,
        district,
        division: (input.division ?? 'Dhaka').trim() || 'Dhaka',
        isDefault: true,
        isInsideDhaka: /dhaka/i.test(district) || /dhaka/i.test(city),
      },
    })
  }

  async refreshSpendStats(db: Prisma.TransactionClient | PrismaService, customerId: string) {
    const agg = await db.order.aggregate({
      where: { customerId, status: { not: 'CANCELLED' } },
      _count: true,
      _sum: { total: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    })
    const orders = agg._count
    const spent = Number(agg._sum.total ?? 0)
    await db.customer.update({
      where: { id: customerId },
      data: {
        totalOrders: orders,
        totalSpent: spent,
        avgOrderValue: orders > 0 ? spent / orders : 0,
        firstOrderDate: agg._min.createdAt,
        lastOrderDate: agg._max.createdAt,
      },
    })
  }
}

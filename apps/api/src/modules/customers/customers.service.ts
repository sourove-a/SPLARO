import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { bdPhoneLookupVariants, isValidBdMobile, normalizeBdPhone } from '../../common/bd-phone.util'
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
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

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
        return tx.customer.create({
          data: {
            userId,
            storeId,
            firstName,
            lastName,
            email,
            phone,
            ...(sourceTag ? { tags: [sourceTag] } : {}),
          },
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
          select: { id: true },
        })
        if (phoneOwner) {
          throw new BadRequestException('This phone number is already registered')
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
          return tx.customer.update({
            where: { id: existing.id },
            data: {
              storeId,
              firstName: user.firstName,
              lastName: user.lastName,
              ...(email ? { email } : {}),
              phone,
            },
          })
        }

        return tx.customer.create({
          data: {
            userId: user.id,
            storeId,
            firstName: user.firstName,
            lastName: user.lastName,
            ...(email ? { email } : {}),
            phone,
            tags: ['Google signup'],
          },
        })
      })
    } catch (err) {
      if (err instanceof BadRequestException) throw err
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('This phone number is already registered')
      }
      throw err
    }
  }
}

import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

export interface RegisterCustomerInput {
  name: string
  email: string
  phone: string
  passwordHash?: string
  source?: string
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

function isValidBdPhone(phone: string) {
  return /^01[3-9]\d{8}$/.test(normalizePhone(phone))
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] ?? 'Customer'
  const lastName = parts.slice(1).join(' ') || firstName
  return { firstName, lastName }
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Persist storefront signup as User + Customer (idempotent by email/phone). */
  async registerFromSignup(storeId: string, input: RegisterCustomerInput) {
    const email = normalizeEmail(input.email)
    const phone = normalizePhone(input.phone)
    const { firstName, lastName } = splitName(input.name)

    if (!email || !phone) {
      throw new BadRequestException('Valid email and phone are required')
    }

    let user = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    })

    if (!user) {
      if (!input.passwordHash?.trim()) {
        throw new BadRequestException('passwordHash required for new customer')
      }
      user = await this.prisma.user.create({
        data: {
          email,
          phone,
          passwordHash: input.passwordHash,
          firstName,
          lastName,
          role: 'CUSTOMER',
          isActive: true,
        },
      })
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: user.email ?? email,
          phone: user.phone ?? phone,
          firstName,
          lastName,
          ...(input.passwordHash?.trim() ? { passwordHash: input.passwordHash } : {}),
        },
      })
    }

    const existing = await this.prisma.customer.findUnique({
      where: { userId: user.id },
    })

    if (existing) {
      if (existing.storeId !== storeId) {
        return this.prisma.customer.update({
          where: { id: existing.id },
          data: {
            storeId,
            firstName,
            lastName,
            email,
            phone,
          },
        })
      }
      return this.prisma.customer.update({
        where: { id: existing.id },
        data: { firstName, lastName, email, phone },
      })
    }

    const sourceTag = input.source?.trim()
    return this.prisma.customer.create({
      data: {
        userId: user.id,
        storeId,
        firstName,
        lastName,
        email,
        phone,
        ...(sourceTag ? { tags: [sourceTag] } : {}),
      },
    })
  }

  /** Finish Google signup — attach BD phone and create Customer row. */
  async completeGoogleSignup(
    storeId: string,
    userId: string,
    input: { phone: string; phoneVerified: boolean },
  ) {
    const phone = normalizePhone(input.phone)
    if (!isValidBdPhone(phone)) {
      throw new BadRequestException('Enter a valid Bangladesh mobile number (01XXXXXXXXX)')
    }

    const phoneOwner = await this.prisma.user.findFirst({
      where: { phone, NOT: { id: userId } },
      select: { id: true },
    })
    if (phoneOwner) {
      throw new BadRequestException('This phone number is already registered')
    }

    const user = await this.prisma.user.findUnique({
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

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        phone,
        phoneVerified: input.phoneVerified,
      },
    })

    const email = user.email ? normalizeEmail(user.email) : null
    const existing = user.customer

    if (existing) {
      return this.prisma.customer.update({
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

    return this.prisma.customer.create({
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
  }
}

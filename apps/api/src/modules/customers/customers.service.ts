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
}

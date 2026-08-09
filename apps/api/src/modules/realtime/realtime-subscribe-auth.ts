import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common'
import type { PrismaService } from '../../common/prisma.service'
import { isSafeRealtimeId } from '../../common/realtime/realtime-channels'
import { phonesMatchLast10 } from '../../common/realtime/realtime-event.util'
import type { StorefrontAuthService, StorefrontAuthUser } from '../storefront/storefront-auth.service'
import type { StorefrontOrdersService } from '../storefront/storefront-orders.service'
import type { StorefrontOtpService } from '../storefront/storefront-otp.service'

export function sessionTokenFromHeaders(
  authorization?: string,
  sessionHeader?: string,
): string | undefined {
  const header = sessionHeader?.trim()
  if (header) return header
  const bearer = authorization?.replace(/^Bearer\s+/i, '').trim()
  return bearer || undefined
}

type OrderAccessRow = {
  id: string
  invoiceNumber: string
  shippingPhone: string
  shippingEmail?: string | null
  customerId?: string | null
  customer?: { email?: string | null } | null
}

export async function authorizeCustomerOrderSubscribe(input: {
  storeId: string
  orderRef: string
  key?: string
  phone?: string
  phoneAccess?: string
  sessionToken?: string
  prisma: PrismaService
  storefrontOrders: StorefrontOrdersService
  storefrontAuth: StorefrontAuthService
  storefrontOtp: StorefrontOtpService
}): Promise<{ orderId: string; invoiceNumber: string }> {
  const orderRef = input.orderRef.trim()
  if (!orderRef || !isSafeRealtimeId(orderRef)) {
    throw new BadRequestException('Invalid order')
  }

  const key = input.key?.trim()
  const phone = input.phone?.trim()
  const sessionToken = input.sessionToken?.trim()

  if (!key && !phone && !sessionToken) {
    throw new UnauthorizedException('Order access required')
  }

  let sessionUser: StorefrontAuthUser | null = null
  let sessionPhone: string | null = null
  if (sessionToken) {
    sessionUser = await input.storefrontAuth.validateSession(sessionToken)
    sessionPhone = sessionUser?.phone ?? (await input.storefrontAuth.sessionPhone(sessionToken))
  }

  if (phone) {
    await input.storefrontOtp.assertPhoneAccess(
      input.storeId,
      phone,
      input.phoneAccess,
      sessionPhone,
    )
  }

  const order = (await input.storefrontOrders.findForStorefrontAccess(input.storeId, orderRef, {
    ...(key ? { key } : {}),
    ...(phone ? { phone } : {}),
  })) as OrderAccessRow | null

  if (order && (key || phone)) {
    return { orderId: order.id, invoiceNumber: order.invoiceNumber }
  }

  if (sessionUser) {
    const owned =
      order ??
      ((await input.prisma.order.findFirst({
        where: {
          storeId: input.storeId,
          OR: [{ id: orderRef }, { invoiceNumber: orderRef }],
        },
        select: {
          id: true,
          invoiceNumber: true,
          shippingPhone: true,
          shippingEmail: true,
          customerId: true,
          customer: { select: { email: true } },
        },
      })) as OrderAccessRow | null)
    if (owned && sessionOwnsOrder(sessionUser, owned)) {
      return { orderId: owned.id, invoiceNumber: owned.invoiceNumber }
    }
  }

  throw new UnauthorizedException('Not allowed to subscribe to this order')
}

export function sessionOwnsOrder(
  user: Pick<StorefrontAuthUser, 'id' | 'email' | 'phone' | 'customerId'>,
  order: OrderAccessRow,
): boolean {
  if (user.customerId && order.customerId && user.customerId === order.customerId) return true
  const userEmail = user.email?.trim().toLowerCase()
  const orderEmail = (order.shippingEmail ?? order.customer?.email ?? '').trim().toLowerCase()
  if (userEmail && orderEmail && userEmail === orderEmail) return true
  if (user.phone && phonesMatchLast10(user.phone, order.shippingPhone)) return true
  return false
}

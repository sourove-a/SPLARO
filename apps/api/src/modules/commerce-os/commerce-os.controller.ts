import { Body, Controller, Get, Param, Post, Query, UnauthorizedException } from '@nestjs/common'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { Public } from '../../common/auth/public.decorator'
import { PrismaService } from '../../common/prisma.service'
import { CommerceOsService } from './commerce-os.service'

const SCRYPT_KEYLEN = 64

function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, storedHash] = passwordHash.split(':')
  if (!salt || !storedHash) return false
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  const stored = Buffer.from(storedHash, 'hex')
  const computed = Buffer.from(hash, 'hex')
  if (stored.length !== computed.length) return false
  return timingSafeEqual(stored, computed)
}

@Controller('commerce-os')
export class CommerceOsController {
  constructor(private readonly commerce: CommerceOsService) {}

  @Get('executive/dashboard')
  executive(@Query('storeId') storeId: string) {
    return this.commerce.executiveDashboard(storeId)
  }

  @Get('wms/overview')
  wms(@Query('storeId') storeId: string) {
    return this.commerce.wmsOverview(storeId)
  }

  @Get('procurement/suppliers')
  procurementSuppliers(@Query('storeId') storeId: string) {
    return this.commerce.procurementSuppliers(storeId)
  }

  @Get('procurement/purchase-orders')
  procurementOrders(@Query('storeId') storeId: string) {
    return this.commerce.procurementOrders(storeId)
  }

  @Get('procurement/grns')
  procurementGrns(@Query('storeId') storeId: string) {
    return this.commerce.procurementGrns(storeId)
  }

  @Get('production/fabrics')
  productionFabrics(@Query('storeId') storeId: string) {
    return this.commerce.productionFabrics(storeId)
  }

  @Get('production/batches')
  productionBatches(@Query('storeId') storeId: string) {
    return this.commerce.productionBatches(storeId)
  }

  @Get('wms/warehouses')
  wmsWarehouses(@Query('storeId') storeId: string) {
    return this.commerce.wmsWarehouses(storeId)
  }

  @Post('wms/warehouses')
  createWarehouse(
    @Query('storeId') storeId: string,
    @Body() body: { name?: string; code?: string; city?: string; address?: string },
  ) {
    return this.commerce.createWarehouse(storeId, {
      name: body.name ?? '',
      code: body.code ?? '',
      ...(body.city ? { city: body.city } : {}),
      ...(body.address ? { address: body.address } : {}),
    })
  }

  @Post('helpdesk/tickets/:id/reply')
  replyHelpdesk(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: { message?: string },
  ) {
    return this.commerce.replyHelpdeskTicket(storeId, id, body.message ?? '')
  }

  @Get('wms/movements')
  wmsMovements(@Query('storeId') storeId: string) {
    return this.commerce.wmsMovements(storeId)
  }

  @Get('delivery/agents')
  deliveryAgents(@Query('storeId') storeId: string) {
    return this.commerce.deliveryAgents(storeId)
  }

  @Get('delivery/assignments')
  deliveryAssignments(@Query('storeId') storeId: string) {
    return this.commerce.deliveryAssignments(storeId)
  }

  @Get('company/employees')
  companyEmployees(@Query('storeId') storeId: string) {
    return this.commerce.companyEmployees(storeId)
  }

  @Get('helpdesk/tickets')
  helpdeskTickets(@Query('storeId') storeId: string) {
    return this.commerce.helpdeskTickets(storeId)
  }

  @Get('procurement/overview')
  procurement(@Query('storeId') storeId: string) {
    return this.commerce.procurementOverview(storeId)
  }

  @Get('helpdesk/overview')
  helpdesk(@Query('storeId') storeId: string) {
    return this.commerce.helpdeskOverview(storeId)
  }

  @Get('company/overview')
  company(@Query('storeId') storeId: string) {
    return this.commerce.companyOverview(storeId)
  }

  @Get('production/overview')
  production(@Query('storeId') storeId: string) {
    return this.commerce.productionOverview(storeId)
  }

  @Get('delivery/overview')
  delivery(@Query('storeId') storeId: string) {
    return this.commerce.deliveryOverview(storeId)
  }
}

@Public()
@Controller('mobile/auth')
export class MobileAuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('login')
  async login(@Body() body: { email?: string; phone?: string; password: string; app?: string }) {
    const user = await this.prisma.user.findFirst({
      where: body.email
        ? { email: body.email.trim().toLowerCase() }
        : { phone: body.phone?.replace(/\D/g, '') },
      select: { id: true, passwordHash: true, isActive: true, email: true, firstName: true, lastName: true, customer: { select: { id: true, storeId: true } } },
    })

    if (!user || !user.isActive || !verifyPassword(body.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const accessToken = randomBytes(32).toString('hex')
    const refreshToken = randomBytes(48).toString('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, lastLoginAt: new Date() },
    })

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      expiresAt: expiresAt.toISOString(),
      app: body.app ?? 'customer',
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        customerId: user.customer?.id,
        storeId: user.customer?.storeId,
      },
    }
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token required')

    const user = await this.prisma.user.findFirst({
      where: { refreshToken },
      select: { id: true, isActive: true },
    })

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const accessToken = randomBytes(32).toString('hex')
    const newRefreshToken = randomBytes(48).toString('hex')

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    })

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    }
  }
}

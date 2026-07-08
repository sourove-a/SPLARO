import { Body, Controller, Get, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common'
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

  @Post('wms/movements')
  recordStockMovement(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      sku?: string
      variantId?: string
      delta?: number
      reason?: string
      note?: string
    },
  ) {
    return this.commerce.recordStockMovement(storeId, body)
  }

  @Post('wms/transfers')
  createStockTransfer(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      fromWarehouseId?: string
      toWarehouseId?: string
      sku?: string
      quantity?: number
      notes?: string
    },
  ) {
    return this.commerce.createStockTransfer(storeId, body)
  }

  @Post('wms/transfers/:id/ship')
  shipStockTransfer(@Query('storeId') storeId: string, @Param('id') id: string) {
    return this.commerce.shipStockTransfer(storeId, id)
  }

  @Post('wms/transfers/:id/receive')
  receiveStockTransfer(@Query('storeId') storeId: string, @Param('id') id: string) {
    return this.commerce.receiveStockTransfer(storeId, id)
  }

  @Post('delivery/agents')
  createDeliveryAgent(
    @Query('storeId') storeId: string,
    @Body() body: { name?: string; phone?: string; vehicleType?: string },
  ) {
    return this.commerce.createDeliveryAgent(storeId, body)
  }

  @Patch('delivery/agents/:id')
  updateDeliveryAgent(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: { isActive?: boolean; name?: string; vehicleType?: string },
  ) {
    return this.commerce.updateDeliveryAgent(storeId, id, body)
  }

  @Post('delivery/assignments')
  assignOrderToAgent(
    @Query('storeId') storeId: string,
    @Body() body: { orderId?: string; agentId?: string; earnings?: number },
  ) {
    return this.commerce.assignOrderToAgent(storeId, body)
  }

  @Patch('delivery/assignments/:id/status')
  updateDeliveryAssignmentStatus(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: { status?: string },
  ) {
    return this.commerce.updateDeliveryAssignmentStatus(storeId, id, body)
  }

  @Post('company/employees')
  createEmployee(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
      position?: string
      salary?: number
      departmentId?: string
    },
  ) {
    return this.commerce.createEmployee(storeId, body)
  }

  @Patch('company/employees/:id')
  updateEmployee(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body()
    body: {
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
      position?: string
      salary?: number
      status?: string
    },
  ) {
    return this.commerce.updateEmployee(storeId, id, body)
  }

  @Patch('company/employees/:id/deactivate')
  deactivateEmployee(@Query('storeId') storeId: string, @Param('id') id: string) {
    return this.commerce.deactivateEmployee(storeId, id)
  }

  @Post('company/tasks')
  createTask(
    @Query('storeId') storeId: string,
    @Body() body: { title?: string; description?: string; priority?: string; dueDate?: string },
  ) {
    return this.commerce.createTask(storeId, body)
  }

  @Patch('company/tasks/:id/status')
  updateTaskStatus(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: { status?: string },
  ) {
    return this.commerce.updateTaskStatus(storeId, id, body)
  }

  @Get('company/payroll/runs')
  listPayrollRuns(@Query('storeId') storeId: string) {
    return this.commerce.listPayrollRuns(storeId)
  }

  @Post('company/payroll/runs')
  createPayrollRun(
    @Query('storeId') storeId: string,
    @Body() body: { month?: number; year?: number },
  ) {
    return this.commerce.createPayrollRun(storeId, body)
  }

  @Post('production/fabrics')
  createFabric(
    @Query('storeId') storeId: string,
    @Body() body: { name?: string; color?: string; quantity?: number; unit?: string; costPerUnit?: number },
  ) {
    return this.commerce.createFabricInventory(storeId, body)
  }

  @Patch('production/fabrics/:id/stock')
  updateFabricStock(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: { delta?: number; quantity?: number },
  ) {
    return this.commerce.updateFabricStock(storeId, id, body)
  }

  @Post('production/batches')
  createProductionBatch(
    @Query('storeId') storeId: string,
    @Body() body: { productName?: string; quantity?: number; notes?: string; tailorName?: string },
  ) {
    return this.commerce.createProductionBatch(storeId, body)
  }

  @Patch('production/batches/:id/status')
  updateProductionBatchStatus(
    @Query('storeId') storeId: string,
    @Param('id') id: string,
    @Body() body: { status?: string },
  ) {
    return this.commerce.updateProductionBatchStatus(storeId, id, body)
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

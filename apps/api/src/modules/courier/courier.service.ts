import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { PrismaService } from '../../common/prisma.service'
import { SteadfastService } from './providers/steadfast.service'
import { PathaoService } from './providers/pathao.service'
import { RedxService } from './providers/redx.service'
import { PaperflyService } from './providers/paperfly.service'
import { SundarbanService } from './providers/sundarban.service'
import { SaParibahonService } from './providers/sa-paribahan.service'
import { NotificationsService } from '../notifications/notifications.service'
import { TelegramService } from '../telegram/telegram.service'
import type { CourierProvider, Order } from '@prisma/client'

export interface BookCourierOptions {
  fromRetry?: boolean
}

export interface CourierBookingResult {
  success: boolean
  consignmentId?: string
  trackingCode?: string
  trackingUrl?: string
  error?: string
  /** True when booking was simulated (dev stub), not sent to courier API */
  simulated?: boolean
  /** True when order already had a consignment — no new booking attempted */
  alreadyBooked?: boolean
}

@Injectable()
export class CourierService {
  private readonly logger = new Logger(CourierService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly steadfast: SteadfastService,
    private readonly pathao: PathaoService,
    private readonly redx: RedxService,
    private readonly paperfly: PaperflyService,
    private readonly sundarban: SundarbanService,
    private readonly saParibahon: SaParibahonService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => TelegramService))
    @Optional()
    private readonly telegram: TelegramService | null,
    @InjectQueue('courier') private readonly courierQueue: Queue,
  ) {}

  /**
   * Primary entry point — auto-books courier on order confirm.
   * Falls back to retry queue on failure.
   */
  async bookCourier(
    orderId: string,
    provider?: CourierProvider,
    opts?: BookCourierOptions,
  ): Promise<CourierBookingResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, courier: true },
    })

    if (!order) throw new Error(`Order ${orderId} not found`)
    if (order.courier?.consignmentId) {
      this.logger.warn(`Order ${orderId} already has courier booking`)
      return {
        success: true,
        alreadyBooked: true,
        consignmentId: order.courier.consignmentId,
        trackingCode: order.courier.trackingCode ?? undefined,
        trackingUrl: order.courier.trackingUrl ?? undefined,
      }
    }

    const selectedProvider = provider ?? this.selectProvider(order)

    this.logger.log(`Booking courier ${selectedProvider} for order ${orderId}`)

    const result = await this.dispatchToProvider(order, selectedProvider)

    if (result.success) {
      await this.prisma.$transaction([
        this.prisma.courierShipment.upsert({
          where: { orderId },
          create: {
            orderId,
            provider: selectedProvider,
            status: 'BOOKED',
            consignmentId: result.consignmentId,
            trackingCode: result.trackingCode,
            trackingUrl: result.trackingUrl,
            deliveryCharge: order.deliveryCharge,
            codAmount: order.paymentMethod === 'CASH_ON_DELIVERY' ? order.total : 0,
            bookedAt: new Date(),
          },
          update: {
            provider: selectedProvider,
            status: 'BOOKED',
            consignmentId: result.consignmentId,
            trackingCode: result.trackingCode,
            trackingUrl: result.trackingUrl,
            bookedAt: new Date(),
            retryCount: { increment: 0 },
          },
        }),
        this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'COURIER_BOOKED' },
        }),
        this.prisma.orderStatusHistory.create({
          data: { orderId, status: 'COURIER_BOOKED', note: `Booked via ${selectedProvider}` },
        }),
      ])

      this.logger.log(`Courier booked for order ${orderId}: ${result.consignmentId}`)

      void this.telegram
        ?.notifyCourierBooked(order.storeId, {
          invoiceNumber: order.invoiceNumber,
          provider: selectedProvider,
          consignmentId: result.consignmentId,
          trackingCode: result.trackingCode,
          trackingUrl: result.trackingUrl,
        })
        .catch((err) =>
          this.logger.warn(
            `Telegram courier booked notify failed: ${err instanceof Error ? err.message : 'unknown'}`,
          ),
        )
    } else {
      this.logger.error(`Courier booking failed for order ${orderId}: ${result.error}`)

      await this.prisma.courierShipment.upsert({
        where: { orderId },
        create: {
          orderId,
          provider: selectedProvider,
          status: 'FAILED',
          deliveryCharge: order.deliveryCharge,
          failureReason: result.error,
          retryCount: 1,
          lastRetryAt: new Date(),
        },
        update: {
          status: 'FAILED',
          failureReason: result.error,
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
        },
      })

      if (!opts?.fromRetry) {
        await this.courierQueue.add(
          'retry-booking',
          { orderId, provider: selectedProvider, attempt: 1 },
          {
            delay: 5 * 60 * 1000,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5 * 60 * 1000 },
          },
        )
      }

      await this.notifications.notifyAdmin({
        storeId: order.storeId,
        subject: `Courier booking failed: ${order.invoiceNumber}`,
        body: `Order ${order.invoiceNumber} (${orderId}) courier booking failed via ${selectedProvider}. Error: ${result.error}.${opts?.fromRetry ? '' : ' Added to retry queue.'}`,
        level: 'error',
      })

      void this.telegram
        ?.notifyCourierFailed(order.storeId, {
          invoiceNumber: order.invoiceNumber,
          provider: selectedProvider,
          error: result.error ?? 'Unknown error',
        })
        .catch((err) =>
          this.logger.warn(
            `Telegram courier failed notify failed: ${err instanceof Error ? err.message : 'unknown'}`,
          ),
        )
    }

    return result
  }

  /**
   * Select courier provider based on delivery zone and store settings
   */
  private selectProvider(order: Order): CourierProvider {
    const configured = process.env.DEFAULT_COURIER_PROVIDER?.trim().toUpperCase()
    if (configured && this.isValidProvider(configured)) {
      return configured as CourierProvider
    }
    if (order.isInsideDhaka) return 'STEADFAST'
    return 'STEADFAST'
  }

  private isValidProvider(value: string): boolean {
    return [
      'STEADFAST',
      'PATHAO',
      'REDX',
      'PAPERFLY',
      'SUNDARBAN',
      'SA_PARIBAHAN',
      'MANUAL',
    ].includes(value)
  }

  private async dispatchToProvider(
    order: Order & { items: unknown[] },
    provider: CourierProvider,
  ): Promise<CourierBookingResult> {
    const payload = {
      invoiceNumber: order.invoiceNumber,
      recipientName: order.shippingName,
      recipientPhone: order.shippingPhone,
      recipientAddress: order.shippingAddress,
      recipientCity: order.shippingCity,
      recipientDistrict: order.shippingDistrict,
      codAmount: order.paymentMethod === 'CASH_ON_DELIVERY' ? Number(order.total) : 0,
      totalAmount: Number(order.total),
      recipientCityId: 1,
      recipientZoneId: 1,
      weight: 0.5, // default 500g; real weight from product
      note: order.notes ?? '',
      remarks: order.notes ?? '',
    }

    try {
      switch (provider) {
        case 'STEADFAST':
          return await this.steadfast.createParcel(order.storeId, payload)
        case 'PATHAO': {
          const created = await this.pathao.createOrder(order.storeId, payload)
          return {
            success: true,
            consignmentId: created.consignment_id,
            trackingCode: created.tracking_code,
            trackingUrl: `https://merchant.pathao.com/tracking?consignment_id=${created.consignment_id}`,
          }
        }
        case 'REDX': {
          const created = await this.redx.createParcel(order.storeId, payload)
          return {
            success: true,
            consignmentId: created.trackingId,
            trackingCode: created.trackingId,
            trackingUrl: `https://redx.com.bd/track-parcel/?trackingId=${created.trackingId}`,
          }
        }
        case 'PAPERFLY': {
          const created = await this.paperfly.createParcel(payload)
          return {
            success: created.success,
            consignmentId: created.tracking_code,
            trackingCode: created.tracking_code,
            ...(created.message ? { error: created.message } : {}),
          }
        }
        case 'SUNDARBAN':
          return await this.sundarban.createParcel({
            ...payload,
            recipientDistrict: payload.recipientDistrict ?? payload.recipientCity,
          })
        case 'SA_PARIBAHAN':
          return await this.saParibahon.createParcel(payload)
        case 'MANUAL':
          return {
            success: true,
            consignmentId: `MANUAL-${payload.invoiceNumber}`,
            trackingCode: `MANUAL-${payload.invoiceNumber}`,
            trackingUrl: undefined,
          }
        default:
          return { success: false, error: `Unknown provider: ${String(provider)}` }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  async getTrackingStatus(orderId: string): Promise<string | null> {
    const shipment = await this.prisma.courierShipment.findUnique({
      where: { orderId },
      include: { order: { select: { storeId: true } } },
    })
    if (!shipment?.consignmentId) return null

    try {
      switch (shipment.provider) {
        case 'STEADFAST':
          return await this.steadfast.trackParcel(shipment.order.storeId, shipment.consignmentId)
        case 'PATHAO':
          return (await this.pathao.trackOrder(shipment.order.storeId, shipment.consignmentId)).status
        case 'REDX':
          return (await this.redx.trackParcel(shipment.order.storeId, shipment.consignmentId)).status
        case 'SUNDARBAN':
          return await this.sundarban.trackParcel(shipment.consignmentId)
        case 'SA_PARIBAHAN':
          return await this.saParibahon.trackParcel(shipment.consignmentId)
        case 'MANUAL':
          return shipment.status
        default:
          return shipment.status
      }
    } catch {
      return shipment.status
    }
  }

  async manualRetry(orderId: string, provider?: CourierProvider): Promise<CourierBookingResult> {
    return this.bookCourier(orderId, provider)
  }
}

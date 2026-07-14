import { CourierProvider, OrderStatus, PaymentStatus } from '@prisma/client'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator'

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus

  @IsOptional()
  @IsString()
  note?: string
}

export class BulkUpdateOrderStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderIds!: string[]

  @IsEnum(OrderStatus)
  status!: OrderStatus

  @IsOptional()
  @IsString()
  note?: string
}

export class SetCodRiskDto {
  @IsBoolean()
  isCodRisk!: boolean

  @IsOptional()
  @IsBoolean()
  requireAdvancePayment?: boolean
}

export class AddOrderNoteDto {
  @IsString()
  body!: string
}

export class UpdateOrderPaymentDto {
  @IsEnum(PaymentStatus)
  paymentStatus!: PaymentStatus
}

export class BookCourierDto {
  @IsOptional()
  @IsEnum(CourierProvider)
  provider?: CourierProvider
}

export class BulkBookCourierDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderIds!: string[]

  @IsOptional()
  @IsEnum(CourierProvider)
  provider?: CourierProvider
}

export class InvoiceEmailDto {
  @IsOptional()
  @IsEmail()
  email?: string
}

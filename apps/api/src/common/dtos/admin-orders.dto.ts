import { CourierProvider, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator'
import { Type } from 'class-transformer'

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

  /** Gateway / manual trx id — required when marking PAID */
  @IsOptional()
  @IsString()
  @MinLength(3)
  reference?: string

  /** Amount received — required when marking PAID */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod

  @IsOptional()
  @IsString()
  note?: string
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

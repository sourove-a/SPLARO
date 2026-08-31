import { CourierProvider, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client'
import {
  ArrayMaxSize,
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
  ValidateNested,
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

/**
 * Ids to destroy permanently. `ArrayMaxSize` is the batch ceiling rather than a
 * page size: every id in one call shares a single transaction, and a list long
 * enough to hold that transaction open is a list that should arrive in pieces.
 */
export class PurgeOrdersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  orderIds!: string[]
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

export class EditOrderItemDto {
  @IsString()
  variantId!: string

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number
}

export class EditOrderShippingDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  email?: string

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  district?: string

  @IsOptional()
  @IsString()
  division?: string

  @IsOptional()
  @IsString()
  postal?: string
}

export class EditOrderDto {
  /** Omit to leave the lines untouched; sending an empty array is rejected. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EditOrderItemDto)
  items?: EditOrderItemDto[]

  @IsOptional()
  @ValidateNested()
  @Type(() => EditOrderShippingDto)
  shipping?: EditOrderShippingDto

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

import { IsEmail, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator'

export class BkashCreatePaymentDto {
  @IsNumber()
  @Min(0)
  amount!: number

  @IsString()
  @MinLength(3)
  invoiceNumber!: string

  @IsString()
  @MinLength(8)
  callbackUrl!: string
}

export class NagadInitPaymentDto {
  @IsString()
  @MinLength(3)
  invoiceNumber!: string

  @IsNumber()
  @Min(0)
  amount!: number

  @IsString()
  @MinLength(8)
  callbackUrl!: string
}

export class BkashExecutePaymentDto {
  @IsString()
  @MinLength(1)
  paymentId!: string
}

export class BkashRefundDto {
  @IsString()
  @MinLength(1)
  paymentId!: string

  @IsString()
  @MinLength(1)
  trxId!: string

  // Min(0.01), not Min(0) — a zero-value refund is never a real request.
  @IsNumber()
  @Min(0.01)
  amount!: number

  @IsString()
  @MinLength(3)
  reason!: string

  @IsOptional()
  @IsString()
  sku?: string
}

export class SslInitPaymentDto {
  @IsString()
  @MinLength(3)
  invoiceNumber!: string

  @IsNumber()
  @Min(0)
  amount!: number

  @IsString()
  @MinLength(2)
  customerName!: string

  @IsEmail()
  customerEmail!: string

  @IsString()
  @MinLength(6)
  customerPhone!: string

  @IsString()
  @MinLength(4)
  customerAddress!: string

  @IsString()
  @MinLength(2)
  customerCity!: string

  @IsString()
  @MinLength(8)
  successUrl!: string

  @IsString()
  @MinLength(8)
  failUrl!: string

  @IsString()
  @MinLength(8)
  cancelUrl!: string
}

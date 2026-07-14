import { IsEmail, IsNumber, IsString, Min, MinLength } from 'class-validator'

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
  @MinLength(1)
  orderId!: string

  @IsNumber()
  @Min(0)
  amount!: number

  @IsString()
  @MinLength(8)
  callbackUrl!: string
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

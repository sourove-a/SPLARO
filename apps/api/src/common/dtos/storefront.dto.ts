import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

export class StorefrontOtpSendDto {
  @IsString()
  @MinLength(6)
  phone!: string
}

export class StorefrontOtpVerifyDto {
  @IsString()
  @MinLength(6)
  phone!: string

  @IsString()
  @MinLength(4)
  code!: string
}

export class StorefrontCustomerDto {
  @IsString()
  @MinLength(2)
  name!: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsString()
  @MinLength(6)
  phone!: string

  @IsString()
  @MinLength(4)
  address!: string

  @IsString()
  @MinLength(2)
  city!: string

  @IsOptional()
  @IsString()
  district?: string

  @IsOptional()
  @IsString()
  division?: string
}

export class StorefrontOrderItemDto {
  @IsString()
  productId!: string

  @IsOptional()
  @IsString()
  variantId?: string

  @IsInt()
  @Min(1)
  @Max(500)
  quantity!: number

  @IsString()
  name!: string

  @IsNumber()
  @Min(0)
  price!: number

  @IsOptional()
  @IsString()
  image?: string

  @IsOptional()
  @IsString()
  size?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsString()
  slug?: string
}

export class StorefrontOrderAttributionDto {
  @IsOptional()
  @IsString()
  utmSource?: string

  @IsOptional()
  @IsString()
  utmMedium?: string

  @IsOptional()
  @IsString()
  utmCampaign?: string

  @IsOptional()
  @IsString()
  utmContent?: string

  @IsOptional()
  @IsString()
  utmTerm?: string

  @IsOptional()
  @IsString()
  fbclid?: string

  @IsOptional()
  @IsString()
  referrer?: string

  @IsOptional()
  @IsString()
  trafficSource?: string

  @IsOptional()
  @IsString()
  landingPage?: string

  @IsOptional()
  @IsString()
  capturedAt?: string
}

export class CreateStorefrontOrderDto {
  @IsOptional()
  @IsString()
  storeId?: string

  @IsOptional()
  @IsString()
  userId?: string

  @ValidateNested()
  @Type(() => StorefrontCustomerDto)
  customer!: StorefrontCustomerDto

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StorefrontOrderItemDto)
  items!: StorefrontOrderItemDto[]

  @IsNumber()
  @Min(0)
  subtotal!: number

  @IsNumber()
  @Min(0)
  delivery!: number

  @IsNumber()
  @Min(0)
  discount!: number

  @IsNumber()
  @Min(0)
  total!: number

  @IsString()
  @MinLength(2)
  paymentMethod!: string

  @IsOptional()
  @IsString()
  couponCode?: string

  @IsOptional()
  @IsString()
  idempotencyKey?: string

  /** Marketing attribution from storefront (UTM / fbclid / referrer). */
  @IsOptional()
  @ValidateNested()
  @Type(() => StorefrontOrderAttributionDto)
  attribution?: StorefrontOrderAttributionDto
}

export class NewsletterSubscribeDto {
  @IsEmail()
  email!: string
}

export class StorefrontSignupDto {
  @IsString()
  @MinLength(2)
  name!: string

  @IsEmail()
  email!: string

  @IsString()
  @MinLength(6)
  phone!: string

  @IsString()
  @MinLength(8)
  password!: string
}

export class StorefrontLoginDto {
  @IsString()
  @MinLength(3)
  email!: string

  @IsString()
  @MinLength(4)
  password!: string
}

export class StorefrontGoogleAuthDto {
  @IsString()
  @MinLength(20)
  credential!: string
}

export class StorefrontCompletePhoneDto {
  @IsString()
  @MinLength(6)
  phone!: string

  @IsOptional()
  @IsString()
  code?: string
}

export class StorefrontForgotPasswordDto {
  @IsEmail()
  email!: string
}

export class StorefrontResetPasswordDto {
  @IsString()
  @MinLength(8)
  token!: string

  @IsString()
  @MinLength(8)
  password!: string
}

export class StorefrontCartAddItemDto {
  @IsString()
  productId!: string

  @IsOptional()
  @IsString()
  variantId?: string

  @IsOptional()
  @IsString()
  size?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  quantity?: number
}

export class StorefrontCartReplaceItemDto {
  @IsString()
  productId!: string

  @IsOptional()
  @IsString()
  variantId?: string

  @IsOptional()
  @IsString()
  size?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  quantity?: number
}

export class StorefrontCartReplaceDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => StorefrontCartReplaceItemDto)
  items?: StorefrontCartReplaceItemDto[]
}

export class StorefrontSubmitReviewDto {
  @IsString()
  productId!: string

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number

  @IsOptional()
  @IsString()
  title?: string

  @IsString()
  @MinLength(10)
  body!: string
}

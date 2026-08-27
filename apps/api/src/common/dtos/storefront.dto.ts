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
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

export class StorefrontOtpSendDto {
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  phone!: string
}

export class StorefrontOtpVerifyDto {
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  phone!: string

  @IsString()
  @MinLength(4)
  @MaxLength(12)
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
  gclid?: string

  @IsOptional()
  @IsString()
  fbp?: string

  @IsOptional()
  @IsString()
  fbc?: string

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
  @MaxLength(120)
  name!: string

  @IsEmail()
  @MaxLength(160)
  email!: string

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  phone!: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must include at least one letter and one number',
  })
  password!: string
}

export class StorefrontLoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  email!: string

  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password!: string
}

export class StorefrontGoogleAuthDto {
  @IsString()
  @MinLength(20)
  @MaxLength(8192)
  credential!: string
}

export class StorefrontCompletePhoneDto {
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  phone!: string

  @IsOptional()
  @IsString()
  @MaxLength(12)
  code?: string
}

export class StorefrontForgotPasswordDto {
  /** Email or BD phone number — the reset link always goes to the account's email. */
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  email!: string
}

/**
 * Wholesale / export enquiry from the storefront. Buyers reach this from the
 * footer, so it stays public — length caps keep a scripted post from filling
 * the table with novels.
 */
export class WholesaleInquiryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string

  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  industry!: string

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  country!: string

  @IsString()
  @MinLength(6)
  @MaxLength(32)
  phone!: string

  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productInterest?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  monthlyQuantity?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourcePath?: string

  /** Public /uploads/wholesale/* URLs from the storefront image uploader. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  imageUrls?: string[]
}

export class StorefrontResetPasswordDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must include at least one letter and one number',
  })
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

  /**
   * Photo paths this store issued from POST /api/reviews/images.
   * Only our own upload paths are accepted — an arbitrary URL here would let a
   * reviewer embed remote content on the product page.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @Matches(/^\/uploads\/reviews\/[A-Za-z0-9._-]+$/, {
    each: true,
    message: 'Review photos must be uploaded through SPLARO',
  })
  images?: string[]
}

export class StorefrontReturnItemDto {
  @IsString()
  orderItemId!: string

  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number
}

export class StorefrontCreateReturnDto {
  @IsString()
  orderId!: string

  @IsOptional()
  @IsString()
  @Matches(/^(RETURN|EXCHANGE)$/, {
    message: 'type must be RETURN or EXCHANGE',
  })
  type?: 'RETURN' | 'EXCHANGE'

  @IsString()
  @MinLength(4)
  @MaxLength(200)
  reason!: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string

  /**
   * Photo paths this store issued from its own return-photo upload route.
   * Only our own upload paths are accepted — an arbitrary URL here would let a
   * customer plant remote content in the admin's returns queue.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @Matches(/^\/uploads\/returns\/[A-Za-z0-9._-]+$/, {
    each: true,
    message: 'Return photos must be uploaded through SPLARO',
  })
  images?: string[]

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => StorefrontReturnItemDto)
  items!: StorefrontReturnItemDto[]
}

export class StorefrontStockAlertDto {
  @IsString()
  productId!: string

  @IsOptional()
  @IsString()
  variantId?: string

  /** One of email or phone. Which one is given picks the channel. */
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  phone?: string
}

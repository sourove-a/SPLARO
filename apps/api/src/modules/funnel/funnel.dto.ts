import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  IsEmail,
  IsBoolean,
} from 'class-validator'
import { Type } from 'class-transformer'

export class FunnelBundleTierDto {
  @IsNumber()
  @Min(1)
  qty!: number

  @IsString()
  @IsNotEmpty()
  label!: string

  @IsNumber()
  @Min(0)
  price!: number

  @IsString()
  @IsOptional()
  badge?: string
}

export class FunnelAttributionDto {
  @IsString()
  @IsOptional()
  utmSource?: string

  @IsString()
  @IsOptional()
  utmMedium?: string

  @IsString()
  @IsOptional()
  utmCampaign?: string

  @IsString()
  @IsOptional()
  utmContent?: string

  @IsString()
  @IsOptional()
  fbclid?: string

  @IsString()
  @IsOptional()
  ttclid?: string

  @IsString()
  @IsOptional()
  gclid?: string

  @IsString()
  @IsOptional()
  landingPage?: string

  @IsString()
  @IsOptional()
  trafficSource?: string
}

export class ResolveFunnelQueryDto {
  @IsString()
  @IsNotEmpty()
  host!: string

  @IsString()
  @IsOptional()
  slug?: string
}

export class CreateFunnelStoreDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsString()
  @IsNotEmpty()
  slug!: string

  @IsString()
  @IsOptional()
  subdomain?: string

  @IsString()
  @IsOptional()
  domain?: string

  @IsString()
  @IsNotEmpty()
  themePreset!: string // 'obsidian-gold' | 'emerald-velvet' | 'titanium-silver' | 'warm-sand' | 'cyber-lime' | 'custom'

  @IsString()
  @IsOptional()
  themeName?: string

  @IsOptional()
  customColors?: Record<string, string>

  @IsString()
  @IsNotEmpty()
  activeProductId!: string

  @IsString()
  @IsOptional()
  headline?: string

  @IsString()
  @IsOptional()
  subheadline?: string

  @IsString()
  @IsOptional()
  heroMediaUrl?: string

  @IsString()
  @IsOptional()
  heroMediaType?: 'image' | 'video'

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  bulletPoints?: string[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FunnelBundleTierDto)
  @IsOptional()
  bundles?: FunnelBundleTierDto[]

  @IsString()
  @IsOptional()
  facebookPixelId?: string

  @IsString()
  @IsOptional()
  tiktokPixelId?: string

  @IsNumber()
  @IsOptional()
  deliveryInsideDhaka?: number

  @IsNumber()
  @IsOptional()
  deliveryOutsideDhaka?: number

  @IsString()
  @IsOptional()
  ctaText?: string

  @IsString()
  @IsOptional()
  urgencyText?: string

  @IsString()
  @IsOptional()
  guaranteeBadge?: string

  @IsString()
  @IsOptional()
  whatsappNumber?: string

  @IsString()
  @IsOptional()
  videoUrl?: string

  @IsString()
  @IsOptional()
  productLanguage?: 'bn' | 'en'

  @IsString()
  @IsOptional()
  customProductTitle?: string

  @IsString()
  @IsOptional()
  customProductDescription?: string

  @IsNumber()
  @IsOptional()
  customProductPrice?: number

  @IsNumber()
  @IsOptional()
  customCompareAtPrice?: number

  @IsString()
  @IsOptional()
  heroBadgeText?: string

  @IsString()
  @IsOptional()
  reviewRatingText?: string

  @IsString()
  @IsOptional()
  deliveryTimelineText?: string

  @IsNumber()
  @IsOptional()
  bundleTier2Discount?: number

  @IsNumber()
  @IsOptional()
  bundleTier3Discount?: number

  @IsString()
  @IsOptional()
  bundleTier1Tag?: string

  @IsString()
  @IsOptional()
  bundleTier2Tag?: string

  @IsString()
  @IsOptional()
  bundleTier3Tag?: string

  @IsString()
  @IsOptional()
  bundleTier1Title?: string

  @IsString()
  @IsOptional()
  bundleTier2Title?: string

  @IsString()
  @IsOptional()
  bundleTier3Title?: string

  @IsBoolean()
  @IsOptional()
  showBundleCards?: boolean
}

export class UpdateFunnelStoreDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  subdomain?: string

  @IsString()
  @IsOptional()
  domain?: string

  @IsString()
  @IsOptional()
  themePreset?: string

  @IsString()
  @IsOptional()
  themeName?: string

  @IsOptional()
  customColors?: Record<string, string>

  @IsString()
  @IsOptional()
  activeProductId?: string

  @IsString()
  @IsOptional()
  headline?: string

  @IsString()
  @IsOptional()
  subheadline?: string

  @IsString()
  @IsOptional()
  heroMediaUrl?: string

  @IsString()
  @IsOptional()
  heroMediaType?: 'image' | 'video'

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  bulletPoints?: string[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FunnelBundleTierDto)
  @IsOptional()
  bundles?: FunnelBundleTierDto[]

  @IsString()
  @IsOptional()
  facebookPixelId?: string

  @IsString()
  @IsOptional()
  tiktokPixelId?: string

  @IsNumber()
  @IsOptional()
  deliveryInsideDhaka?: number

  @IsNumber()
  @IsOptional()
  deliveryOutsideDhaka?: number

  @IsString()
  @IsOptional()
  ctaText?: string

  @IsString()
  @IsOptional()
  urgencyText?: string

  @IsString()
  @IsOptional()
  guaranteeBadge?: string

  @IsString()
  @IsOptional()
  whatsappNumber?: string

  @IsString()
  @IsOptional()
  videoUrl?: string

  @IsString()
  @IsOptional()
  productLanguage?: 'bn' | 'en'

  @IsString()
  @IsOptional()
  customProductTitle?: string

  @IsString()
  @IsOptional()
  customProductDescription?: string

  @IsNumber()
  @IsOptional()
  customProductPrice?: number

  @IsNumber()
  @IsOptional()
  customCompareAtPrice?: number

  @IsString()
  @IsOptional()
  heroBadgeText?: string

  @IsString()
  @IsOptional()
  reviewRatingText?: string

  @IsString()
  @IsOptional()
  deliveryTimelineText?: string

  @IsNumber()
  @IsOptional()
  bundleTier2Discount?: number

  @IsNumber()
  @IsOptional()
  bundleTier3Discount?: number

  @IsString()
  @IsOptional()
  bundleTier1Tag?: string

  @IsString()
  @IsOptional()
  bundleTier2Tag?: string

  @IsString()
  @IsOptional()
  bundleTier3Tag?: string

  @IsString()
  @IsOptional()
  bundleTier1Title?: string

  @IsString()
  @IsOptional()
  bundleTier2Title?: string

  @IsString()
  @IsOptional()
  bundleTier3Title?: string

  @IsBoolean()
  @IsOptional()
  showBundleCards?: boolean

  @IsOptional()
  isActive?: boolean
}

export class CreateFunnelOrderDto {
  @IsString()
  @IsNotEmpty()
  storeId!: string

  @IsString()
  @IsNotEmpty()
  productId!: string

  @IsString()
  @IsOptional()
  variantId?: string

  @IsNumber()
  @Min(1)
  quantity!: number

  @IsString()
  @IsNotEmpty()
  customerName!: string

  @IsString()
  @IsNotEmpty()
  customerPhone!: string

  @IsString()
  @IsOptional()
  customerEmail?: string

  @IsString()
  @IsNotEmpty()
  shippingDistrict!: string

  @IsString()
  @IsNotEmpty()
  shippingAddress!: string

  @IsEnum(['CASH_ON_DELIVERY', 'BKASH', 'NAGAD'])
  paymentMethod!: 'CASH_ON_DELIVERY' | 'BKASH' | 'NAGAD'

  @IsString()
  @IsOptional()
  idempotencyKey?: string

  @ValidateNested()
  @Type(() => FunnelAttributionDto)
  @IsOptional()
  attribution?: FunnelAttributionDto
}

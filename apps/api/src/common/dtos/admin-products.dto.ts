import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'
import { PRODUCT_HEX_PATTERN } from '../color-hex.util'

export class AdminProductColorDto {
  @IsString()
  @MinLength(1)
  name!: string

  @IsString()
  @Matches(PRODUCT_HEX_PATTERN, {
    message: 'hex must be #RGB, #RRGGBB, or #RRGGBBAA',
  })
  hex!: string

  @IsOptional()
  @IsString()
  image?: string
}

export class AdminProductMediaDto {
  @IsString()
  @MinLength(1)
  url!: string

  @IsIn(['image', 'video'])
  type!: 'image' | 'video'

  @IsOptional()
  @IsString()
  @MaxLength(180)
  altText?: string

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  position?: number
}

export class AdminProductVariantCreateDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  size?: string

  @IsOptional()
  @IsString()
  @MaxLength(60)
  colorName?: string

  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Matches(PRODUCT_HEX_PATTERN, {
    message: 'colorHex must be #RGB, #RRGGBB, or #RRGGBBAA',
  })
  colorHex?: string

  @IsOptional()
  @IsString()
  image?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string

  @IsNumber()
  @Min(0)
  price!: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number | null

  @IsInt()
  @Min(0)
  @Max(999999)
  stock!: number

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class AdminProductDetailDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  value!: string
}

/** Partial product update — all fields optional. */
export class AdminProductPatchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string

  @IsOptional()
  @IsString()
  nameBn?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  shortDescription?: string

  // Bangla copy rides schemaMarkup alongside nameBn, so it is length-capped —
  // that column is JSON, not the unbounded text the English field uses.
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descriptionBn?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number | null

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number | null

  @IsOptional()
  @IsString()
  sku?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @IsString()
  weavingType?: string

  @IsOptional()
  @IsString()
  collectionId?: string

  @IsOptional()
  @IsString()
  categoryId?: string

  /** Optional. `null` clears the brand; omitting the key leaves it unchanged. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  brandId?: string | null

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsString()
  imageUrl?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[]

  @IsOptional()
  @IsString()
  videoUrl?: string

  @IsOptional()
  @IsString()
  fabricContent?: string

  @IsOptional()
  @IsString()
  fitType?: string

  @IsOptional()
  @IsString()
  occasion?: string

  @IsOptional()
  @IsString()
  careInstructions?: string

  @IsOptional()
  @IsString()
  metaTitle?: string

  @IsOptional()
  @IsString()
  metaDescription?: string

  @IsOptional()
  @IsString()
  season?: string

  @IsOptional()
  @IsString()
  slug?: string

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean

  @IsOptional()
  @IsBoolean()
  isNewArrival?: boolean

  @IsOptional()
  @IsBoolean()
  isBestSeller?: boolean

  @IsOptional()
  @IsNumber()
  weight?: number | null

  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthCm?: number | null

  @IsOptional()
  @IsNumber()
  @Min(0)
  widthCm?: number | null

  @IsOptional()
  @IsNumber()
  @Min(0)
  heightCm?: number | null

  @IsOptional()
  @IsString()
  productType?: string | null

  @IsOptional()
  @IsIn(['DENY', 'CONTINUE', 'PREORDER'])
  inventoryPolicy?: 'DENY' | 'CONTINUE' | 'PREORDER'

  @IsOptional()
  @IsString()
  preorderReleaseAt?: string | null

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminProductDetailDto)
  additionalDetails?: AdminProductDetailDto[]

  @IsOptional()
  @IsString()
  origin?: string | null

  @IsOptional()
  @IsString()
  badge?: string | null

  @IsOptional()
  @IsString()
  rmCode?: string | null

  @IsOptional()
  @IsString()
  barcode?: string | null

  @IsOptional()
  @IsString()
  qrCode?: string | null

  @IsOptional()
  @IsString()
  publishAt?: string | null

  @IsOptional()
  @IsBoolean()
  skipVersionSnapshot?: boolean
}

/** Admin create product — required name + basePrice. */
export class CreateAdminProductDto extends AdminProductPatchDto {
  @IsString()
  @MinLength(1)
  declare name: string

  @IsNumber()
  @Min(0)
  declare basePrice: number

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sizes?: string[]

  @IsOptional()
  @IsArray()
  colors?: Array<string | AdminProductColorDto>

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultStock?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminProductMediaDto)
  media?: AdminProductMediaDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminProductVariantCreateDto)
  variants?: AdminProductVariantCreateDto[]
}

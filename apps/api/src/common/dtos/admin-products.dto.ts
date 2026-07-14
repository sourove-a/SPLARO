import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

export class AdminProductColorDto {
  @IsString()
  @MinLength(1)
  name!: string

  @IsString()
  @MinLength(4)
  hex!: string

  @IsOptional()
  @IsString()
  image?: string
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
}

import { IsISO8601, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export const CAMPAIGN_TYPES = ['EMAIL', 'SMS', 'WHATSAPP'] as const
export type CampaignType = (typeof CAMPAIGN_TYPES)[number]

export const CAMPAIGN_AUDIENCES = ['ALL', 'LOYAL', 'INACTIVE', 'HIGH_SPENDERS', 'TAG'] as const
export type CampaignAudience = (typeof CAMPAIGN_AUDIENCES)[number]

export const CAMPAIGN_STATUSES = ['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED'] as const

export class CreateCampaignDto {
  @IsOptional()
  @IsString()
  storeId?: string

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject!: string

  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  body!: string

  @IsIn(CAMPAIGN_TYPES)
  type!: CampaignType

  @IsOptional()
  @IsIn(CAMPAIGN_AUDIENCES)
  targetAudience?: CampaignAudience

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetTag?: string

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  body?: string
}

export class AudienceEstimateQueryDto {
  @IsOptional()
  @IsIn(CAMPAIGN_TYPES)
  type?: CampaignType

  @IsOptional()
  @IsIn(CAMPAIGN_AUDIENCES)
  audience?: CampaignAudience

  @IsOptional()
  @IsString()
  tag?: string
}

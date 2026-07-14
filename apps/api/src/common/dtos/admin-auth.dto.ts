import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class AdminRequestLoginDto {
  @IsEmail({}, { message: 'Valid email required' })
  email!: string

  @IsOptional()
  @IsString()
  storeId?: string
}

export class AdminLoginDto {
  @IsEmail({}, { message: 'Valid email required' })
  email!: string

  @IsOptional()
  @IsString()
  @MinLength(4)
  token?: string

  @IsOptional()
  @IsString()
  password?: string

  @IsOptional()
  @IsString()
  storeId?: string
}

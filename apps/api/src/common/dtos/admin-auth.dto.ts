import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class AdminRequestLoginDto {
  @IsEmail({}, { message: 'Valid email required' })
  email!: string

  @IsOptional()
  @IsString()
  storeId?: string
}

export class AdminLoginMethodDto {
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

export class AdminForgotPasswordDto {
  @IsEmail({}, { message: 'Valid email required' })
  email!: string

  @IsOptional()
  @IsString()
  storeId?: string
}

export class AdminResetPasswordDto {
  @IsString()
  @MinLength(16)
  token!: string

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string
}

export class AdminAcceptInviteDto {
  @IsString()
  @MinLength(16)
  token!: string

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string

  @IsOptional()
  @IsString()
  firstName?: string
}

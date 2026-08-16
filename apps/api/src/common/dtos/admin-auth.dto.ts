import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class AdminRequestLoginDto {
  @IsEmail({}, { message: 'Valid email required' })
  @MaxLength(160)
  email!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  storeId?: string
}

export class AdminLoginMethodDto {
  @IsEmail({}, { message: 'Valid email required' })
  @MaxLength(160)
  email!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  storeId?: string
}

export class AdminLoginDto {
  @IsEmail({}, { message: 'Valid email required' })
  @MaxLength(160)
  email!: string

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  token?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  storeId?: string
}

export class AdminForgotPasswordDto {
  @IsEmail({}, { message: 'Valid email required' })
  @MaxLength(160)
  email!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  storeId?: string
}

export class AdminResetPasswordDto {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password!: string
}

export class AdminAcceptInviteDto {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  token!: string

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password!: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string
}

export class AdminChangePasswordDto {
  @IsString()
  @MinLength(8, { message: 'Current password required' })
  @MaxLength(128)
  currentPassword!: string

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @MaxLength(128)
  newPassword!: string
}

export class AdminGoogleLoginDto {
  /** Google Identity Services ID token (JWT) from the browser. */
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  credential!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  storeId?: string
}

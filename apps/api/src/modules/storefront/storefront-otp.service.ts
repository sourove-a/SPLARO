import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { randomBytes, randomInt } from 'crypto'
import { RedisService } from '../../common/redis.service'

const OTP_TTL_SEC = 300
const PHONE_ACCESS_TTL_SEC = 900

interface PhoneAccessPayload {
  phone: string
  storeId: string
}

/** In-memory fallback when Redis is unavailable (dev only). */
const memoryOtp = new Map<string, { code: string; exp: number }>()
const memoryPhoneAccess = new Map<string, PhoneAccessPayload & { exp: number }>()

function otpKey(storeId: string, phone: string) {
  return `splaro:otp:${storeId}:${phone}`
}

function phoneAccessKey(token: string) {
  return `splaro:phone-access:${token}`
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) throw new BadRequestException('Enter a valid phone number')
  return digits.slice(-11)
}

/** OTP off by default — set STOREFRONT_PHONE_OTP_ENABLED=true when SMS provider is ready. */
export function isStorefrontPhoneOtpEnabled(): boolean {
  return process.env.STOREFRONT_PHONE_OTP_ENABLED === 'true'
}

@Injectable()
export class StorefrontOtpService {
  constructor(private readonly redis: RedisService) {}

  async sendOtp(storeId: string, phoneRaw: string): Promise<{ sent: boolean; devCode?: string }> {
    if (!isStorefrontPhoneOtpEnabled()) {
      throw new BadRequestException('Phone verification is not enabled yet')
    }
    const phone = normalizePhone(phoneRaw)
    const code = String(randomInt(100000, 999999))
    const key = otpKey(storeId, phone)

    const stored = await this.setJsonWithTtl(key, { code }, OTP_TTL_SEC)
    if (!stored) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException(
          'Phone verification is temporarily unavailable. Sign in or try again later.',
        )
      }
      memoryOtp.set(key, { code, exp: Date.now() + OTP_TTL_SEC * 1000 })
    }

    const isDev = process.env.NODE_ENV !== 'production'
    if (isDev) {
      console.log(`[storefront-otp] ${phone} → ${code}`)
    }

    return {
      sent: true,
      ...(isDev ? { devCode: code } : {}),
    }
  }

  async verifyOtp(
    storeId: string,
    phoneRaw: string,
    code: string,
  ): Promise<{ phoneAccessToken: string; expiresAt: string }> {
    const phone = await this.assertValidOtp(storeId, phoneRaw, code)

    const phoneAccessToken = randomBytes(24).toString('hex')
    const payload: PhoneAccessPayload = { phone, storeId }
    const accessKey = phoneAccessKey(phoneAccessToken)
    const stored = await this.setJsonWithTtl(accessKey, payload, PHONE_ACCESS_TTL_SEC)
    if (!stored) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException(
          'Phone verification is temporarily unavailable. Sign in or try again later.',
        )
      }
      memoryPhoneAccess.set(phoneAccessToken, {
        ...payload,
        exp: Date.now() + PHONE_ACCESS_TTL_SEC * 1000,
      })
    }

    return {
      phoneAccessToken,
      expiresAt: new Date(Date.now() + PHONE_ACCESS_TTL_SEC * 1000).toISOString(),
    }
  }

  /** Validate and consume an OTP — used by signup phone completion and order tracking. */
  async assertValidOtp(storeId: string, phoneRaw: string, code: string): Promise<string> {
    if (!isStorefrontPhoneOtpEnabled()) {
      throw new BadRequestException('Phone verification is not enabled yet')
    }
    const phone = normalizePhone(phoneRaw)
    const key = otpKey(storeId, phone)
    const expected =
      (await this.getJson<{ code: string }>(key))?.code ?? memoryOtp.get(key)?.code

    if (!expected || expected !== code.trim()) {
      throw new UnauthorizedException('Invalid or expired verification code')
    }

    await this.redis.del(key)
    memoryOtp.delete(key)
    return phone
  }

  async assertPhoneAccess(
    storeId: string,
    phoneRaw: string,
    phoneAccessToken?: string,
    sessionPhone?: string | null,
  ): Promise<void> {
    const phone = normalizePhone(phoneRaw)

    if (sessionPhone && normalizePhone(sessionPhone) === phone) return

    if (!isStorefrontPhoneOtpEnabled()) {
      throw new UnauthorizedException('Sign in to view orders for this phone number')
    }

    if (!phoneAccessToken?.trim()) {
      throw new UnauthorizedException('Phone verification required')
    }

    const accessKey = phoneAccessKey(phoneAccessToken)
    const payload =
      (await this.getJson<PhoneAccessPayload>(accessKey)) ??
      (() => {
        const mem = memoryPhoneAccess.get(phoneAccessToken)
        if (!mem || mem.exp < Date.now()) return null
        return { phone: mem.phone, storeId: mem.storeId }
      })()

    if (!payload || payload.storeId !== storeId || normalizePhone(payload.phone) !== phone) {
      throw new UnauthorizedException('Phone verification expired — request a new code')
    }
  }

  private async setJsonWithTtl(key: string, value: unknown, ttlSec: number): Promise<boolean> {
    if (!this.redis.isReady) return false
    try {
      await this.redis.setJson(key, value, ttlSec)
      return true
    } catch {
      return false
    }
  }

  private async getJson<T>(key: string): Promise<T | null> {
    if (!this.redis.isReady) return null
    try {
      return await this.redis.getJson<T>(key)
    } catch {
      return null
    }
  }
}

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma.service'

export interface SmsResult {
  sent: boolean
  provider?: string
  error?: string
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async send(phone: string, message: string, storeId?: string): Promise<SmsResult> {
    const normalizedPhone = this.normalizePhone(phone)
    if (!normalizedPhone) {
      return { sent: false, error: `Invalid phone: ${phone}` }
    }

    const settings = storeId
      ? await this.prisma.siteSettings.findUnique({ where: { storeId }, select: { smsEnabled: true } })
      : null

    if (settings && !settings.smsEnabled) {
      return { sent: false, error: 'SMS disabled for this store' }
    }

    // Try BDBulkSMS first (most popular in Bangladesh)
    const bdbulkKey = this.config.get<string>('BDBULKSMS_API_KEY')
    const bdbulkSenderId = this.config.get<string>('BDBULKSMS_SENDER_ID') ?? 'SPLARO'
    if (bdbulkKey) {
      return this.sendViaBdBulkSms(normalizedPhone, message, bdbulkKey, bdbulkSenderId)
    }

    // Fallback: SMSQ / ElitBuzz
    const elitbuzzToken = this.config.get<string>('ELITBUZZ_API_TOKEN')
    const elitbuzzSender = this.config.get<string>('ELITBUZZ_SENDER_ID') ?? 'SPLARO'
    if (elitbuzzToken) {
      return this.sendViaElitBuzz(normalizedPhone, message, elitbuzzToken, elitbuzzSender)
    }

    // Fallback: GreenWeb SMS
    const greenwebUser = this.config.get<string>('GREENWEB_SMS_USER')
    const greenwebPass = this.config.get<string>('GREENWEB_SMS_PASS')
    if (greenwebUser && greenwebPass) {
      return this.sendViaGreenWeb(normalizedPhone, message, greenwebUser, greenwebPass)
    }

    this.logger.warn(`No SMS provider configured. Set BDBULKSMS_API_KEY, ELITBUZZ_API_TOKEN, or GREENWEB_SMS_USER/PASS`)
    return { sent: false, error: 'No SMS provider configured' }
  }

  async sendBulk(phones: string[], message: string, storeId?: string): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(phones.map((p) => this.send(p, message, storeId)))
    const sent = results.filter((r) => r.status === 'fulfilled' && r.value.sent).length
    return { sent, failed: phones.length - sent }
  }

  private async sendViaBdBulkSms(phone: string, message: string, apiKey: string, senderId: string): Promise<SmsResult> {
    try {
      const params = new URLSearchParams({
        api_key: apiKey,
        type: 'text',
        contacts: phone,
        senderid: senderId,
        msg: message,
      })

      const res = await fetch(`https://bulksmsbd.net/api/smsapi?${params.toString()}`, {
        signal: AbortSignal.timeout(10_000),
      })

      const text = await res.text()
      this.logger.debug(`BDBulkSMS response: ${text}`)

      if (text.includes('1001') || text.includes('success') || text.toLowerCase().includes('ok')) {
        return { sent: true, provider: 'bdbulksms' }
      }

      return { sent: false, provider: 'bdbulksms', error: text.slice(0, 100) }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'BDBulkSMS error'
      this.logger.error(msg)
      return { sent: false, provider: 'bdbulksms', error: msg }
    }
  }

  private async sendViaElitBuzz(phone: string, message: string, token: string, senderId: string): Promise<SmsResult> {
    try {
      const res = await fetch('https://msg.elitbuzz-bd.com/smsapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: token,
          type: 'text',
          contacts: phone,
          senderid: senderId,
          msg: message,
        }),
        signal: AbortSignal.timeout(10_000),
      })

      const data = (await res.json().catch(() => ({}))) as { response_code?: number; error_message?: string }
      if (data.response_code === 202) {
        return { sent: true, provider: 'elitbuzz' }
      }
      return { sent: false, provider: 'elitbuzz', error: data.error_message ?? `Code ${data.response_code ?? 'unknown'}` }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ElitBuzz error'
      this.logger.error(msg)
      return { sent: false, provider: 'elitbuzz', error: msg }
    }
  }

  private async sendViaGreenWeb(phone: string, message: string, user: string, password: string): Promise<SmsResult> {
    try {
      const params = new URLSearchParams({ user, password, to: phone, text: message })
      const res = await fetch(`https://api.greenweb.com.bd/api.php?${params.toString()}`, {
        signal: AbortSignal.timeout(10_000),
      })
      const text = await res.text()
      if (text.startsWith('OK') || text.includes('ok')) {
        return { sent: true, provider: 'greenweb' }
      }
      return { sent: false, provider: 'greenweb', error: text.slice(0, 100) }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'GreenWeb SMS error'
      this.logger.error(msg)
      return { sent: false, provider: 'greenweb', error: msg }
    }
  }

  private normalizePhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '')
    // BD mobile: 01XXXXXXXXX (11 digits) or 8801XXXXXXXXX (13 digits)
    if (digits.length === 11 && digits.startsWith('01')) return `88${digits}`
    if (digits.length === 13 && digits.startsWith('880')) return digits
    if (digits.length === 10 && digits.startsWith('1')) return `880${digits}`
    return null
  }
}

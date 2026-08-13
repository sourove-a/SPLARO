import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { SmsIntegrationService, type SmsRuntimeCredentials } from '../integrations/sms-integration.service'

export interface SmsResult {
  sent: boolean
  provider?: string
  error?: string
}

/** BDBulkSMS error codes — 1001 is Invalid Number, not success. */
const BDBULK_FAIL = /^(100[1-9]|101[0-4])\b/

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsIntegration: SmsIntegrationService,
  ) {}

  async send(phone: string, message: string, storeId?: string): Promise<SmsResult> {
    const normalizedPhone = this.normalizePhone(phone)
    if (!normalizedPhone) {
      return { sent: false, error: `Invalid phone: ${phone}` }
    }

    let sid: string | undefined
    try {
      sid = storeId ? await resolveStoreId(this.prisma, storeId) : await resolveStoreId(this.prisma)
    } catch {
      sid = storeId?.trim() || undefined
    }

    const runtime = await this.smsIntegration.resolveRuntime(sid)

    if (!runtime.enabled) {
      return this.finish(sid, normalizedPhone, message, {
        sent: false,
        error: 'SMS disabled for this store',
      })
    }

    if (runtime.configured) {
      const result = await this.dispatch(normalizedPhone, message, runtime)
      return this.finish(sid, normalizedPhone, message, result)
    }

    this.logger.warn(
      'No SMS provider configured. Save API key + URL in SMS Center, or set BDBULKSMS_API_KEY / ELITBUZZ_API_TOKEN / GREENWEB_SMS_USER.',
    )
    return this.finish(sid, normalizedPhone, message, {
      sent: false,
      error: 'No SMS provider configured — add API key and link in SMS Center',
    })
  }

  async sendBulk(phones: string[], message: string, storeId?: string): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(phones.map((p) => this.send(p, message, storeId)))
    const sent = results.filter((r) => r.status === 'fulfilled' && r.value.sent).length
    return { sent, failed: phones.length - sent }
  }

  private async dispatch(
    phone: string,
    message: string,
    creds: SmsRuntimeCredentials,
  ): Promise<SmsResult> {
    if (creds.gateway === 'greenweb') {
      return this.sendViaGreenWeb(phone, message, creds)
    }
    if (creds.gateway === 'elitbuzz') {
      return this.sendViaElitBuzz(phone, message, creds)
    }
    if (creds.gateway === 'custom') {
      return this.sendViaCustom(phone, message, creds)
    }
    return this.sendViaBdBulkSms(phone, message, creds)
  }

  private async sendViaBdBulkSms(
    phone: string,
    message: string,
    creds: SmsRuntimeCredentials,
  ): Promise<SmsResult> {
    try {
      const params = new URLSearchParams({
        api_key: creds.apiKey,
        type: 'text',
        contacts: phone,
        senderid: creds.senderId,
        msg: message,
      })
      const base = creds.apiUrl || 'https://bulksmsbd.net/api/smsapi'
      const url = base.includes('?') ? `${base}&${params}` : `${base}?${params}`
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      const text = (await res.text()).trim()
      this.logger.debug(`BDBulkSMS response: ${text}`)

      if (BDBULK_FAIL.test(text)) {
        return { sent: false, provider: 'bdbulksms', error: this.bdBulkError(text) }
      }
      if (text === '202' || /^sms submitted/i.test(text) || /"response_code"\s*:\s*202/.test(text)) {
        return { sent: true, provider: 'bdbulksms' }
      }
      if (/success|\bok\b/i.test(text) && !BDBULK_FAIL.test(text)) {
        return { sent: true, provider: 'bdbulksms' }
      }
      return { sent: false, provider: 'bdbulksms', error: text.slice(0, 160) || `HTTP ${res.status}` }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'BDBulkSMS error'
      this.logger.error(msg)
      return { sent: false, provider: 'bdbulksms', error: msg }
    }
  }

  private bdBulkError(code: string): string {
    const map: Record<string, string> = {
      '1001': 'Invalid number',
      '1002': 'Sender ID not approved',
      '1003': 'Required fields missing',
      '1004': 'SMS type invalid',
      '1005': 'Invalid API key',
      '1006': 'Account inactive',
      '1007': 'Insufficient balance',
      '1008': 'Message contains spam word',
      '1009': 'Message too long',
      '1010': 'Template mismatch',
      '1011': 'IP not allowed',
      '1012': 'Schedule time invalid',
    }
    const key = code.slice(0, 4)
    return map[key] ? `${map[key]} (${key})` : code.slice(0, 160)
  }

  private async sendViaElitBuzz(
    phone: string,
    message: string,
    creds: SmsRuntimeCredentials,
  ): Promise<SmsResult> {
    try {
      const res = await fetch(creds.apiUrl || 'https://msg.elitbuzz-bd.com/smsapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: creds.apiKey,
          type: 'text',
          contacts: phone,
          senderid: creds.senderId,
          msg: message,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      const data = (await res.json().catch(() => ({}))) as { response_code?: number; error_message?: string }
      if (data.response_code === 202) {
        return { sent: true, provider: 'elitbuzz' }
      }
      return {
        sent: false,
        provider: 'elitbuzz',
        error: data.error_message ?? `Code ${data.response_code ?? res.status}`,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ElitBuzz error'
      this.logger.error(msg)
      return { sent: false, provider: 'elitbuzz', error: msg }
    }
  }

  private async sendViaGreenWeb(
    phone: string,
    message: string,
    creds: SmsRuntimeCredentials,
  ): Promise<SmsResult> {
    try {
      const params = new URLSearchParams({
        user: creds.username,
        password: creds.password,
        to: phone,
        text: message,
      })
      const base = creds.apiUrl || 'https://api.greenweb.com.bd/api.php'
      const url = base.includes('?') ? `${base}&${params}` : `${base}?${params}`
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      const text = (await res.text()).trim()
      if (/^ok/i.test(text) || text.toLowerCase().includes('ok:')) {
        return { sent: true, provider: 'greenweb' }
      }
      return { sent: false, provider: 'greenweb', error: text.slice(0, 160) || `HTTP ${res.status}` }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'GreenWeb SMS error'
      this.logger.error(msg)
      return { sent: false, provider: 'greenweb', error: msg }
    }
  }

  private async sendViaCustom(
    phone: string,
    message: string,
    creds: SmsRuntimeCredentials,
  ): Promise<SmsResult> {
    try {
      const payload = {
        api_key: creds.apiKey,
        type: 'text',
        contacts: phone,
        senderid: creds.senderId,
        msg: message,
        to: phone,
        text: message,
      }
      let res: Response
      if (creds.method === 'POST') {
        res = await fetch(creds.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(12_000),
        })
      } else {
        const params = new URLSearchParams({
          api_key: creds.apiKey,
          type: 'text',
          contacts: phone,
          senderid: creds.senderId,
          msg: message,
        })
        const url = creds.apiUrl.includes('?') ? `${creds.apiUrl}&${params}` : `${creds.apiUrl}?${params}`
        res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
      }
      const text = (await res.text()).trim()
      if (!res.ok) {
        return { sent: false, provider: 'custom', error: text.slice(0, 160) || `HTTP ${res.status}` }
      }
      if (BDBULK_FAIL.test(text)) {
        return { sent: false, provider: 'custom', error: text.slice(0, 160) }
      }
      if (/invalid|unauthorized|forbidden|error/i.test(text) && !/success|submitted|\bok\b/i.test(text)) {
        return { sent: false, provider: 'custom', error: text.slice(0, 160) }
      }
      return { sent: true, provider: 'custom' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Custom SMS gateway error'
      this.logger.error(msg)
      return { sent: false, provider: 'custom', error: msg }
    }
  }

  private async finish(
    storeId: string | undefined,
    phone: string,
    message: string,
    result: SmsResult,
  ): Promise<SmsResult> {
    if (!storeId) return result
    try {
      await this.prisma.notificationDeliveryLog.create({
        data: {
          storeId,
          channel: 'SMS',
          recipient: phone,
          subject: result.provider ?? 'sms',
          body: message.slice(0, 1000),
          status: result.sent ? 'SENT' : 'FAILED',
          level: result.sent ? 'info' : 'warn',
          errorMsg: result.error?.slice(0, 500) ?? null,
        },
      })
    } catch (err) {
      this.logger.warn(
        `SMS log persist failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
    }
    return result
  }

  private normalizePhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 11 && digits.startsWith('01')) return `88${digits}`
    if (digits.length === 13 && digits.startsWith('880')) return digits
    if (digits.length === 10 && digits.startsWith('1')) return `880${digits}`
    return null
  }
}

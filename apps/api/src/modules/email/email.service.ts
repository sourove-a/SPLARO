import { Injectable, Logger, Optional } from '@nestjs/common'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { PrismaService } from '../../common/prisma.service'
import { mergeStorefrontConfig, type SmtpConfig } from '../settings/storefront-config'
import { GoogleGmailService } from '../google-workspace/google-gmail-drive.service'

export interface SendEmailInput {
  storeId: string
  to: string
  subject: string
  html: string
  text?: string
  /** Order receipts etc. — tries Gmail / env SMTP even when emailEnabled is off. */
  transactional?: boolean
  /**
   * Severity carried onto the delivery log row, which is what the admin
   * Notification Center paints. A failed purchase order needs chasing; a failed
   * marketing blast does not.
   */
  level?: 'info' | 'warn' | 'critical'
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly gmail?: GoogleGmailService,
  ) {}

  async sendForStore(input: SendEmailInput): Promise<boolean> {
    const to = input.to.trim()
    if (!to) return false

    const store = await this.prisma.store.findUnique({
      where: { id: input.storeId },
      include: { settings: true },
    })
    if (!store) return false

    const transactional = Boolean(input.transactional)
    if (!transactional && !store.settings?.emailEnabled) return false

    const smtpAccounts = this.resolveSmtpAccounts(store.settings?.storefrontConfig)
    for (const smtp of smtpAccounts) {
      const sent = await this.sendViaSmtp(smtp, store.name, input)
      if (sent) {
        // Only paperwork is logged on success. A campaign to 500 addresses
        // would otherwise write 500 rows and push every other notice out of
        // the 60-row window Notification Center reads.
        if (transactional) await this.recordDelivery(input, 'SENT', null)
        return true
      }
    }

    if (this.gmail) {
      try {
        const cfg = await this.gmail.getConfig(input.storeId)
        if (cfg.connected && cfg.senderEmail) {
          // GoogleGmailService writes its own delivery-log row on success, so
          // recording here again would double every Gmail-sent message.
          await this.gmail.sendEmail(
            input.storeId,
            { to, subject: input.subject, html: input.html, template: 'transactional' },
            'order_notification',
          )
          return true
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gmail send failed'
        this.logger.warn(`Gmail fallback for ${to} failed: ${message}`)
      }
    }

    const reason = smtpAccounts.length
      ? 'Every configured SMTP account rejected the send'
      : 'No SMTP account or Gmail connection is configured'
    this.logger.warn(
      transactional
        ? `Transactional email to ${to} failed — no SMTP/Gmail for store ${input.storeId}`
        : `SMTP not configured for store ${input.storeId}`,
    )
    await this.recordDelivery(input, 'FAILED', reason)
    return false
  }

  /**
   * Leave a row so an operator can answer "did the supplier actually get it?"
   * without reading server logs.
   *
   * Written for every failure, and for transactional successes only — see the
   * call sites for why a successful campaign send is deliberately not logged.
   *
   * Deliberately swallows its own errors: a delivery log that cannot be written
   * must never turn a mail that did go out into a thrown request.
   */
  private async recordDelivery(
    input: SendEmailInput,
    status: 'SENT' | 'FAILED',
    errorMsg: string | null,
  ): Promise<void> {
    try {
      await this.prisma.notificationDeliveryLog.create({
        data: {
          storeId: input.storeId,
          channel: 'EMAIL',
          recipient: input.to.trim(),
          subject: input.subject,
          status,
          level: input.level ?? (status === 'FAILED' ? 'warn' : 'info'),
          ...(errorMsg ? { errorMsg } : {}),
        },
      })
    } catch (err) {
      this.logger.warn(
        `Could not record email delivery for ${input.to}: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  private async sendViaSmtp(
    smtp: SmtpConfig,
    storeName: string,
    input: SendEmailInput,
  ): Promise<boolean> {
    try {
      const transport = this.createTransport(smtp)
      const result = await transport.sendMail({
        from: `"${smtp.fromName || storeName}" <${smtp.fromEmail || smtp.user}>`,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: smtp.replyTo || smtp.fromEmail || undefined,
      })
      const accepted = Array.isArray(result.accepted)
        ? result.accepted.map((address) => String(address).toLowerCase())
        : []
      const recipient = input.to.trim().toLowerCase()
      if (accepted.length > 0 && !accepted.includes(recipient)) {
        this.logger.error(`SMTP did not accept recipient ${input.to}`)
        return false
      }
      return accepted.length > 0
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email send failed'
      this.logger.error(`Email to ${input.to} failed: ${message}`)
      return false
    }
  }

  private resolveSmtp(storefrontConfig: unknown): SmtpConfig | null {
    const fromSettings = mergeStorefrontConfig(storefrontConfig).smtp
    const host = process.env.SMTP_HOST?.trim()
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASS?.trim()

    if (fromSettings?.host && fromSettings.user && fromSettings.password) {
      return { ...fromSettings, enabled: fromSettings.enabled !== false }
    }

    if (host && user && pass) {
      return {
        enabled: true,
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user,
        password: pass,
        fromName: process.env.SMTP_FROM_NAME?.trim() || 'SPLARO',
        fromEmail: process.env.SMTP_FROM_EMAIL?.trim() || user,
        replyTo: process.env.SMTP_REPLY_TO?.trim() || '',
      }
    }

    return fromSettings ?? null
  }

  private resolveSmtpAccounts(storefrontConfig: unknown): SmtpConfig[] {
    const config = mergeStorefrontConfig(storefrontConfig)
    const pool = (config.smtpAccounts ?? [])
      .filter((account) => account.enabled && account.host && account.user && account.password)
      .sort((a, b) => a.priority - b.priority)
    if (pool.length > 0) return pool
    const single = this.resolveSmtp(storefrontConfig)
    return single?.enabled && single.host && single.user && single.password ? [single] : []
  }

  async verifySmtp(storeId: string, accountId?: string): Promise<{ ok: boolean; message: string }> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { settings: true },
    })
    const config = mergeStorefrontConfig(store?.settings?.storefrontConfig)
    const smtp = accountId
      ? config.smtpAccounts?.find((account) => account.id === accountId) ?? null
      : this.resolveSmtpAccounts(store?.settings?.storefrontConfig)[0] ?? null
    if (!smtp?.host || !smtp.user || !smtp.password) {
      return { ok: false, message: 'SMTP host, user and password are required.' }
    }

    try {
      const transport = this.createTransport(smtp)
      await transport.verify()
      return { ok: true, message: 'SMTP connection verified.' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SMTP verification failed'
      return { ok: false, message }
    }
  }

  private createTransport(smtp: SmtpConfig): Transporter {
    return nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: Boolean(smtp.secure),
      auth: {
        user: smtp.user,
        pass: smtp.password,
      },
    })
  }
}

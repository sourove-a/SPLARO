import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { EncryptionService } from './encryption.service'
import { IntegrationAuditService } from './integration-audit.service'
import { IntegrationsService } from './integrations.service'
import { AuthService } from '../auth/auth.service'
import { TelegramService } from '../telegram/telegram.service'
import { maskTelegramId } from '../telegram/telegram.util'

export interface TelegramIntegrationDto {
  botToken?: string
  chatId: string
  isEnabled: boolean
  notifyOrders: boolean
  notifyCustomers: boolean
  notifyPayments: boolean
  notifyCourier: boolean
  notifyStock: boolean
  notifyReviews: boolean
  reportDaily: boolean
  reportTime: string
}

@Injectable()
export class TelegramIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly crypto: EncryptionService,
    private readonly audit: IntegrationAuditService,
    private readonly auth: AuthService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramBot: TelegramService,
  ) {}

  async get(storeIdRaw: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const tg = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    const tokenSaved = await this.integrations.hasSecret(storeId, 'telegram', 'botToken')
    const meta = await this.integrations.getProviderMeta(storeId, 'telegram')

    return {
      botToken: tokenSaved ? '••••••••' : null,
      tokenConfigured: tokenSaved || Boolean(tg?.botToken && tg.botToken !== 'pending'),
      chatId: tg?.chatId ?? '',
      isEnabled: tg?.isActive ?? false,
      notifyOrders: tg?.notifyOrders ?? true,
      notifyCustomers: tg?.notifyCustomers ?? true,
      notifyPayments: tg?.notifyPayments ?? true,
      notifyCourier: tg?.notifyCourier ?? true,
      notifyStock: tg?.notifyStock ?? true,
      notifyReviews: tg?.notifyReviews ?? true,
      reportDaily: tg?.reportDaily ?? true,
      reportTime: tg?.reportTime ?? '09:00',
      lastTestedAt: meta.lastTestedAt,
      lastTestStatus: meta.lastTestStatus,
      lastTestMessage: meta.lastTestMessage,
      updatedAt: tg?.updatedAt?.toISOString() ?? null,
    }
  }

  async update(storeIdRaw: string, body: TelegramIntegrationDto, userId?: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const existing = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    const tokenSaved = await this.integrations.hasSecret(storeId, 'telegram', 'botToken')

    const newToken = body.botToken?.trim()
    if (newToken && !this.crypto.isMaskedInput(newToken)) {
      await this.integrations.upsertSecret({
        storeId,
        provider: 'telegram',
        key: 'botToken',
        plain: newToken,
        userId,
      })
    } else if (!tokenSaved && !existing?.botToken) {
      throw new BadRequestException('Bot token is required')
    }

    if (!body.chatId?.trim()) {
      throw new BadRequestException('Chat ID is required')
    }

    let botTokenPlain = newToken && !this.crypto.isMaskedInput(newToken)
      ? newToken
      : (await this.integrations.getPlain(storeId, 'telegram', 'botToken')) ??
        (existing?.botToken ? this.crypto.decrypt(existing.botToken) : null)

    if (!botTokenPlain) {
      throw new BadRequestException('Bot token is required')
    }

    const encryptedToken = this.crypto.encrypt(botTokenPlain)

    await this.prisma.telegramConfig.upsert({
      where: { storeId },
      create: {
        storeId,
        botToken: encryptedToken,
        chatId: body.chatId.trim(),
        isActive: body.isEnabled,
        notifyOrders: body.notifyOrders,
        notifyCustomers: body.notifyCustomers,
        notifyPayments: body.notifyPayments,
        notifyCourier: body.notifyCourier,
        notifyStock: body.notifyStock,
        notifyReviews: body.notifyReviews,
        reportDaily: body.reportDaily,
        reportTime: body.reportTime || '09:00',
      },
      update: {
        botToken: encryptedToken,
        chatId: body.chatId.trim(),
        isActive: body.isEnabled,
        notifyOrders: body.notifyOrders,
        notifyCustomers: body.notifyCustomers,
        notifyPayments: body.notifyPayments,
        notifyCourier: body.notifyCourier,
        notifyStock: body.notifyStock,
        notifyReviews: body.notifyReviews,
        reportDaily: body.reportDaily,
        reportTime: body.reportTime || '09:00',
      },
    })

    await this.prisma.siteSettings.upsert({
      where: { storeId },
      create: { storeId, telegramEnabled: body.isEnabled },
      update: { telegramEnabled: body.isEnabled },
    })

    await this.integrations.upsertPlain({ storeId, provider: 'telegram', key: 'chatId', value: body.chatId.trim(), userId })
    for (const [key, val] of Object.entries({
      isEnabled: body.isEnabled,
      notifyOrders: body.notifyOrders,
      notifyCustomers: body.notifyCustomers,
      notifyPayments: body.notifyPayments,
      notifyCourier: body.notifyCourier,
      notifyStock: body.notifyStock,
      notifyReviews: body.notifyReviews,
      reportDaily: body.reportDaily,
      reportTime: body.reportTime || '09:00',
    })) {
      await this.integrations.upsertPlain({ storeId, provider: 'telegram', key, value: val, userId })
    }

    await this.audit.logSave({
      storeId,
      userId,
      provider: 'telegram',
      resource: 'telegram_integration',
      newData: {
        chatId: body.chatId,
        isEnabled: body.isEnabled,
        tokenUpdated: Boolean(newToken && !this.crypto.isMaskedInput(newToken)),
      },
    })

    void this.telegramBot.reinitializeBot()

    return this.get(storeId)
  }

  async resolveRuntimeConfig(storeId: string) {
    const tg = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!tg) return null
    let token: string | null = null
    try {
      token = tg.botToken ? this.crypto.decrypt(tg.botToken) : null
    } catch {
      token = tg.botToken
    }
    if (!token) {
      token = (await this.integrations.getPlain(storeId, 'telegram', 'botToken')) ?? null
    }
    return { token, chatId: tg.chatId, isActive: tg.isActive }
  }

  async test(storeIdRaw: string, userId?: string, message?: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const cfg = await this.resolveRuntimeConfig(storeId)

    if (!cfg?.token) {
      throw new BadRequestException('Bot token not configured. Save token first.')
    }
    if (!cfg.chatId) {
      throw new BadRequestException('Chat ID not configured.')
    }

    const text = (message ?? '✅ SPLARO — Telegram connected successfully.').slice(0, 4000)
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.chatId, text }),
    })

    const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string }
    if (!res.ok || !payload.ok) {
      const errMsg = payload.description ?? `Telegram API error (${res.status})`
      await this.integrations.recordTest({ storeId, provider: 'telegram', success: false, message: errMsg, userId })
      await this.audit.logTest({ storeId, userId, provider: 'telegram', success: false, message: errMsg })
      throw new BadRequestException(errMsg)
    }

    await this.integrations.recordTest({
      storeId,
      provider: 'telegram',
      success: true,
      message: 'Telegram connected successfully',
      userId,
    })
    await this.audit.logTest({ storeId, userId, provider: 'telegram', success: true, message: 'Telegram connected successfully' })

    return { ok: true, message: 'Telegram connected successfully', chatId: cfg.chatId }
  }

  async getHealth(storeIdRaw: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const health = await this.telegramBot.getHealth(storeId)
    const meta = await this.integrations.getProviderMeta(storeId, 'telegram')
    return {
      ...health,
      lastTestedAt: meta.lastTestedAt,
      lastTestStatus: meta.lastTestStatus,
      lastTestMessage: meta.lastTestMessage,
    }
  }

  async generateLinkToken(storeIdRaw: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const cfg = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!cfg?.isActive) {
      throw new BadRequestException('Enable Telegram bot in settings before generating a link token.')
    }

    const { code, email } = await this.auth.issueTelegramLoginToken(storeId)
    return {
      ok: true,
      code,
      email,
      expiresInSeconds: 300,
      hint: `Open your SPLARO bot and send: /login ${code}`,
    }
  }

  async listLinkedAdmins(storeIdRaw: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const config = await this.prisma.telegramConfig.findUnique({
      where: { storeId },
      include: { users: { where: { isActive: true }, orderBy: { createdAt: 'asc' } } },
    })
    if (!config) {
      return { linked: [], configChatIdMasked: null }
    }
    return {
      configChatIdMasked: config.chatId ? maskTelegramId(config.chatId) : null,
      linked: config.users.map((u) => ({
        id: u.id,
        telegramIdMasked: maskTelegramId(u.telegramId),
        username: u.username,
        role: u.role,
      })),
    }
  }

  async unlinkAdmin(storeIdRaw: string, telegramUserId: string, userId?: string) {
    const storeId = await this.integrations.resolveStore(storeIdRaw)
    const config = await this.prisma.telegramConfig.findUnique({ where: { storeId } })
    if (!config) throw new BadRequestException('Telegram not configured')

    const row = await this.prisma.telegramUser.findFirst({
      where: { id: telegramUserId, configId: config.id },
    })
    if (!row) throw new BadRequestException('Linked admin not found')

    await this.prisma.telegramUser.update({
      where: { id: row.id },
      data: { isActive: false },
    })

    await this.audit.logSave({
      storeId,
      userId,
      provider: 'telegram',
      resource: 'telegram_unlink',
      newData: { telegramUserId: row.id, telegramIdMasked: maskTelegramId(row.telegramId) },
    })

    return { ok: true }
  }
}

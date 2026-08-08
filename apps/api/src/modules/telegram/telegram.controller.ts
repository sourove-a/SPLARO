import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { timingSafeEqual } from 'node:crypto'
import { Public } from '../../common/auth/public.decorator'
import { TelegramService } from '../telegram/telegram.service'

function webhookSecretsEqual(provided: string | undefined, expected: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

@Public()
@Controller('telegram-webhook')
export class TelegramWebhookController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async handleWebhook(
    @Body() body: unknown,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    const expected = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET')?.trim()
    if (!expected) {
      throw new UnauthorizedException('Telegram webhook secret is not configured')
    }
    if (!webhookSecretsEqual(secret, expected)) {
      throw new UnauthorizedException('Invalid webhook secret')
    }
    await this.telegram.handleWebhookUpdate(body)
    return { ok: true }
  }
}

@Controller('telegram')
export class TelegramFinanceController {
  constructor(private readonly telegram: TelegramService) {}

  @Post('test')
  test(@Body() body: { storeId: string; message: string }) {
    return this.telegram.sendToStore(body.storeId, body.message)
  }

  @Post('confirm-order')
  confirmOrder(
    @Body() body: { storeId: string; invoiceNumber: string; chatId?: string },
  ) {
    return this.telegram.confirmOrderAndSendInvoice(
      body.storeId,
      body.chatId ?? '',
      body.invoiceNumber,
    )
  }
}

import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Public } from '../../common/auth/public.decorator'
import { TelegramService } from '../telegram/telegram.service'

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
    const expected = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET')
    if (expected && secret !== expected) {
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

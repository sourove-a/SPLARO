import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@splaro/database'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  async onModuleInit() {
    try {
      await this.$connect()
      this.logger.log('Database connected')
    } catch (err) {
      this.logger.warn(
        `Database unavailable — API running degraded: ${err instanceof Error ? err.message : 'connection failed'}`,
      )
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}

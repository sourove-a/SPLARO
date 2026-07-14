import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@splaro/database'

function isProduction() {
  return process.env['NODE_ENV'] === 'production'
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)
  private dbConnected = false

  get isConnected(): boolean {
    return this.dbConnected
  }

  async onModuleInit() {
    const maxAttempts = Number(process.env['DB_CONNECT_RETRIES'] ?? (isProduction() ? 5 : 2))
    const delayMs = Number(process.env['DB_CONNECT_RETRY_MS'] ?? 1500)

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.$connect()
        await this.$queryRaw`SELECT 1`
        this.dbConnected = true
        this.logger.log('Database connected')
        return
      } catch (err) {
        const message = err instanceof Error ? err.message : 'connection failed'
        if (attempt < maxAttempts) {
          this.logger.warn(
            `Database connect attempt ${attempt}/${maxAttempts} failed: ${message} — retrying…`,
          )
          await sleep(delayMs * attempt)
          continue
        }

        if (isProduction()) {
          this.logger.error(`Database connection failed after ${maxAttempts} attempts: ${message}`)
          process.exit(1)
        }

        this.logger.error(
          `Database unavailable — API running degraded (dev only). Start Postgres or fix DATABASE_URL. Last error: ${message}`,
        )
      }
    }
  }

  async onModuleDestroy() {
    if (this.dbConnected) {
      await this.$disconnect()
    }
  }
}

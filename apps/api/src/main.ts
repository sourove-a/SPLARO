import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import helmet from 'helmet'
import compression from 'compression'
import { AppModule } from './app.module'

function getCorsOrigins(): string[] {
  const raw =
    process.env['CORS_ORIGINS'] ??
    process.env['CORS_ORIGIN'] ??
    `${process.env['WEB_URL'] ?? 'http://localhost:3000'},${process.env['ADMIN_URL'] ?? 'http://localhost:3001'}`
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  })

  const logger = new Logger('Bootstrap')
  const port = process.env['API_PORT'] ?? process.env['PORT_API'] ?? 4000

  app.enableShutdownHooks()
  const http = app.getHttpAdapter().getInstance()
  http.set('trust proxy', Number(process.env['TRUST_PROXY_HOPS'] ?? '1'))
  app.use(compression())
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  )

  const corsOrigins = getCorsOrigins()
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Store-Id', 'X-Request-Id'],
  })

  app.setGlobalPrefix('api/v1')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
    }),
  )

  await app.listen(port)
  logger.log(`SPLARO API running on :${port}`)
  logger.log(`API prefix: /api/v1`)
  logger.log(`CORS origins: ${corsOrigins.join(', ')}`)
  logger.log(`Environment: ${process.env['NODE_ENV'] ?? 'development'}`)
  logger.log(`Redis cache: ${process.env['REDIS_ENABLED'] !== 'false' ? 'enabled' : 'disabled'}`)
}

bootstrap().catch((err: unknown) => {
  console.error('Bootstrap failed:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('[API] Unhandled rejection:', reason)
})

process.on('uncaughtException', (err) => {
  console.error('[API] Uncaught exception:', err)
})

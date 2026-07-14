import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import helmet from 'helmet'
import compression from 'compression'
import { AppModule } from './app.module'
import { resolveCorsOriginsFromEnv } from './common/cors-origins.util'

async function listenWithRetry(
  app: Awaited<ReturnType<typeof NestFactory.create>>,
  port: number | string,
  logger: Logger,
  attempts = 12,
) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await app.listen(port)
      return
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : ''
      if (code !== 'EADDRINUSE' || attempt === attempts) throw err
      logger.warn(`Port ${port} busy — retry ${attempt}/${attempts - 1}…`)
      await new Promise((resolve) => setTimeout(resolve, 350))
    }
  }
}

function getCorsOrigins(): string[] {
  return resolveCorsOriginsFromEnv()
}

function isProduction() {
  return process.env['NODE_ENV'] === 'production'
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

  // api.splaro.co/ → all routes live under /api/v1 (global prefix)
  http.get('/', (_req, res) => {
    res.redirect(302, '/api/v1/')
  })
  http.get('/api', (_req, res) => {
    res.redirect(302, '/api/v1/')
  })
  http.get('/api/', (_req, res) => {
    res.redirect(302, '/api/v1/')
  })

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
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Store-Id',
      'X-Request-Id',
      'x-splaro-session',
      'x-splaro-phone-access',
      'idempotency-key',
    ],
  })

  app.setGlobalPrefix('api/v1')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: isProduction(),
      forbidUnknownValues: isProduction(),
    }),
  )

  const swaggerEnabled =
    process.env['SWAGGER_ENABLED'] === 'true' || !isProduction()
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SPLARO API')
      .setDescription('SPLARO eCommerce platform REST API (v1)')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('health', 'Service health probes')
      .addTag('admin-auth', 'Admin authentication')
      .addTag('storefront', 'Customer storefront')
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api/v1/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    })
    logger.log('Swagger UI: /api/v1/docs')
  }

  await listenWithRetry(app, port, logger)
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

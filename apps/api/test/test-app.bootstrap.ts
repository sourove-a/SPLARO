import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/common/prisma.service'
import { RedisService } from '../src/common/redis.service'

const mockStore = {
  id: 'splaro',
  slug: 'splaro',
  name: 'SPLARO',
  logo: '',
  favicon: '',
  email: 'hello@splaro.co',
  phone: '',
  address: '',
  settings: {
    storefrontConfig: {},
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
    youtubeUrl: '',
    whatsappNumber: '',
    freeDeliveryThreshold: 0,
  },
}

export function createMockPrisma() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    store: {
      findFirst: jest.fn().mockResolvedValue({ id: 'splaro' }),
      findUnique: jest.fn().mockResolvedValue(mockStore),
    },
    product: { count: jest.fn().mockResolvedValue(0) },
    order: { count: jest.fn().mockResolvedValue(0) },
    siteSettings: {
      findUnique: jest.fn().mockResolvedValue({ storefrontConfig: {} }),
    },
  }
}

export function createMockRedis() {
  return {
    ping: jest.fn().mockResolvedValue(true),
    getJson: jest.fn().mockResolvedValue(null),
    setJson: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
    incrWithExpiry: jest.fn().mockResolvedValue(0),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
  }
}

export async function createE2eApp(): Promise<INestApplication> {
  process.env.NODE_ENV = 'test'
  process.env.REDIS_ENABLED = 'false'
  process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? 'test-session-secret'

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(createMockPrisma())
    .overrideProvider(RedisService)
    .useValue(createMockRedis())
    .compile()

  const app = moduleRef.createNestApplication()
  app.setGlobalPrefix('api/v1')
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  await app.init()
  return app
}

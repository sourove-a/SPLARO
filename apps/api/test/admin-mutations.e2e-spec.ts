import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { Test } from '@nestjs/testing'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/common/prisma.service'
import { RedisService } from '../src/common/redis.service'
import { CacheService } from '../src/common/cache.service'

const STORE_ID = 'splaro'

function createMutationMockPrisma() {
  let dhakaDeliveryCharge = 60
  let storefrontConfig: Record<string, unknown> = {}
  let categoryName = 'Men'
  let legalTitle = 'Terms of Service'

  const buildStore = () => ({
    id: STORE_ID,
    slug: 'splaro',
    name: 'SPLARO',
    email: 'hello@splaro.co',
    phone: '',
    domain: '',
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
    logo: '',
    favicon: '',
    description: '',
    address: '',
    settings: {
      storefrontConfig,
      instagramUrl: '',
      facebookUrl: '',
      tiktokUrl: '',
      youtubeUrl: '',
      whatsappNumber: '',
      freeDeliveryThreshold: 0,
      dhakaDeliveryCharge,
      outsideDhakaCharge: 120,
      codEnabled: true,
      bkashEnabled: true,
      sslcommerzEnabled: true,
      nagadEnabled: true,
      emailEnabled: true,
      facebookPixelId: '',
      googleAnalyticsId: '',
    },
  })

  return {
    state: {
      get dhakaDeliveryCharge() {
        return dhakaDeliveryCharge
      },
      get storefrontConfig() {
        return storefrontConfig
      },
      get categoryName() {
        return categoryName
      },
      get legalTitle() {
        return legalTitle
      },
    },
    prisma: {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      store: {
        findFirst: jest.fn().mockImplementation(async () => buildStore()),
        findUnique: jest.fn().mockImplementation(async () => buildStore()),
        update: jest.fn().mockResolvedValue(buildStore()),
      },
      telegramConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      newsletterSubscriber: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      siteSettings: {
        findUnique: jest.fn().mockImplementation(async () => ({
          storefrontConfig,
          dhakaDeliveryCharge,
          codEnabled: true,
          bkashEnabled: true,
          sslcommerzEnabled: true,
          nagadEnabled: true,
        })),
        upsert: jest.fn().mockImplementation(async ({ update, create }: { update?: Record<string, unknown>; create?: Record<string, unknown> }) => {
          if (update?.dhakaDeliveryCharge !== undefined) {
            dhakaDeliveryCharge = Number(update.dhakaDeliveryCharge)
          }
          if (update?.storefrontConfig) {
            storefrontConfig = update.storefrontConfig as Record<string, unknown>
          }
          if (create?.storefrontConfig) {
            storefrontConfig = create.storefrontConfig as Record<string, unknown>
          }
          return {
            storefrontConfig,
            dhakaDeliveryCharge,
          }
        }),
      },
      category: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cat-1', name: categoryName, storeId: STORE_ID }),
        update: jest.fn().mockImplementation(async ({ data }: { data: { name?: string } }) => {
          if (data.name) categoryName = data.name
          return { id: 'cat-1', name: categoryName, storeId: STORE_ID }
        }),
      },
      sitePage: {
        findUnique: jest.fn().mockImplementation(async ({ where }: { where: { storeId_slug?: { storeId: string; slug: string } } }) => {
          const slug = where.storeId_slug?.slug
          if (slug === 'terms') {
            return {
              id: 'page-terms',
              slug: 'terms',
              title: legalTitle,
              content: JSON.stringify({ title: legalTitle, description: 'Desc', sections: [{ heading: 'Intro', body: 'Body' }] }),
              metaTitle: legalTitle,
              metaDesc: 'Desc',
              updatedAt: new Date(),
              storeId: STORE_ID,
              isPublished: true,
            }
          }
          return null
        }),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockImplementation(async ({ create, update }: { create?: { content?: string; title?: string }; update?: { content?: string; title?: string } }) => {
          const raw = update?.content ?? create?.content
          if (raw) {
            const parsed = JSON.parse(raw) as { title?: string }
            if (parsed.title) legalTitle = parsed.title
          }
          if (update?.title) legalTitle = update.title
          if (create?.title) legalTitle = create.title
          return {
            id: 'page-terms',
            slug: 'terms',
            title: legalTitle,
            content: raw ?? JSON.stringify({ title: legalTitle, description: 'Desc', sections: [{ heading: 'Intro', body: 'Body' }] }),
            metaTitle: legalTitle,
            metaDesc: 'Desc',
            updatedAt: new Date(),
            storeId: STORE_ID,
            isPublished: true,
          }
        }),
      },
      product: { count: jest.fn().mockResolvedValue(0) },
      order: { count: jest.fn().mockResolvedValue(0) },
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    },
  }
}

describe('Admin mutations (e2e honesty)', () => {
  let app: INestApplication
  let mock: ReturnType<typeof createMutationMockPrisma>
  const invalidateSpy = jest.fn().mockResolvedValue(undefined)

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.API_AUTH_DISABLED = 'true'
    process.env.REDIS_ENABLED = 'false'
    process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? 'test-session-secret'

    mock = createMutationMockPrisma()

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mock.prisma)
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn().mockResolvedValue(true),
        getJson: jest.fn().mockResolvedValue(null),
        setJson: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
        incrWithExpiry: jest.fn().mockResolvedValue(0),
        onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(CacheService)
      .useValue({
        getOrSet: jest.fn().mockImplementation((_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
        storeKey: jest.fn().mockImplementation((storeId: string, ...parts: string[]) => `${storeId}:${parts.join(':')}`),
        invalidateStoreResource: invalidateSpy,
        purgeStore: invalidateSpy,
      })
      .compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    await app.init()
  })

  afterAll(async () => {
    delete process.env.API_AUTH_DISABLED
    await app.close()
  })

  it('PATCH /admin/settings — shipping charge persists in mock DB + returns verified value', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/admin/settings')
      .query({ storeId: STORE_ID })
      .send({ shipping: { dhakaDeliveryCharge: 75 } })
      .expect(200)

    expect(res.body.shipping?.dhakaDeliveryCharge).toBe(75)
    expect(mock.state.dhakaDeliveryCharge).toBe(75)
    expect(mock.prisma.siteSettings.upsert).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalled()
  })

  it('PATCH /admin/categories/:id — rename persists in mock DB', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/admin/categories/cat-1')
      .query({ storeId: STORE_ID })
      .send({ name: 'Menswear' })
      .expect(200)

    expect(res.body.name).toBe('Menswear')
    expect(mock.state.categoryName).toBe('Menswear')
  })

  it('PATCH /admin/settings — header nav persists in storefrontConfig JSON', async () => {
    const headerNav = [{ label: 'Shop', href: '/shop' }, { label: 'New', href: '/new' }]
    const res = await request(app.getHttpServer())
      .patch('/api/v1/admin/settings')
      .query({ storeId: STORE_ID })
      .send({ navigation: { headerNav } })
      .expect(200)

    expect(res.body.navigation?.headerNav?.slice(0, 2)).toEqual(headerNav)
    expect((mock.state.storefrontConfig as { headerNav?: unknown[] }).headerNav?.slice(0, 2)).toEqual(headerNav)
  })

  it('PUT /admin/content/legal-pages/terms — content title persists', async () => {
    const body = {
      title: 'Updated Terms',
      description: 'Desc',
      sections: [{ heading: 'Intro', body: 'Body' }],
    }
    const res = await request(app.getHttpServer())
      .put('/api/v1/admin/content/legal-pages/terms')
      .query({ storeId: STORE_ID })
      .send(body)
      .expect(200)

    expect(res.body.title).toBe('Updated Terms')
    expect(mock.state.legalTitle).toBe('Updated Terms')
  })

  it('PUT /admin/content/footwear — config persists in storefrontConfig', async () => {
    const footwear = { heroBanner: { title: 'DB Footwear' }, shopByCategory: { visible: true }, productRows: [] }
    const res = await request(app.getHttpServer())
      .put('/api/v1/admin/content/footwear')
      .query({ storeId: STORE_ID })
      .send(footwear)
      .expect(200)

    expect((res.body as { heroBanner?: { title?: string } }).heroBanner?.title).toBe('DB Footwear')
    expect((mock.state.storefrontConfig as { footwear?: { heroBanner?: { title?: string } } }).footwear?.heroBanner?.title).toBe(
      'DB Footwear',
    )
    expect(invalidateSpy).toHaveBeenCalled()
  })
})

import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createE2eApp } from './test-app.bootstrap'

describe('SPLARO API (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createE2eApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/v1 — API index', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/').expect(200)

    expect(res.body.service).toBe('splaro-api')
    expect(res.body.status).toBe('ok')
    expect(res.body.docs?.health).toBe('/api/v1/health')
  })

  it('GET /api/v1/health — liveness probe', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200)

    expect(res.body.status).toBe('ok')
    expect(res.body.database).toBe('connected')
  })

  it('GET /api/v1/health/full — infrastructure summary', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/full').expect(200)

    expect(res.body.service).toBe('splaro-api')
    expect(res.body.summary?.total).toBeGreaterThan(0)
    expect(Array.isArray(res.body.checks)).toBe(true)
  })

  it('GET /api/v1/storefront/settings — public storefront config', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/storefront/settings')
      .query({ storeId: 'splaro' })
      .expect(200)

    expect(res.body.store?.name).toBe('SPLARO')
    expect(res.body.shipping).toBeDefined()
  })

  it('POST /api/v1/admin/auth/login — rejects invalid email (ValidationPipe)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: 'not-an-email' })
      .expect(400)

    expect(res.body.statusCode).toBe(400)
    expect(res.body.path).toContain('/admin/auth/login')
    expect(res.body.timestamp).toBeDefined()
  })

  it('POST /api/v1/admin/auth/login — requires Telegram token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@splaro.co' })
      .expect(401)

    expect(res.body.statusCode).toBe(401)
    expect(res.body.message).toMatch(/Telegram login token required/i)
  })

  it('POST /api/v1/storefront/auth/otp/send — validates phone length', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/storefront/auth/otp/send')
      .query({ storeId: 'splaro' })
      .send({ phone: '123' })
      .expect(400)

    expect(res.body.statusCode).toBe(400)
    expect(Array.isArray(res.body.message) ? res.body.message.join(' ') : res.body.message).toMatch(
      /phone/i,
    )
  })

  const checkoutPayload = {
    customer: {
      name: 'Guest Buyer',
      phone: '123456',
      address: 'Test address',
      city: 'Dhaka',
      district: 'Dhaka',
    },
    items: [
      {
        productId: 'test-product',
        variantId: 'test-variant',
        quantity: 1,
        name: 'Test product',
        price: 100,
      },
    ],
    subtotal: 100,
    delivery: 60,
    discount: 0,
    total: 160,
    paymentMethod: 'Cash on Delivery',
  }

  it('POST /api/v1/storefront/orders — requires an idempotency key', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/storefront/orders')
      .query({ storeId: 'splaro' })
      .send(checkoutPayload)
      .expect(400)

    expect(res.body.message).toMatch(/idempotency key/i)
  })

  it('POST /api/v1/storefront/orders — guest digital payment fails closed', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/storefront/orders')
      .query({ storeId: 'splaro' })
      .set('Idempotency-Key', 'guest-digital-test-0001')
      .send({ ...checkoutPayload, paymentMethod: 'bKash' })
      .expect(401)

    expect(res.body.message).toMatch(/sign in/i)
  })

  it('POST /api/v1/storefront/orders — guest COD validates BD phone', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/storefront/orders')
      .query({ storeId: 'splaro' })
      .set('Idempotency-Key', 'guest-cod-phone-test-0001')
      .send(checkoutPayload)
      .expect(400)

    expect(res.body.message).toMatch(/bangladeshi mobile/i)
  })
})

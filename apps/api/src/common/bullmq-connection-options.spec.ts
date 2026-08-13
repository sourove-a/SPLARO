import { bullmqConnectionOptions } from './bullmq-connection-options'

describe('bullmqConnectionOptions', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('keeps blocking workers reconnect-safe', () => {
    process.env['REDIS_HOST'] = '127.0.0.2'
    process.env['REDIS_PORT'] = '6380'
    process.env['REDIS_PASSWORD'] = 'test-password'

    expect(bullmqConnectionOptions()).toEqual({
      host: '127.0.0.2',
      port: 6380,
      password: 'test-password',
      maxRetriesPerRequest: null,
      lazyConnect: true,
    })
    expect(bullmqConnectionOptions()).not.toHaveProperty('enableOfflineQueue')
  })
})

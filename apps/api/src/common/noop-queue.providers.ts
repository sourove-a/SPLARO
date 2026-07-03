import { getQueueToken } from '@nestjs/bullmq'

const QUEUE_NAMES = ['courier', 'invoices', 'sheets', 'ai-jobs', 'marketing', 'google-sync'] as const

/** In-memory no-op queues when REDIS_ENABLED=false (shared hosting without Redis). */
export function noopQueueProviders() {
  const noop = {
    add: async () => ({ id: 'noop' }),
    getJob: async () => null,
    close: async () => undefined,
  }

  return QUEUE_NAMES.map((name) => ({
    provide: getQueueToken(name),
    useValue: noop,
  }))
}

export const redisQueuesEnabled = () => process.env['REDIS_ENABLED'] !== 'false'

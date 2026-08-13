export function bullmqConnectionOptions() {
  return {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: Number.parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'] || undefined,
    // BullMQ workers use blocking Redis commands and manage reconnect retries.
    // Keep offline queuing enabled (ioredis default), otherwise every command
    // issued during a brief reconnect fails immediately and spins the worker.
    maxRetriesPerRequest: null,
    lazyConnect: true,
  }
}

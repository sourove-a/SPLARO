import { Global, Module } from '@nestjs/common'
import { RedisService } from './redis.service'
import { RedisThrottlerStorage } from './redis-throttler.storage'

/**
 * One Redis connection for the whole process.
 *
 * Global because `ThrottlerModule.forRootAsync` resolves its `inject` tokens
 * against its own injector — without this the throttler would have to build a
 * second RedisService and open a duplicate connection.
 */
@Global()
@Module({
  providers: [RedisService, RedisThrottlerStorage],
  exports: [RedisService, RedisThrottlerStorage],
})
export class RedisModule {}

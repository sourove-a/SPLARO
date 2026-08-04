import { Logger } from '@nestjs/common'

const logger = new Logger('FireAndForget')

/** Run a side-effect promise without blocking; log failures instead of unhandledRejection. */
export function fireAndForget(promise: Promise<unknown>, label: string): void {
  void promise.catch((err: unknown) => {
    logger.warn(`${label}: ${err instanceof Error ? err.message : 'unknown'}`)
  })
}

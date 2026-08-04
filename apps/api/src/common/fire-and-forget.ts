import { Logger } from '@nestjs/common'

const logger = new Logger('FireAndForget')

/** Run a side-effect promise without blocking; log failures instead of unhandledRejection. */
export function fireAndForget(
  promise: Promise<unknown> | undefined | null | void,
  label: string,
): void {
  if (!promise || typeof (promise as Promise<unknown>).then !== 'function') return
  void (promise as Promise<unknown>).catch((err: unknown) => {
    logger.warn(`${label}: ${err instanceof Error ? err.message : 'unknown'}`)
  })
}

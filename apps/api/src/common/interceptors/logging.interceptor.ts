import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { Observable, tap } from 'rxjs'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle()
    }

    const http = context.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()
    const started = Date.now()
    const requestId =
      (request.headers['x-request-id'] as string | undefined)?.trim() || '-'

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started
          const status = response.statusCode
          // Production: skip fast 2xx noise (was filling ~2GB api logs with every GET).
          // Still log errors, client faults, and slow responses.
          const quietSuccess =
            process.env.NODE_ENV === 'production' &&
            process.env.LOG_HTTP_SUCCESS !== '1' &&
            status < 400 &&
            ms < 1500
          if (quietSuccess) return
          const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'log'
          this.logger[level](
            `[${requestId}] ${request.method} ${request.url} ${status} ${ms}ms`,
          )
        },
        error: (err: unknown) => {
          const ms = Date.now() - started
          const status =
            err && typeof err === 'object' && 'status' in err
              ? Number((err as { status?: number }).status)
              : response.statusCode || 500
          this.logger.error(
            `[${requestId}] ${request.method} ${request.url} ${status} ${ms}ms (threw)`,
          )
        },
      }),
    )
  }
}

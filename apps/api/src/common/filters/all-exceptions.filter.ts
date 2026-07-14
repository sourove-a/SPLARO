import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'

type ErrorBody = {
  statusCode: number
  message: string | string[]
  error?: string
  path: string
  requestId?: string
  timestamp: string
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const requestId =
      (request.headers['x-request-id'] as string | undefined)?.trim() || undefined

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR
    let message: string | string[] = 'Internal server error'
    let error = 'Internal Server Error'

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus()
      const body = exception.getResponse()
      if (typeof body === 'string') {
        message = body
      } else if (body && typeof body === 'object') {
        const record = body as Record<string, unknown>
        if (typeof record.message === 'string' || Array.isArray(record.message)) {
          message = record.message as string | string[]
        }
        if (typeof record.error === 'string') {
          error = record.error
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || message
    }

    if (statusCode >= 500) {
      this.logger.error(
        `[${requestId ?? 'no-id'}] ${request.method} ${request.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    } else if (statusCode >= 400) {
      this.logger.warn(
        `[${requestId ?? 'no-id'}] ${request.method} ${request.url} → ${statusCode}: ${Array.isArray(message) ? message.join(', ') : message}`,
      )
    }

    const payload: ErrorBody = {
      statusCode,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
    }

    response.status(statusCode).json(payload)
  }
}

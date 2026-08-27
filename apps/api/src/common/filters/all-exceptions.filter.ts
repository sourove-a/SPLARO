import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common'
import { STATUS_CODES } from 'node:http'
import type { Request, Response } from 'express'
import { ServerErrorAlertService } from '../../modules/notifications/server-error-alert.service'

type ErrorBody = {
  statusCode: number
  message: string | string[]
  error?: string
  code?: string
  /** Per-field validation messages for admin forms, e.g. { sku: 'Already in use.' }. */
  fieldErrors?: Record<string, string>
  path: string
  requestId?: string
  timestamp: string
}

/** Stable machine-readable reasons clients branch on (e.g. phone_taken). */
const CODE_PATTERN = /^[a-z][a-z0-9_]{2,39}$/

function isProduction() {
  return process.env['NODE_ENV'] === 'production'
}

const GENERIC_5XX_MESSAGE = 'Internal server error'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  constructor(@Optional() private readonly alerts?: ServerErrorAlertService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const requestId =
      (request.headers['x-request-id'] as string | undefined)?.trim() || undefined

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR
    let message: string | string[] = 'Internal server error'
    // Only a default. Once the status is known it is re-derived below, otherwise
    // a 400 thrown with a structured payload reported "Internal Server Error".
    let error = 'Internal Server Error'
    let explicitError = false
    let code: string | undefined
    let fieldErrors: Record<string, string> | undefined

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
          explicitError = true
        }
        // Forwarded so admin forms can highlight the offending input rather than
        // only showing the summary message.
        if (record.fieldErrors && typeof record.fieldErrors === 'object') {
          const entries = Object.entries(record.fieldErrors as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          )
          if (entries.length) fieldErrors = Object.fromEntries(entries)
        }
        // Carry an explicit reason code through to the client. Only 4xx, and only
        // a slug — never an internal message that could leak query details.
        if (
          typeof record.code === 'string' &&
          statusCode < 500 &&
          CODE_PATTERN.test(record.code)
        ) {
          code = record.code
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || message
    }

    if (!explicitError) {
      error = STATUS_CODES[statusCode] ?? 'Internal Server Error'
    }

    if (statusCode >= 500) {
      this.logger.error(
        `[${requestId ?? 'no-id'}] ${request.method} ${request.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
      // A log line nobody is tailing is not an alert. Throttled downstream, so
      // a broken route pages the shop once rather than once per request.
      this.alerts?.report({
        method: request.method,
        url: request.url,
        statusCode,
        message: Array.isArray(message) ? message.join(', ') : message,
        ...(exception instanceof Error && exception.stack ? { stack: exception.stack } : {}),
        ...(requestId ? { requestId } : {}),
      })
    } else if (statusCode >= 400) {
      this.logger.warn(
        `[${requestId ?? 'no-id'}] ${request.method} ${request.url} → ${statusCode}: ${Array.isArray(message) ? message.join(', ') : message}`,
      )
    }

    // Unexpected errors carry Prisma model/column names and argument values in
    // their message. Those belong in the log line above, never in the response —
    // the requestId is what support correlates on. Kept verbatim in development.
    const clientMessage =
      statusCode >= 500 && isProduction() ? GENERIC_5XX_MESSAGE : message

    const payload: ErrorBody = {
      statusCode,
      message: clientMessage,
      error,
      ...(code ? { code } : {}),
      ...(fieldErrors && statusCode < 500 ? { fieldErrors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
    }

    response.status(statusCode).json(payload)
  }
}

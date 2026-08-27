import {
  BadRequestException,
  InternalServerErrorException,
  type ArgumentsHost,
} from '@nestjs/common'
import { AllExceptionsFilter } from './all-exceptions.filter'

function buildHost(headers: Record<string, string> = {}) {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/api/v1/thing', headers }),
    }),
  } as unknown as ArgumentsHost
  return { host, status, json }
}

describe('AllExceptionsFilter reason codes', () => {
  const filter = new AllExceptionsFilter()

  it('passes a 4xx reason code through to the client', () => {
    const { host, json } = buildHost()

    filter.catch(
      new BadRequestException({ statusCode: 400, code: 'phone_taken', message: 'Taken' }),
      host,
    )

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'phone_taken', message: 'Taken' }))
  })

  it('omits the field when the exception carries no code', () => {
    const { host, json } = buildHost()

    filter.catch(new BadRequestException('Plain message'), host)

    expect(json).toHaveBeenCalledWith(expect.not.objectContaining({ code: expect.anything() }))
  })

  it('never forwards a code on a 5xx', () => {
    const { host, json } = buildHost()

    filter.catch(
      new InternalServerErrorException({ statusCode: 500, code: 'db_down', message: 'boom' }),
      host,
    )

    expect(json).toHaveBeenCalledWith(expect.not.objectContaining({ code: expect.anything() }))
  })

  it('rejects anything that is not a slug, so messages cannot ride along', () => {
    const { host, json } = buildHost()

    filter.catch(
      new BadRequestException({
        statusCode: 400,
        code: 'Invalid `prisma.user.findFirst()` invocation',
        message: 'Bad',
      }),
      host,
    )

    expect(json).toHaveBeenCalledWith(expect.not.objectContaining({ code: expect.anything() }))
  })
})

describe('AllExceptionsFilter status labelling', () => {
  const filter = new AllExceptionsFilter()

  it('labels a structured 400 as Bad Request, not Internal Server Error', () => {
    const { host, json, status } = buildHost()
    filter.catch(
      new BadRequestException({
        message: 'SKU already used',
        fieldErrors: { sku: 'Already in use.' },
      }),
      host,
    )

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: 'SKU already used',
        fieldErrors: { sku: 'Already in use.' },
      }),
    )
  })
})

describe('AllExceptionsFilter server-error alerts', () => {
  it('reports a 5xx with the stack and request id', () => {
    const alerts = { report: jest.fn() }
    const filter = new AllExceptionsFilter(alerts as never)
    const { host } = buildHost({ 'x-request-id': 'req-9' })

    filter.catch(new InternalServerErrorException('database is on fire'), host)

    expect(alerts.report).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/api/v1/thing',
        statusCode: 500,
        message: 'database is on fire',
        requestId: 'req-9',
      }),
    )
    expect(alerts.report.mock.calls[0][0].stack).toContain('InternalServerErrorException')
  })

  it('does not report a 4xx — those are the client is wrong, not the shop', () => {
    const alerts = { report: jest.fn() }
    const filter = new AllExceptionsFilter(alerts as never)
    const { host } = buildHost()

    filter.catch(new BadRequestException('Plain message'), host)

    expect(alerts.report).not.toHaveBeenCalled()
  })
})

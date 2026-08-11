import {
  BadRequestException,
  InternalServerErrorException,
  type ArgumentsHost,
} from '@nestjs/common'
import { AllExceptionsFilter } from './all-exceptions.filter'

function buildHost() {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/api/v1/thing', headers: {} }),
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

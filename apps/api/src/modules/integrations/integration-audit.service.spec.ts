import { IntegrationAuditService } from './integration-audit.service'

describe('IntegrationAuditService.logTest', () => {
  it('updates the recent Telegram TEST_SUCCESS instead of inserting another row', async () => {
    const recent = {
      id: 'log-1',
      newData: { message: 'Telegram connected successfully', success: true, repeatCount: 2 },
    }
    const prisma = {
      user: { findUnique: jest.fn(async () => ({ id: 'u1' })) },
      auditLog: {
        findFirst: jest.fn(async () => recent),
        update: jest.fn(async () => recent),
        create: jest.fn(async () => ({ id: 'new' })),
      },
    }
    const audit = new IntegrationAuditService(prisma as never)
    await audit.logTest({
      storeId: 'splaro',
      userId: 'u1',
      provider: 'telegram',
      success: true,
      message: 'Telegram connected successfully',
    })
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
    expect(prisma.auditLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-1' },
        data: { newData: expect.objectContaining({ repeatCount: 3 }) },
      }),
    )
  })

  it('always inserts Telegram TEST_FAILED', async () => {
    const prisma = {
      user: { findUnique: jest.fn(async () => null) },
      auditLog: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(async () => ({ id: 'new' })),
      },
    }
    const audit = new IntegrationAuditService(prisma as never)
    await audit.logTest({
      storeId: 'splaro',
      provider: 'telegram',
      success: false,
      message: 'bot down',
    })
    expect(prisma.auditLog.findFirst).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'TEST_FAILED' }),
      }),
    )
  })
})

import { generateOrderCode } from './order-code.util'

type QueryRawMock = jest.Mock

function txWithOrderSequence(initialMax: number | null) {
  let stored: bigint | null = null
  let orderMax: number | null = initialMax

  const $queryRaw = jest.fn(async (strings: TemplateStringsArray, ...params: unknown[]) => {
    const sql = strings.join(' ')
    if (sql.includes('MAX(')) {
      return [{ max: orderMax }]
    }
    if (sql.includes('UPDATE') && sql.includes('"CodeSequence"')) {
      const seed = typeof params[0] === 'bigint' ? params[0] : BigInt(Number(params[0]))
      if (stored === null) stored = seed
      const greatest = stored > seed ? stored : seed
      stored = greatest + 1n
      return [{ nextValue: stored }]
    }
    return []
  }) as unknown as QueryRawMock

  const $executeRaw = jest.fn(async (strings: TemplateStringsArray, ...params: unknown[]) => {
    if (stored === null && typeof params[1] === 'bigint') stored = params[1]
    return 1
  })

  return {
    $queryRaw,
    $executeRaw,
    order: { findMany: jest.fn(async () => []) },
    dropMaxTo(value: number | null) {
      orderMax = value
    },
  }
}

describe('generateOrderCode', () => {
  it('starts at SPL-1001 when the store has no orders', async () => {
    const tx = txWithOrderSequence(null)
    await expect(generateOrderCode(tx as never, 'store-1')).resolves.toBe('SPL-1001')
  })

  it('continues from MAX(invoiceNumber) + 1 when orders already exist', async () => {
    const tx = txWithOrderSequence(1042)
    await expect(generateOrderCode(tx as never, 'store-1')).resolves.toBe('SPL-1043')
  })

  it('does not reuse a number after MAX drops (hard-delete)', async () => {
    const tx = txWithOrderSequence(null)
    await expect(generateOrderCode(tx as never, 'store-1')).resolves.toBe('SPL-1001')
    tx.dropMaxTo(null)
    await expect(generateOrderCode(tx as never, 'store-1')).resolves.toBe('SPL-1002')
  })

  it('hands consecutive codes to sequential callers', async () => {
    const tx = txWithOrderSequence(1001)
    const first = await generateOrderCode(tx as never, 'store-1')
    const second = await generateOrderCode(tx as never, 'store-1')
    expect(first).toBe('SPL-1002')
    expect(second).toBe('SPL-1003')
  })

  it('advances CodeSequence with GREATEST so the counter cannot rewind', async () => {
    const tx = txWithOrderSequence(1001)
    await generateOrderCode(tx as never, 'store-1')
    const sql = (tx.$queryRaw as jest.Mock).mock.calls
      .map((call) => (call[0] as TemplateStringsArray).join(' '))
      .join('\n')
    expect(sql).toContain('UPDATE "CodeSequence"')
    expect(sql).toContain('GREATEST')
    expect(sql).toContain('RETURNING "nextValue"')
  })
})

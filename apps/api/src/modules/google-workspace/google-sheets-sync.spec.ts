import { externalizeCell, findLoopbackCell } from './google-sheets-sync.service'

describe('externalizeCell', () => {
  const site = 'https://splaro.co'

  it('rewrites a loopback link to the customer-facing origin', () => {
    expect(externalizeCell('http://localhost:3000/products/kurti', site)).toBe(
      'https://splaro.co/products/kurti',
    )
    expect(externalizeCell('https://127.0.0.1:4000/uploads/a.webp', site)).toBe(
      'https://splaro.co/uploads/a.webp',
    )
  })

  it('rewrites loopback inside free text, which is where it usually hides', () => {
    // Telegram log lines and expense notes are copied in verbatim.
    expect(externalizeCell('Order synced — see http://localhost:3001/dashboard/orders/9', site)).toBe(
      'Order synced — see https://splaro.co/dashboard/orders/9',
    )
    expect(externalizeCell('reachable on localhost:3000 only', site)).toBe(
      'reachable on splaro.co only',
    )
  })

  it('rewrites every occurrence in one cell', () => {
    expect(externalizeCell('http://localhost:3000/a and http://localhost:3000/b', site)).toBe(
      'https://splaro.co/a and https://splaro.co/b',
    )
  })

  it('leaves ordinary values alone', () => {
    expect(externalizeCell('https://splaro.co/products/kurti', site)).toBe(
      'https://splaro.co/products/kurti',
    )
    expect(externalizeCell('Dhaka · 01711000000', site)).toBe('Dhaka · 01711000000')
    expect(externalizeCell(1450, site)).toBe(1450)
  })
})

describe('findLoopbackCell', () => {
  it('names the tab, row and column that leaked', () => {
    const leak = findLoopbackCell([
      { range: "'Orders'!A1:Z2", values: [['Order', 'Total'], ['#1001', '1450']] },
      {
        range: "'Telegram Logs'!A1:Z2",
        values: [['Message'], ['ok'], ['open http://localhost:3001/dashboard']],
      },
    ])

    expect(leak).toEqual({
      range: "'Telegram Logs'!A1:Z2",
      row: 3,
      column: 1,
      sample: 'open http://localhost:3001/dashboard',
    })
  })

  it('returns null when nothing loops back', () => {
    expect(
      findLoopbackCell([{ range: "'Orders'!A1:Z1", values: [['#1001', 'https://splaro.co/x']] }]),
    ).toBeNull()
  })

  it('does not go stale between calls', () => {
    // A `/g` regex reused with `.test` skips every other match — this guard runs
    // over thousands of cells, so that bug would let a leak through.
    const rows = [{ range: "'Orders'!A1", values: [['http://localhost:3000/a']] }]
    expect(findLoopbackCell(rows)).not.toBeNull()
    expect(findLoopbackCell(rows)).not.toBeNull()
  })
})

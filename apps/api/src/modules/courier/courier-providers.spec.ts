import { withCourierProviderAvailability } from './courier-providers'

describe('withCourierProviderAvailability', () => {
  it('marks only configured providers as bookable and keeps the rest listed', () => {
    const rows = withCourierProviderAvailability({
      STEADFAST: true,
      PATHAO: false,
      REDX: false,
      PAPERFLY: false,
      SUNDARBAN: false,
      SA_PARIBAHAN: false,
    })

    expect(rows.filter((r) => r.configured).map((r) => r.value)).toEqual(['STEADFAST'])
    expect(rows.map((r) => r.value)).toEqual([
      'STEADFAST',
      'PATHAO',
      'REDX',
      'PAPERFLY',
      'SUNDARBAN',
      'SA_PARIBAHAN',
    ])
  })
})

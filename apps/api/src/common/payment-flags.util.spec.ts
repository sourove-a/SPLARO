import { loadStorePaymentFlags } from './payment-flags.util'

describe('loadStorePaymentFlags', () => {
  it('fails closed to COD when settings are missing', async () => {
    const prisma = {
      siteSettings: { findUnique: jest.fn().mockResolvedValue(null) },
    }

    await expect(loadStorePaymentFlags(prisma as never, 'store-1')).resolves.toEqual({
      cod: true,
      bkash: false,
      nagad: false,
      sslcommerz: false,
    })
  })
})

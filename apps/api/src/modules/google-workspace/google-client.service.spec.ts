const resolveStoreId = jest.fn().mockResolvedValue('store-1')

jest.mock('../../common/store.util', () => ({
  resolveStoreId: (...args: unknown[]) => resolveStoreId(...args),
}))

import { GoogleClientService } from './google-client.service'
import { REFRESH_TOKEN_MISSING } from './google-sheets-auth.util'

describe('GoogleClientService.canUseSheets', () => {
  function build(opts: {
    saConfigured?: boolean
    ciphertext?: string | null
    decrypt?: (value: string) => string
  }) {
    const prisma = {
      googleWorkspaceConnection: {
        findUnique: jest.fn().mockResolvedValue({ id: 'conn-1', scopes: 'oauth' }),
      },
      googleWorkspaceToken: {
        findUnique: jest.fn().mockResolvedValue(
          opts.ciphertext === undefined
            ? null
            : { refreshTokenEncrypted: opts.ciphertext },
        ),
      },
    }
    const crypto = {
      decrypt: jest.fn((value: string) => (opts.decrypt ? opts.decrypt(value) : value)),
      encrypt: jest.fn((value: string) => `enc:${value}`),
    }
    const oauth = { getOAuthClient: jest.fn() }
    const serviceAccount = {
      isConfigured: jest.fn().mockReturnValue(Boolean(opts.saConfigured)),
      parseAuthMode: jest.fn().mockReturnValue('oauth'),
      getAuthClient: jest.fn(),
    }
    const client = new GoogleClientService(
      prisma as never,
      crypto as never,
      oauth as never,
      serviceAccount as never,
    )
    return { client, crypto }
  }

  it('rejects ciphertext that decrypts to empty', async () => {
    const { client } = build({ ciphertext: 'enc:blob', decrypt: () => '  ' })
    await expect(client.canUseSheets('store-1')).resolves.toEqual({
      ok: false,
      reason: REFRESH_TOKEN_MISSING,
    })
  })

  it('accepts a decryptable refresh token', async () => {
    const { client } = build({ ciphertext: 'enc:blob', decrypt: () => 'refresh-1' })
    await expect(client.canUseSheets('store-1')).resolves.toEqual({ ok: true, mode: 'oauth' })
  })
})

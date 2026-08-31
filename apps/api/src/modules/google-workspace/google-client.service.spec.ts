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

describe('GoogleClientService token health after a working sync', () => {
  function build(opts: { tokenHealth: string | null; getAccessToken?: () => Promise<unknown> }) {
    const update = jest.fn().mockResolvedValue({})
    const updateMany = jest.fn().mockResolvedValue({ count: 1 })
    const prisma = {
      googleWorkspaceConnection: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'conn-1',
          isConnected: true,
          scopes: 'oauth',
          tokenHealth: opts.tokenHealth,
        }),
        update,
        updateMany,
      },
      googleWorkspaceToken: {
        findUnique: jest.fn().mockResolvedValue({ refreshTokenEncrypted: 'enc:blob' }),
        update: jest.fn().mockResolvedValue({}),
      },
    }
    const oauth2 = {
      setCredentials: jest.fn(),
      on: jest.fn(),
      getAccessToken:
        opts.getAccessToken ?? jest.fn().mockResolvedValue({ token: 'access-1' }),
    }
    const client = new GoogleClientService(
      prisma as never,
      { decrypt: (v: string) => `plain-${v}`, encrypt: (v: string) => `enc:${v}` } as never,
      { getOAuthClient: jest.fn().mockResolvedValue(oauth2) } as never,
      { isConfigured: () => false, parseAuthMode: () => 'oauth', getAuthClient: jest.fn() } as never,
    )
    return { client, update, updateMany }
  }

  it('clears a stale reconnect flag once the credentials work', async () => {
    // The bug: the flag was only ever cleared inside the `tokens` refresh
    // handler, so a store whose cached access token was still valid kept being
    // told to reconnect through sync after successful sync.
    const { client, update } = build({ tokenHealth: 'needs_reconnect' })

    await client.getAuthenticatedClient('store-1')

    expect(update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: { tokenHealth: 'healthy', lastError: null },
    })
  })

  it('does not write when the connection is already healthy', async () => {
    const { client, update } = build({ tokenHealth: 'healthy' })
    await client.getAuthenticatedClient('store-1')
    expect(update).not.toHaveBeenCalled()
  })

  it('leaves the flag alone when Google rejects the credentials', async () => {
    const { client, update, updateMany } = build({
      tokenHealth: 'needs_reconnect',
      getAccessToken: jest.fn().mockRejectedValue(new Error('invalid_grant')),
    })

    await expect(client.getAuthenticatedClient('store-1')).rejects.toThrow(/Reconnect/i)

    expect(update).not.toHaveBeenCalled()
    // and it is re-marked unhealthy rather than quietly left as-is
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tokenHealth: 'needs_reconnect' }) }),
    )
  })

  it('a failed status write never fails the sync that succeeded', async () => {
    const { client } = build({ tokenHealth: 'needs_reconnect' })
    ;(client as unknown as { prisma: { googleWorkspaceConnection: { update: jest.Mock } } })
      .prisma.googleWorkspaceConnection.update.mockRejectedValue(new Error('db down'))

    await expect(client.getAuthenticatedClient('store-1')).resolves.toBeDefined()
  })
})

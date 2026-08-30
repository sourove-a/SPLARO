import { createHmac } from 'crypto'

jest.mock('../../common/store.util', () => ({
  resolveStoreId: jest.fn().mockResolvedValue('store-1'),
}))

jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: jest.fn() },
    oauth2: jest.fn(),
  },
}))

import { google } from 'googleapis'
import { GoogleOAuthService } from './google-oauth.service'

function signedState() {
  const body = Buffer.from(
    JSON.stringify({
      storeId: 'store-1',
      userId: 'admin-1',
      nonce: 'nonce',
      exp: Date.now() + 60_000,
    }),
  ).toString('base64url')
  const signature = createHmac('sha256', 'test-secret').update(body).digest('base64url')
  return `${body}.${signature}`
}

function build(existingRefreshCiphertext: string | null) {
  const oauth = {
    getToken: jest.fn().mockResolvedValue({
      tokens: {
        access_token: 'access-2',
        id_token: `header.${Buffer.from(JSON.stringify({ email: 'admin@example.com' })).toString('base64url')}.signature`,
      },
    }),
    setCredentials: jest.fn(),
  }
  ;(google.auth.OAuth2 as unknown as jest.Mock).mockImplementation(() => oauth)

  const updatedConnection = {
    id: 'connection-1',
    storeId: 'store-1',
    isConnected: true,
    tokenHealth: 'healthy',
  }
  const tokenUpsert = jest.fn()
  const transaction = jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      googleWorkspaceConnection: {
        update: jest.fn().mockResolvedValue(updatedConnection),
      },
      googleWorkspaceToken: { upsert: tokenUpsert },
    }),
  )
  const prisma = {
    googleWorkspaceConnection: {
      upsert: jest.fn().mockResolvedValue({ id: 'connection-1', storeId: 'store-1' }),
    },
    googleWorkspaceToken: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          existingRefreshCiphertext ? { refreshTokenEncrypted: existingRefreshCiphertext } : null,
        ),
    },
    $transaction: transaction,
  }
  const crypto = {
    decrypt: jest.fn().mockReturnValue('existing-refresh-token'),
    encrypt: jest.fn((value: string) => `encrypted:${value}`),
  }
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'ADMIN_SESSION_SECRET') return 'test-secret'
      if (key === 'GOOGLE_CLIENT_ID') return 'client-id'
      if (key === 'GOOGLE_CLIENT_SECRET') return 'client-secret'
      return undefined
    }),
  }
  const audit = { log: jest.fn() }
  const service = new GoogleOAuthService(
    prisma as never,
    config as never,
    crypto as never,
    audit as never,
  )

  return { service, prisma, crypto, transaction, tokenUpsert }
}

describe('GoogleOAuthService.handleCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('preserves a usable existing refresh token when Google omits a replacement', async () => {
    const { service, transaction, tokenUpsert, crypto } = build('encrypted:existing')

    await expect(service.handleCallback('oauth-code', signedState())).resolves.toEqual({
      storeId: 'store-1',
      googleEmail: 'admin@example.com',
      connected: true,
    })

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(tokenUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({ refreshTokenEncrypted: expect.anything() }),
      }),
    )
    expect(crypto.encrypt).toHaveBeenCalledWith('access-2')
    expect(crypto.encrypt).not.toHaveBeenCalledWith('existing-refresh-token')
  })

  it('does not mark the connection healthy when no usable refresh token exists', async () => {
    const { service, transaction } = build(null)

    await expect(service.handleCallback('oauth-code', signedState())).rejects.toThrow(
      'Google refresh token missing. Reconnect your Google account.',
    )

    expect(transaction).not.toHaveBeenCalled()
  })
})

import { EncryptionService } from './encryption.service'

describe('EncryptionService', () => {
  const originalKey = process.env['ENCRYPTION_KEY']
  const originalPreviousKey = process.env['ENCRYPTION_KEY_PREVIOUS']

  afterEach(() => {
    if (originalKey === undefined) delete process.env['ENCRYPTION_KEY']
    else process.env['ENCRYPTION_KEY'] = originalKey

    if (originalPreviousKey === undefined) delete process.env['ENCRYPTION_KEY_PREVIOUS']
    else process.env['ENCRYPTION_KEY_PREVIOUS'] = originalPreviousKey
  })

  it('encrypts and decrypts with the active key', () => {
    process.env['ENCRYPTION_KEY'] = 'active-encryption-key-that-is-long-enough'
    delete process.env['ENCRYPTION_KEY_PREVIOUS']
    const service = new EncryptionService()
    service.onModuleInit()

    const encrypted = service.encrypt('secret-value')

    expect(encrypted).toMatch(/^enc:/)
    expect(service.decrypt(encrypted)).toBe('secret-value')
  })

  it('decrypts legacy rows with the previous key during rotation', () => {
    process.env['ENCRYPTION_KEY'] = 'previous-encryption-key-that-is-long-enough'
    delete process.env['ENCRYPTION_KEY_PREVIOUS']
    const legacyService = new EncryptionService()
    legacyService.onModuleInit()
    const legacyEncrypted = legacyService.encrypt('legacy-secret')

    process.env['ENCRYPTION_KEY'] = 'new-encryption-key-that-is-long-enough-now'
    process.env['ENCRYPTION_KEY_PREVIOUS'] = 'previous-encryption-key-that-is-long-enough'
    const rotatingService = new EncryptionService()
    rotatingService.onModuleInit()

    expect(rotatingService.decrypt(legacyEncrypted)).toBe('legacy-secret')
    expect(rotatingService.decrypt(rotatingService.encrypt('new-secret'))).toBe('new-secret')
  })

  it('rejects an invalid previous key', () => {
    process.env['ENCRYPTION_KEY'] = 'active-encryption-key-that-is-long-enough'
    process.env['ENCRYPTION_KEY_PREVIOUS'] = 'too-short'
    const service = new EncryptionService()

    expect(() => service.onModuleInit()).toThrow(
      'ENCRYPTION_KEY_PREVIOUS must be at least 32 characters when set.',
    )
  })
})

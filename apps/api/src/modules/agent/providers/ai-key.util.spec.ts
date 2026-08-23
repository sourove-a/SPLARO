import { isUnusableAiSecret, normalizeAiSecret, usableAiSecret } from './ai-key.util'

describe('ai-key.util', () => {
  it('strips quotes, Bearer, and zero-width chars', () => {
    expect(normalizeAiSecret('  "Bearer sk-abc"  ')).toBe('sk-abc')
    expect(normalizeAiSecret('\uFEFFsk-abc')).toBe('sk-abc')
  })

  it('rejects placeholders and ciphertext', () => {
    expect(isUnusableAiSecret('sk-your-openai-api-key')).toBe(true)
    expect(isUnusableAiSecret('enc:iv:tag:data')).toBe(true)
    expect(isUnusableAiSecret('short')).toBe(true)
    expect(usableAiSecret('sk-proj-abcdefghijklmnopqrstuvwxyz123456')).toBe(
      'sk-proj-abcdefghijklmnopqrstuvwxyz123456',
    )
  })
})

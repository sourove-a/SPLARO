/** Normalize a pasted provider secret before store or outbound Bearer. */
export function normalizeAiSecret(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
}

const PLACEHOLDER =
  /^(sk-your-|sk-or-v1-your|paste|your-|example|changeme|todo|replace|xxx+|sk-\*{3})/i

/** Env sample / decrypt garbage must never be sent to a provider (401). */
export function isUnusableAiSecret(raw: string | null | undefined): boolean {
  if (!raw) return true
  const key = normalizeAiSecret(raw)
  if (key.length < 16) return true
  if (key.startsWith('enc:')) return true
  if (PLACEHOLDER.test(key)) return true
  if (/paste|your-openai|example|changeme|replace-me/i.test(key)) return true
  return false
}

export function usableAiSecret(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = normalizeAiSecret(raw)
  return isUnusableAiSecret(key) ? null : key
}

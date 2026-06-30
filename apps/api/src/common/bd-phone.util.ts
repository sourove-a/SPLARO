const BD_MOBILE_RE = /^01[3-9]\d{8}$/

/** Normalize to 11-digit local BD mobile (01XXXXXXXXX). */
export function normalizeBdPhone(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('880')) {
    const rest = digits.slice(3)
    digits = rest.startsWith('0') ? rest : `0${rest}`
  }
  if (digits.length === 10 && !digits.startsWith('0')) {
    digits = `0${digits}`
  }
  return digits.slice(0, 11)
}

/** Display / export format — always 01XXXXXXXXX for sheets & admin. */
export function formatBdPhoneDisplay(value: string | null | undefined): string {
  if (!value?.trim()) return '—'
  const normalized = normalizeBdPhone(value)
  if (BD_MOBILE_RE.test(normalized)) return normalized
  const digits = value.replace(/\D/g, '')
  if (digits.length >= 10) {
    const local = digits.startsWith('880') ? normalizeBdPhone(value) : `0${digits.slice(-10)}`
    if (BD_MOBILE_RE.test(local)) return local
  }
  return value.trim()
}

export function isValidBdMobile(value: string): boolean {
  return BD_MOBILE_RE.test(normalizeBdPhone(value))
}

/** Prefix with apostrophe so Google Sheets keeps 01XXXXXXXXX as text, not a number. */
export function formatPhoneForGoogleSheet(value: string | null | undefined): string {
  const display = formatBdPhoneDisplay(value)
  if (display === '—') return display
  return `'${display}`
}

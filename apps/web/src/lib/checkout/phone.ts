const BD_MOBILE_RE = /^01[3-9]\d{8}$/

/** Strip non-digits; allow 880… while typing (13 digits), else local 11. */
export function formatBdPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('880')) return digits.slice(0, 13)
  return digits.slice(0, 11)
}

/**
 * Normalize to 11-digit local BD mobile (01XXXXXXXXX).
 * Accepts 880 / +880 and bare 10-digit (1XXXXXXXXX) forms.
 * Keep in sync with apps/api/src/common/bd-phone.util.ts.
 */
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

/** Bangladesh mobile: 01XXXXXXXXX or 8801XXXXXXXXX. */
export function isValidBdMobile(value: string): boolean {
  return BD_MOBILE_RE.test(normalizeBdPhone(value))
}

export function getBdPhoneError(value: string): string | null {
  const raw = value.replace(/\D/g, '')
  if (!raw) return 'Phone number is required'

  const normalized = normalizeBdPhone(value)
  if (normalized.length < 11) {
    if (raw.startsWith('880')) {
      return 'Enter the full number — 880 then your 10-digit mobile'
    }
    return 'Enter an 11-digit mobile number'
  }
  if (!normalized.startsWith('01')) return 'Mobile number must start with 01'
  if (!BD_MOBILE_RE.test(normalized)) return 'Enter a valid Bangladesh mobile number'
  return null
}

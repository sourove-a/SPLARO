/**
 * Bilingual field copy and script checks for the product form.
 *
 * English boxes drop Bengali letters as they are typed. Bangla boxes stay
 * editable (Avro types Latin until it converts; drafts mix a few Latin tokens)
 * and only warn when the text is mostly the wrong language. Save is never
 * blocked by script — a stuck product form is worse than a warning.
 */

const BENGALI_RE = /[\u0980-\u09FF]/g
const LATIN_LETTERS = /[A-Za-z]/g

export type FieldScript = 'bn' | 'en'

/** Bangla-side labels, so a Bangla field is described in Bangla end to end. */
export const BN_COPY = {
  titleLabel: 'শিরোনাম · বাংলা',
  titleHint: 'স্টোরফ্রন্টের বাংলা ভাষায় এই নামটাই দেখা যাবে।',
  titlePlaceholder: 'যেমন: জামদানি হেরিটেজ শাড়ি',
  descriptionLabel: 'বিবরণ · বাংলা',
  descriptionHint: 'কাপড়, ফিট, কখন পরবেন — সংক্ষেপে বাংলায় লিখুন।',
  descriptionPlaceholder: 'বাংলায় বিবরণ লিখুন…',
  polishButton: 'বাংলা ঠিক করুন',
  wrongScript: 'এই ঘরে বাংলায় লিখুন — এখন বেশিরভাগ ইংরেজি আছে।',
} as const

export const EN_COPY = {
  titleLabel: 'Title · English',
  titleHint: 'Drives the handle and the SEO title.',
  titlePlaceholder: 'e.g. Jamdani Heritage Saree',
  descriptionLabel: 'Description · English',
  descriptionPlaceholder: 'Write your product story in English…',
  descriptionHint: 'Bangla letters are removed here as you type.',
  wrongScript: 'This field is for English — it currently reads mostly Bangla.',
} as const

/**
 * Which script a value is written in, by letter count.
 * `null` when there is too little to judge (a two-letter brand name is not a
 * language), so a half-typed field never nags.
 */
export function dominantScript(value: string): FieldScript | null {
  const bengali = (value.match(BENGALI_RE) ?? []).length
  const latin = (value.match(LATIN_LETTERS) ?? []).length
  if (bengali + latin < 6) return null
  if (bengali === latin) return null
  return bengali > latin ? 'bn' : 'en'
}

/**
 * Advisory message when a field holds the wrong script, else null.
 *
 * A Bangla sentence carrying a Latin brand name or "COD" stays clean, because
 * the dominant script is still Bangla.
 */
export function scriptWarning(value: string, expected: FieldScript): string | null {
  const script = dominantScript(value)
  if (!script || script === expected) return null
  return expected === 'bn' ? BN_COPY.wrongScript : EN_COPY.wrongScript
}

/** English field: drop Bengali. Bangla field: never freeze typing. */
export function gateScript(_prev: string, next: string, expected: FieldScript): string {
  if (expected === 'en') return next.replace(/[\u0980-\u09FF]/g, '')
  return next
}

export function filterToScript(value: string, expected: FieldScript): string {
  if (expected === 'en') return value.replace(/[\u0980-\u09FF]/g, '')
  return value
}

/**
 * Bilingual field copy and script checks for the product form.
 *
 * SPLARO stores English and Bangla separately (English in `description`, Bangla
 * in `schemaMarkup.descriptionBn`), and the storefront language switch shows one
 * or the other. So a Bangla field holding English text is not a style problem —
 * it means Bangla shoppers read English, or read nothing at all.
 *
 * The check below is advisory, never blocking: brand names, sizes, "COD" and
 * measurements legitimately stay Latin inside a Bangla sentence, so the warning
 * only fires when a field is *mostly* the wrong script.
 */

const BENGALI_RANGE = /[ঀ-৿]/g
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
  wrongScript: 'This field is for English — it currently reads mostly Bangla.',
} as const

/**
 * Which script a value is written in, by letter count.
 * `null` when there is too little to judge (a two-letter brand name is not a
 * language), so a half-typed field never nags.
 */
export function dominantScript(value: string): FieldScript | null {
  const bengali = (value.match(BENGALI_RANGE) ?? []).length
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

/**
 * Bangla product copy, generated from the merchant fields the admin already
 * fills in (fabric, fit, occasion, category) — no translation service and no
 * extra data entry.
 *
 * The same honesty rule as the English fallback applies: nothing is invented.
 * If a term has no Bangla entry it is left in English, which is how Bangladeshi
 * fashion copy actually reads. If no source field exists, this returns an empty
 * string and the caller hides the Bangla option entirely.
 */

/** Fabrics and materials, longest phrases first so they win over single words. */
const MATERIAL_BN: Array<[RegExp, string]> = [
  [/\bknit\s+mesh\b/gi, 'নিট মেশ'],
  [/\bfull[-\s]?grain\s+leather\b/gi, 'ফুল-গ্রেইন লেদার'],
  [/\bgenuine\s+leather\b/gi, 'আসল চামড়া'],
  [/\bfaux\s+leather\b/gi, 'ফক্স লেদার'],
  [/\bcotton\s+blend\b/gi, 'কটন ব্লেন্ড'],
  [/\bpremium\s+cotton\b/gi, 'প্রিমিয়াম কটন'],
  [/\bpremium\b/gi, 'প্রিমিয়াম'],
  [/\bpique\b/gi, 'পিকে'],
  [/\bpoplin\b/gi, 'পপলিন'],
  [/\bembroidered\b/gi, 'এমব্রয়ডারি করা'],
  [/\bwashed\b/gi, 'ওয়াশড'],
  [/\bsoft\b/gi, 'নরম'],
  [/\bcotton\b/gi, 'কটন'],
  [/\blinen\b/gi, 'লিনেন'],
  [/\bsilk\b/gi, 'সিল্ক'],
  [/\bdenim\b/gi, 'ডেনিম'],
  [/\bleather\b/gi, 'লেদার'],
  [/\bsuede\b/gi, 'সোয়েড'],
  [/\bcanvas\b/gi, 'ক্যানভাস'],
  [/\bviscose\b/gi, 'ভিসকস'],
  [/\bgeorgette\b/gi, 'জর্জেট'],
  [/\bchiffon\b/gi, 'শিফন'],
  [/\bpolyester\b/gi, 'পলিয়েস্টার'],
  [/\brayon\b/gi, 'রেয়ন'],
  [/\bvelvet\b/gi, 'ভেলভেট'],
  [/\bwool\b/gi, 'উল'],
  [/\bjute\b/gi, 'পাট'],
  [/\bmesh\b/gi, 'মেশ'],
  [/\bupper\b/gi, 'আপার'],
  [/\bsole\b/gi, 'সোল'],
  [/\bblend\b/gi, 'ব্লেন্ড'],
]

const FIT_BN: Array<[RegExp, string]> = [
  [/\bsmart\b/gi, 'স্মার্ট'],
  [/\bdrape\b/gi, 'ড্রেপ'],
  [/\bregular\b/gi, 'রেগুলার'],
  [/\brelaxed\b/gi, 'রিলাক্সড'],
  [/\boversized\b/gi, 'ওভারসাইজড'],
  [/\bslim\b/gi, 'স্লিম'],
  [/\bstraight\b/gi, 'স্ট্রেইট'],
  [/\btailored\b/gi, 'টেইলর্ড'],
  [/\bcushioned\b/gi, 'কুশনড'],
  [/\bloose\b/gi, 'লুজ'],
  [/\bfitted\b/gi, 'ফিটেড'],
  [/\bcropped\b/gi, 'ক্রপড'],
  [/\bfit\b/gi, 'ফিট'],
]

const OCCASION_BN: Array<[RegExp, string]> = [
  // Multi-word phrases first — otherwise "formal" would consume "formal visit".
  [/\bfamily\s+gathering\b/gi, 'পারিবারিক অনুষ্ঠান'],
  [/\bformal\s+visit\b/gi, 'ফরমাল দাওয়াত'],
  [/\boffice\s+casual\b/gi, 'অফিস ক্যাজুয়াল'],
  [/\beveryday\b/gi, 'প্রতিদিনের'],
  [/\bdaily\b/gi, 'প্রতিদিনের'],
  [/\bcasual\b/gi, 'ক্যাজুয়াল'],
  [/\bformal\b/gi, 'ফরমাল'],
  [/\boffice\b/gi, 'অফিস'],
  [/\bparty\b/gi, 'পার্টি'],
  [/\bwedding\b/gi, 'বিয়ে'],
  [/\bfestive\b/gi, 'উৎসব'],
  [/\beid\b/gi, 'ঈদ'],
  [/\bpuja\b/gi, 'পূজা'],
  [/\btravel\b/gi, 'ভ্রমণ'],
  [/\bwalking\b/gi, 'হাঁটাচলা'],
  [/\brunning\b/gi, 'দৌড়ানো'],
  [/\bsummer\b/gi, 'গরমকাল'],
  [/\bwinter\b/gi, 'শীতকাল'],
  [/\bmonsoon\b/gi, 'বর্ষাকাল'],
  [/\bevening\b/gi, 'সন্ধ্যা'],
  [/\bweekend\b/gi, 'ছুটির দিন'],
  [/\bwork\b/gi, 'কাজের'],
  [/\boutdoor\b/gi, 'আউটডোর'],
  [/\bdinner\b/gi, 'ডিনার'],
  [/\bmeeting\b/gi, 'মিটিং'],
  [/\bcampus\b/gi, 'ক্যাম্পাস'],
]

function localise(value: string, table: Array<[RegExp, string]>): string {
  let out = value
  for (const [pattern, bengali] of table) {
    out = out.replace(pattern, bengali)
  }
  return out.replace(/\s{2,}/g, ' ').trim()
}

/** English list separators become Bangla ones so the sentence reads naturally. */
function joinList(value: string, table: Array<[RegExp, string]>): string {
  const parts = value
    .split(/\s*(?:,|·|\/|\band\b|&)\s*/i)
    .map((part) => localise(part, table))
    .filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0] as string
  const last = parts[parts.length - 1] as string
  return `${parts.slice(0, -1).join(', ')} ও ${last}`
}

/** Bangla vowel signs and independent vowels a word can end on. */
const VOWEL_ENDING = /[া-ৌৗঅ-ঔৎয়]$/

/**
 * Attaches the Bangla genitive so the "made for X" line reads naturally:
 * a consonant ending takes -এর (ভ্রমণ → ভ্রমণের), a vowel ending takes -র
 * (হাঁটাচলা → হাঁটাচলার). Only the last word of the list is inflected, which
 * is how Bangla handles a coordinated list.
 */
function genitive(phrase: string): string {
  const trimmed = phrase.trim()
  if (!trimmed) return trimmed
  // A Latin word (an untranslated term) keeps an explicit hyphen for clarity.
  if (/[A-Za-z0-9]$/.test(trimmed)) return `${trimmed}-এর`
  return VOWEL_ENDING.test(trimmed) ? `${trimmed}র` : `${trimmed}ের`
}

export interface BanglaCopyInput {
  name: string
  nameBn?: string | null | undefined
  fabricContent?: string | null | undefined
  fitType?: string | null | undefined
  occasion?: string | null | undefined
}

/**
 * Mirrors the English "The piece" block: a spec line, then who it is made for.
 * Product names stay in English unless the admin has supplied `nameBn` —
 * transliterating a brand name would be worse than leaving it.
 */
export function buildProductDescriptionBn(input: BanglaCopyInput): string {
  const material = input.fabricContent?.trim()
  const fit = input.fitType?.trim()
  const occasion = input.occasion?.trim()

  if (!material && !fit && !occasion) return ''

  const title = input.nameBn?.trim() || input.name.trim()

  const specs: string[] = []
  if (material) specs.push(`উপকরণ — ${joinList(material, MATERIAL_BN)}`)
  if (fit) specs.push(`ফিট — ${joinList(fit, FIT_BN)}`)

  const lines: string[] = []
  if (specs.length > 0) {
    lines.push(`${title} · ${specs.join(' · ')}।`)
  } else if (title) {
    lines.push(`${title}।`)
  }
  if (occasion) {
    const list = joinList(occasion, OCCASION_BN)
    if (list) lines.push(`${genitive(list)} জন্য উপযোগী।`)
  }

  return lines.join('\n').trim()
}

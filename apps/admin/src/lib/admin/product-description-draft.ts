/** Local premium copy drafts — no API. User notes override bare name. */

export function formatBilingualDescription(english?: string, bangla?: string): string {
  const en = english?.trim() ?? ''
  const bn = bangla?.trim() ?? ''
  if (en && bn) return `${en}\n\n\n${bn}`
  return en || bn
}

export function buildDescriptionDraft(input: {
  name: string
  notes?: string
  fabric?: string
  fit?: string
  occasion?: string
  category?: string
}): string {
  const name = input.name.trim() || 'SPLARO Premium Piece'
  const fabric = input.fabric?.trim() || 'premium fabric'
  const fit = input.fit?.trim() || 'Regular'
  const occasion = input.occasion?.trim() || 'Eid, parties & everyday celebrations'
  const category = input.category?.trim() || 'fashion'
  const notes = input.notes?.trim()

  if (notes) {
    const en = [
      `${name} — ${notes}`,
      `Crafted in ${fabric} with a ${fit.toLowerCase()} fit for SPLARO's signature comfort.`,
      `Ideal for ${occasion}. Designed in Bangladesh for discerning families who expect boutique quality.`,
    ].join(' ')
    const bn = [
      `${name} — ${notes}`,
      `${fabric} তৈরি, ${fit} ফিট — SPLARO-র signature comfort।`,
      `${occasion}-এর জন্য ideal। বাংলাদেশে boutique quality-তে tailored।`,
    ].join(' ')
    return formatBilingualDescription(en, bn)
  }

  const en = [
    `${name} by SPLARO elevates your ${category} wardrobe with refined tailoring and everyday luxury.`,
    `Premium ${fabric}, ${fit.toLowerCase()} fit — breathable, soft on skin, and made to last beyond one season.`,
    `Perfect for ${occasion}. Shop confidently with SPLARO quality assurance.`,
  ].join(' ')

  const bn = [
    `SPLARO ${name} — refined ${category} যেখানে premium tailoring meets everyday luxury।`,
    `${fabric}, ${fit} fit — skin-friendly, breathable, এক season-এর বেশি lasting।`,
    `${occasion}-এ perfect। SPLARO quality assurance সহ confidently order করুন।`,
  ].join(' ')

  return formatBilingualDescription(en, bn)
}

export function buildSeoDraft(name: string, description: string): { title: string; description: string } {
  const cleanName = name.trim() || 'SPLARO Product'
  const title = `${cleanName} | SPLARO Bangladesh`.slice(0, 60)
  const firstBlock = description.split('\n\n\n')[0] ?? description
  const plain = firstBlock.replace(/\s+/g, ' ').trim()
  const meta = plain.length > 155 ? `${plain.slice(0, 152)}…` : plain
  return {
    title,
    description: meta || `Shop ${cleanName} at SPLARO — premium fashion delivered across Bangladesh.`,
  }
}

export function splitBilingualDescription(description: string): { en: string; bn: string } {
  const parts = description.split('\n\n\n')
  if (parts.length >= 2) {
    return { en: parts[0]?.trim() ?? '', bn: parts.slice(1).join('\n\n\n').trim() }
  }
  const hasBangla = /[\u0980-\u09FF]/.test(description)
  if (hasBangla && !/[a-zA-Z]{4,}/.test(description.slice(0, 40))) {
    return { en: '', bn: description.trim() }
  }
  return { en: description.trim(), bn: '' }
}

export const BANGLA_PHRASE_CHIPS = [
  'প্রিমিয়াম কোয়ালিটি কাপড়ে তৈরি',
  'ইদ, বিবাহ ও পার্টির জন্য একদম পারফেক্ট',
  'skin-friendly, breathable ও আরামদায়ক',
  'বাংলাদেশে boutique finishing সহ tailored',
  'SPLARO quality assurance — confidently order করুন',
  'limited stock — আজই order করুন',
] as const

export function polishBanglaDescription(input: {
  name: string
  fabric?: string
  fit?: string
  occasion?: string
  notes?: string
  existing?: string
}): string {
  const name = input.name.trim() || 'এই পিস'
  const fabric = input.fabric?.trim() || 'প্রিমিয়াম কাপড়'
  const fit = input.fit?.trim() || 'Regular'
  const occasion = input.occasion?.trim() || 'ইদ, বিবাহ ও পার্টি'
  const notes = input.notes?.trim()
  const existing = input.existing?.trim()

  if (existing) {
    const trimmed = existing.replace(/\s+/g, ' ').trim()
    if (trimmed.endsWith('।') || trimmed.endsWith('!')) return trimmed
    return `${trimmed}।`
  }

  const lines = [
  notes
    ? `${name} — ${notes}।`
    : `SPLARO ${name} — refined look যেখানে premium tailoring meets everyday luxury।`,
  `${fabric} তৈরি, ${fit} fit — skin-friendly, breathable, এক season-এর বেশি lasting।`,
  `${occasion}-এ perfect। SPLARO quality assurance সহ confidently order করুন।`,
  ]

  return lines.join('\n\n')
}

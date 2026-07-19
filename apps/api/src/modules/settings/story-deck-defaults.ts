/** Shared default platinum story-deck cards — keep API / web / admin in sync. */

export type StoryDeckCardId =
  | 'story'
  | 'philosophy'
  | 'craft'
  | 'fabric'
  | 'silhouette'
  | 'presence'
  | 'reviews'
  | 'legacy'

export type StoryDeckCardIcon =
  | 'leaf'
  | 'gem'
  | 'people'
  | 'sparkles'
  | 'scissors'
  | 'shirt'
  | 'crown'
  | 'feather'

export interface StoryDeckCardConfig {
  id: StoryDeckCardId
  enabled: boolean
  icon: StoryDeckCardIcon
  eyebrow: string
  title: string
  statement: string
  body: string
  detail: string
  cta: string
}

export const DEFAULT_STORY_DECK_CARDS: StoryDeckCardConfig[] = [
  {
    id: 'story',
    enabled: true,
    icon: 'leaf',
    eyebrow: 'Origin',
    title: 'Origin',
    statement: 'Born from restraint.',
    body: 'SPLARO began where excess ends — with the belief that true luxury is felt, not announced.',
    detail:
      'From the first sketch to the final stitch, our origin is a promise: clothing that stays with you through seasons, rooms, and years — never demanding the room, always belonging in it.',
    cta: 'Read origin',
  },
  {
    id: 'philosophy',
    enabled: true,
    icon: 'gem',
    eyebrow: 'Belief',
    title: 'Philosophy',
    statement: 'Grace over glamour.',
    body: 'We choose composure over spectacle — proportions that endure, details that whisper.',
    detail:
      'Our philosophy is simple and exacting: fewer pieces, finer judgment, and a quiet confidence that does not need to raise its voice. Luxury here is a manner, not a volume.',
    cta: 'Explore belief',
  },
  {
    id: 'craft',
    enabled: true,
    icon: 'scissors',
    eyebrow: 'Atelier',
    title: 'Craft',
    statement: 'Hands before haste.',
    body: 'Every seam is a decision. We honour the slow intelligence of skilled hands.',
    detail:
      'Craft is our first language — measured cuts, patient finishing, and the kind of precision that only reveals itself when you live in the garment. Nothing is rushed that must last.',
    cta: 'See craft',
  },
  {
    id: 'fabric',
    enabled: true,
    icon: 'feather',
    eyebrow: 'Material',
    title: 'Fabric',
    statement: 'Touch tells the truth.',
    body: 'We select cloth that moves with dignity — soft enough to live in, strong enough to return.',
    detail:
      'Fabric is chosen for how it falls at dusk, how it holds its line after a long day, how it remembers the body without clinging. Texture is never decoration; it is character.',
    cta: 'Feel fabric',
  },
  {
    id: 'silhouette',
    enabled: true,
    icon: 'shirt',
    eyebrow: 'Form',
    title: 'Silhouette',
    statement: 'Line before ornament.',
    body: 'Clean architecture for the modern woman — balance, length, and an effortless frame.',
    detail:
      'A SPLARO silhouette is drawn like architecture: clear verticals, considered ease, and a frame that flatters without performance. The ornament is the line itself.',
    cta: 'Study form',
  },
  {
    id: 'presence',
    enabled: true,
    icon: 'sparkles',
    eyebrow: 'Aura',
    title: 'Presence',
    statement: 'Arrive without noise.',
    body: 'Presence is the soft power of being fully yourself — composed, luminous, unforced.',
    detail:
      'We design for the entrance that does not announce itself, and for the room that notices anyway. Presence is the platinum finish of quiet luxury — felt before it is named.',
    cta: 'Sense aura',
  },
  {
    id: 'reviews',
    enabled: true,
    icon: 'people',
    eyebrow: 'Community',
    title: 'Voices',
    statement: 'Worn into meaning.',
    body: 'Each woman who wears SPLARO writes a quieter chapter — of ritual, memory, and belonging across Bangladesh and beyond.',
    detail:
      'Our community is not a chorus of slogans — it is real women, real rituals, and the private confidence of dressing well. Their stories complete the house we are building.',
    cta: 'Hear voices',
  },
  {
    id: 'legacy',
    enabled: true,
    icon: 'crown',
    eyebrow: 'Heritage',
    title: 'Legacy',
    statement: 'Built to be inherited.',
    body: 'We make pieces meant to outlast a season — heirlooms of taste for the next chapter.',
    detail:
      'Legacy is not nostalgia. It is the discipline of making something worthy of being kept — a platinum standard of care so that what you wear today can still feel inevitable tomorrow.',
    cta: 'Hold legacy',
  },
]

/** Merge saved cards onto defaults by id (order follows defaults). */
export function mergeStoryDeckCards(input?: StoryDeckCardConfig[] | null): StoryDeckCardConfig[] {
  const byId = new Map((input ?? []).map((card) => [card.id, card]))
  return DEFAULT_STORY_DECK_CARDS.map((fallback) => {
    const saved = byId.get(fallback.id)
    if (!saved) return { ...fallback }
    return {
      ...fallback,
      ...saved,
      id: fallback.id,
      enabled: typeof saved.enabled === 'boolean' ? saved.enabled : fallback.enabled,
      icon: saved.icon || fallback.icon,
      eyebrow: saved.eyebrow?.trim() ? saved.eyebrow : fallback.eyebrow,
      title: saved.title?.trim() ? saved.title : fallback.title,
      statement: saved.statement?.trim() ? saved.statement : fallback.statement,
      body: saved.body?.trim() ? saved.body : fallback.body,
      detail: saved.detail?.trim() ? saved.detail : fallback.detail,
      cta: saved.cta?.trim() ? saved.cta : fallback.cta,
    }
  })
}

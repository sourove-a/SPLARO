import type {
  CustomerStoryItem,
  HomepageSectionsConfig,
  OurStoryConfig,
  StoryPillarConfig,
} from './storefront-config'

export const DEFAULT_STORY_PILLARS: StoryPillarConfig[] = [
  {
    id: 'pillar-1',
    enabled: true,
    icon: 'sprout',
    title: 'Rooted in Bangladesh',
    body: 'Every piece honours the craft traditions of our homeland.',
  },
  {
    id: 'pillar-2',
    enabled: true,
    icon: 'leaf',
    title: 'Premium materials',
    body: 'We source only the finest linen, crepe, and cotton blends.',
  },
  {
    id: 'pillar-3',
    enabled: true,
    icon: 'gem',
    title: 'Quiet luxury',
    body: 'Refined design that speaks without trying.',
  },
]

export const DEFAULT_CUSTOMER_STORY_ITEMS: CustomerStoryItem[] = []

export const DEFAULT_OUR_STORY: OurStoryConfig = {
  enabled: true,
  eyebrow: 'OUR STORY',
  title: 'Crafted for the modern wardrobe.',
  body1:
    'SPLARO was born from a belief that luxury should feel effortless — not aspirational, but deeply personal. We create fashion for people who move through the world with quiet confidence and singular grace.',
  body2:
    'Every piece is a conversation between heritage craft and contemporary sensibility. Rooted in Bangladesh, designed for the world.',
  quote: 'Grace over glamour. Quality over quantity.',
  quoteAttribution: 'THE SPLARO VISION',
  earthTagline1: 'Designed for the world.',
  earthTagline2: 'Rooted in heritage.',
  showEarthLogo: true,
  pillars: DEFAULT_STORY_PILLARS,
  customerStories: {
    enabled: true,
    label: 'Verified Reviews',
    rating: '',
    hint: '',
    stories: [],
  },
}

export const DEFAULT_HOMEPAGE_SECTIONS: HomepageSectionsConfig = {
  hero: true,
  marquee: true,
  collections: false,
  trustBar: true,
  catalog: true,
  specialOffer: true,
  ourStory: true,
  instagram: true,
  newsletter: true,
}

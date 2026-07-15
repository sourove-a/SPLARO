export type StoryPillarIcon = 'sprout' | 'leaf' | 'gem' | 'star' | 'heart' | 'sparkles'

export interface StoryPillarConfig {
  id: string
  enabled: boolean
  icon: StoryPillarIcon
  title: string
  body: string
}

export interface CustomerStoryItem {
  id: string
  enabled: boolean
  name: string
  location: string
  rating: number
  date: string
  text: string
  product: string
  avatar: string
}

export interface CustomerStoriesConfig {
  enabled: boolean
  label: string
  rating: string
  hint: string
  stories: CustomerStoryItem[]
}

export interface OurStoryConfig {
  enabled: boolean
  eyebrow: string
  title: string
  body1: string
  body2: string
  quote: string
  quoteAttribution: string
  earthTagline1: string
  earthTagline2: string
  showEarthLogo: boolean
  pillars: StoryPillarConfig[]
  customerStories: CustomerStoriesConfig
}

export interface HomepageSectionsConfig {
  hero: boolean
  marquee: boolean
  collections: boolean
  trustBar: boolean
  catalog: boolean
  specialOffer: boolean
  ourStory: boolean
  instagram: boolean
  newsletter: boolean
}

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
  enabled: false,
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
  ourStory: false,
  instagram: false,
  newsletter: true,
}

export function resolveOurStory(input?: Partial<OurStoryConfig>): OurStoryConfig {
  return {
    ...DEFAULT_OUR_STORY,
    ...input,
    pillars: input?.pillars?.length ? input.pillars : DEFAULT_OUR_STORY.pillars,
    customerStories: {
      ...DEFAULT_OUR_STORY.customerStories,
      ...input?.customerStories,
      stories: [],
      rating: '',
      hint: '',
    },
  }
}

export function resolveHomepageSections(input?: Partial<HomepageSectionsConfig>): HomepageSectionsConfig {
  return { ...DEFAULT_HOMEPAGE_SECTIONS, ...input }
}

export function visibleCustomerStories(_config: OurStoryConfig) {
  return []
}

export function visiblePillars(config: OurStoryConfig) {
  return config.pillars.filter((pillar) => pillar.enabled)
}

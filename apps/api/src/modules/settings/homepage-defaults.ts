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

export const DEFAULT_CUSTOMER_STORY_ITEMS: CustomerStoryItem[] = [
  {
    id: 'cs-1',
    enabled: true,
    name: 'Fatima Begum',
    location: 'Dhaka',
    rating: 5,
    date: 'June 2026',
    text: 'The fabric quality is beyond anything I have found in Bangladesh at this price point. The packaging alone felt like a gift. True luxury from start to finish.',
    product: 'Summer Air Overshirt',
    avatar: 'F',
  },
  {
    id: 'cs-2',
    enabled: true,
    name: 'Nusrat Jahan',
    location: 'Chittagong',
    rating: 5,
    date: 'May 2026',
    text: "I wore the dress to my cousin's wedding and received compliments all evening. SPLARO is not just shopping — this is an experience I will keep coming back to.",
    product: 'Soft Structure Dress',
    avatar: 'N',
  },
  {
    id: 'cs-3',
    enabled: true,
    name: 'Sumaiya Akter',
    location: 'Sylhet',
    rating: 5,
    date: 'May 2026',
    text: 'Cash on delivery made it so easy. My order arrived perfectly folded with a handwritten note. The linen quality is exceptional — my tailor was amazed.',
    product: 'Linen Day Shirt',
    avatar: 'S',
  },
  {
    id: 'cs-4',
    enabled: true,
    name: 'Roksana Khanam',
    location: 'Rajshahi',
    rating: 5,
    date: 'April 2026',
    text: 'Every time I wear anything from SPLARO I feel like the most elegant version of myself. Remarkably consistent quality across every order.',
    product: 'Pleated Resort Set',
    avatar: 'R',
  },
  {
    id: 'cs-5',
    enabled: true,
    name: 'Maliha Islam',
    location: 'Dhaka',
    rating: 5,
    date: 'April 2026',
    text: 'Ordered three pieces in one month. Customer support is incredibly responsive and the blazer fit was absolutely perfect straight out of the box.',
    product: 'Tailored Blazer',
    avatar: 'M',
  },
]

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
    label: 'Customer Stories',
    rating: '4.9',
    hint: 'voices from across Bangladesh',
    stories: DEFAULT_CUSTOMER_STORY_ITEMS,
  },
}

export const DEFAULT_HOMEPAGE_SECTIONS: HomepageSectionsConfig = {
  hero: true,
  marquee: true,
  collections: true,
  trustBar: true,
  catalog: true,
  specialOffer: true,
  ourStory: true,
  instagram: true,
  newsletter: true,
}

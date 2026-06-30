export type {
  CustomerStoryItem,
  CustomerStoriesConfig,
  HomepageSectionsConfig,
  OurStoryConfig,
  StoryPillarConfig,
  StoryPillarIcon,
} from '@/lib/storefront/homepage-defaults'

export {
  DEFAULT_CUSTOMER_STORY_ITEMS,
  DEFAULT_OUR_STORY,
  visibleCustomerStories,
} from '@/lib/storefront/homepage-defaults'

import { DEFAULT_CUSTOMER_STORY_ITEMS } from '@/lib/storefront/homepage-defaults'

/** @deprecated Use settings-driven customer stories from storefront config */
export const CUSTOMER_STORIES = DEFAULT_CUSTOMER_STORY_ITEMS

export type CustomerStory = (typeof DEFAULT_CUSTOMER_STORY_ITEMS)[number]

export type {
  LegalPageSection as SitePageSection,
  LegalPageContent as SitePageContent,
  LegalPageSlug,
} from '@splaro/types'
export { DEFAULT_LEGAL_PAGES as sitePages } from '@splaro/types'

export {
  sizeCharts,
  sizeGuideCharts,
  SIZE_GUIDE_ORDER,
  resolveSizeGuideKey,
  resolveSizeGuideTitle,
  getSizeGuideChart,
  formatMeasure,
  cmToIn,
} from '@/lib/content/size-guide'
export type { SizeGuideKey, SizeGuideUnit, SizeGuideChart } from '@/lib/content/size-guide'

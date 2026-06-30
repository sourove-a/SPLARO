export type {
  LegalPageSection as SitePageSection,
  LegalPageContent as SitePageContent,
  LegalPageSlug,
} from '@splaro/types'
export { DEFAULT_LEGAL_PAGES as sitePages } from '@splaro/types'

export const sizeCharts = {
  women: {
    title: 'Women',
    headers: ['Size', 'Bust (cm)', 'Waist (cm)', 'Hip (cm)'],
    rows: [
      ['XS', '78–82', '60–64', '86–90'],
      ['S', '83–87', '65–69', '91–95'],
      ['M', '88–92', '70–74', '96–100'],
      ['L', '93–98', '75–80', '101–106'],
    ],
  },
  men: {
    title: 'Men',
    headers: ['Size', 'Chest (cm)', 'Waist (cm)', 'Hip (cm)'],
    rows: [
      ['S', '88–92', '74–78', '90–94'],
      ['M', '93–98', '79–84', '95–100'],
      ['L', '99–104', '85–90', '101–106'],
      ['XL', '105–110', '91–96', '107–112'],
    ],
  },
  kids: {
    title: 'Kids',
    headers: ['Size', 'Height (cm)', 'Chest (cm)', 'Waist (cm)'],
    rows: [
      ['2Y', '86–92', '52–54', '50–52'],
      ['4Y', '98–104', '56–58', '52–54'],
      ['6Y', '110–116', '60–62', '54–56'],
      ['8Y', '122–128', '64–66', '56–58'],
    ],
  },
} as const

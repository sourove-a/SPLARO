export type SizeGuideKey = 'women' | 'men' | 'pants' | 'kids' | 'footwear'

export type SizeGuideUnit = 'cm' | 'in'

type ApparelChart = {
  key: SizeGuideKey
  title: string
  fit: string
  kind: 'apparel'
  sizes: string[]
  measurements: { label: string; valuesCm: number[] }[]
}

type FootwearChart = {
  key: SizeGuideKey
  title: string
  fit: string
  kind: 'footwear'
  sizes: string[]
  footLengthCm: number[]
}

export type SizeGuideChart = ApparelChart | FootwearChart

/** Compact apparel charts — values stored in cm, converted for IN toggle. */
export const sizeGuideCharts: Record<SizeGuideKey, SizeGuideChart> = {
  women: {
    key: 'women',
    title: 'Women',
    fit: 'Regular Fit',
    kind: 'apparel',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    measurements: [
      { label: 'Bust', valuesCm: [80, 85, 90, 95.5, 101] },
      { label: 'Waist', valuesCm: [62, 67, 72, 77.5, 83] },
      { label: 'Hip', valuesCm: [88, 93, 98, 103.5, 109] },
    ],
  },
  men: {
    key: 'men',
    title: 'Men',
    fit: 'Regular Fit',
    kind: 'apparel',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    measurements: [
      { label: 'Chest', valuesCm: [90, 95.5, 101.5, 107.5, 113.5] },
      { label: 'Waist', valuesCm: [76, 81.5, 87.5, 93.5, 99.5] },
      { label: 'Hip', valuesCm: [92, 97.5, 103.5, 109.5, 115.5] },
    ],
  },
  pants: {
    key: 'pants',
    title: 'Pants & Trousers',
    fit: 'Regular / Relaxed Fit',
    kind: 'apparel',
    sizes: ['28', '30', '32', '34', '36', '38', '40'],
    measurements: [
      { label: 'Waist', valuesCm: [71, 76, 81.5, 86.5, 91.5, 96.5, 101.5] },
      { label: 'Hip', valuesCm: [91, 96, 101, 106, 111, 116, 121] },
      { label: 'Inseam / Length', valuesCm: [76, 78, 80, 81, 81, 82, 82] },
    ],
  },
  kids: {
    key: 'kids',
    title: 'Kids',
    fit: 'Regular Fit',
    kind: 'apparel',
    sizes: ['2Y', '4Y', '6Y', '8Y', '10Y'],
    measurements: [
      { label: 'Height', valuesCm: [89, 101, 113, 125, 137] },
      { label: 'Chest', valuesCm: [53, 57, 61, 65, 69] },
      { label: 'Waist', valuesCm: [51, 53, 55, 57, 59] },
    ],
  },
  footwear: {
    key: 'footwear',
    title: 'Footwear',
    fit: 'True to size',
    kind: 'footwear',
    sizes: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'],
    footLengthCm: [23.0, 23.5, 24.0, 24.5, 25.0, 26.0, 26.5, 27.5, 28.0, 29.0, 29.5, 30.5],
  },
}

/** Legacy table shape still used by the full /size-guide page. */
export const sizeCharts = {
  women: {
    title: 'Women',
    headers: ['Size', 'Bust (cm)', 'Waist (cm)', 'Hip (cm)'],
    rows: [
      ['XS', '78–82', '60–64', '86–90'],
      ['S', '83–87', '65–69', '91–95'],
      ['M', '88–92', '70–74', '96–100'],
      ['L', '93–98', '75–80', '101–106'],
      ['XL', '99–104', '81–86', '107–112'],
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
      ['XXL', '111–116', '97–102', '113–118'],
    ],
  },
  pants: {
    title: 'Pants & Trousers',
    headers: ['Size', 'Waist (in)', 'Waist (cm)', 'Hip (cm)', 'Inseam (cm)'],
    rows: [
      ['28', '28″', '71', '91', '76'],
      ['30', '30″', '76', '96', '78'],
      ['32', '32″', '81.5', '101', '80'],
      ['34', '34″', '86.5', '106', '81'],
      ['36', '36″', '91.5', '111', '81'],
      ['38', '38″', '96.5', '116', '82'],
      ['40', '40″', '101.5', '121', '82'],
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
      ['10Y', '134–140', '68–70', '58–60'],
    ],
  },
  footwear: {
    title: 'Footwear',
    headers: ['EU', 'Foot length (cm)', 'US (approx)', 'UK (approx)'],
    rows: [
      ['36', '23.0', '5.5', '3.5'],
      ['37', '23.5', '6.5', '4.5'],
      ['38', '24.0', '7.5', '5.5'],
      ['39', '24.5', '8.5', '6.5'],
      ['40', '25.0', '7.5 (M) / 9 (W)', '6.5 (M) / 7 (W)'],
      ['41', '26.0', '8 (M) / 9.5 (W)', '7 (M) / 7.5 (W)'],
      ['42', '26.5', '8.5–9', '8'],
      ['43', '27.5', '9.5–10', '9'],
      ['44', '28.0', '10.5', '9.5–10'],
      ['45', '29.0', '11.5', '10.5'],
      ['46', '29.5', '12', '11'],
      ['47', '30.5', '13', '12'],
    ],
  },
} as const

export const SIZE_GUIDE_ORDER: SizeGuideKey[] = ['women', 'men', 'pants', 'kids', 'footwear']

export function cmToIn(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10
}

export function formatMeasure(valueCm: number, unit: SizeGuideUnit): string {
  const value = unit === 'in' ? cmToIn(valueCm) : valueCm
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function resolveSizeGuideKey(
  category?: string | null,
  categorySlug?: string | null,
  productName?: string | null,
): SizeGuideKey {
  const hay = `${categorySlug ?? ''} ${category ?? ''} ${productName ?? ''}`.toLowerCase()
  if (
    hay.includes('footwear') ||
    hay.includes('shoe') ||
    hay.includes('loafer') ||
    hay.includes('sandal') ||
    hay.includes('sneaker') ||
    hay.includes('boot') ||
    hay.includes('slide') ||
    hay.includes('heel') ||
    hay.includes('flat')
  ) {
    return 'footwear'
  }
  if (
    hay.includes('pant') ||
    hay.includes('trouser') ||
    hay.includes('cargo') ||
    hay.includes('chino') ||
    hay.includes('jeans') ||
    hay.includes('denim-pant') ||
    hay.includes('jogger') ||
    hay.includes('pajama') ||
    hay.includes('pyjama')
  ) {
    return 'pants'
  }
  if (hay.includes('kid') || hay.includes('child') || hay.includes('boy') || hay.includes('girl')) {
    return 'kids'
  }
  if (hay.includes('men') && !hay.includes('women')) return 'men'
  if (hay.includes('women') || hay.includes('woman') || hay.includes('ladies')) return 'women'
  return 'women'
}

/** Display title for modal — footwear can read Men / Women / Kids when present. */
export function resolveSizeGuideTitle(
  category?: string | null,
  categorySlug?: string | null,
  productName?: string | null,
): string {
  const key = resolveSizeGuideKey(category, categorySlug, productName)
  if (key === 'pants') return 'Pants & Trousers'
  if (key !== 'footwear') return sizeGuideCharts[key].title
  const hay = `${categorySlug ?? ''} ${category ?? ''} ${productName ?? ''}`.toLowerCase()
  if (hay.includes('kid') || hay.includes('child') || hay.includes('boy') || hay.includes('girl')) {
    return "Kids' Footwear"
  }
  if (/(^|[^a-z])men([^a-z]|$)/.test(hay) || hay.includes('mens') || hay.includes("men's")) {
    return "Men's Footwear"
  }
  if (hay.includes('women') || hay.includes('woman') || hay.includes('ladies')) {
    return "Women's Footwear"
  }
  return 'Footwear'
}

export function getSizeGuideChart(
  category?: string | null,
  categorySlug?: string | null,
  productName?: string | null,
): SizeGuideChart {
  return sizeGuideCharts[resolveSizeGuideKey(category, categorySlug, productName)]
}


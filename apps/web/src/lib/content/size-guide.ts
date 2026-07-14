export type SizeGuideKey = 'women' | 'men' | 'kids' | 'footwear'

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
    title: "Women's Footwear",
    fit: 'True to size',
    kind: 'footwear',
    sizes: ['36', '37', '38', '39', '40', '41', '42', '43', '44'],
    footLengthCm: [22.5, 23.5, 24, 24.5, 25, 25.5, 26, 26.5, 27],
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
      ['36', '22.5', '5.5', '3.5'],
      ['37', '23.5', '6.5', '4.5'],
      ['38', '24.0', '7.5', '5.5'],
      ['39', '24.5', '8.5', '6.5'],
      ['40', '25.0', '9.5', '7.5'],
      ['41', '25.5', '10.5', '8.5'],
      ['42', '26.0', '11', '9'],
      ['43', '26.5', '12', '9.5'],
      ['44', '27.0', '13', '10.5'],
    ],
  },
} as const

export const SIZE_GUIDE_ORDER: SizeGuideKey[] = ['women', 'men', 'kids', 'footwear']

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
): SizeGuideKey {
  const hay = `${categorySlug ?? ''} ${category ?? ''}`.toLowerCase()
  if (
    hay.includes('footwear') ||
    hay.includes('shoe') ||
    hay.includes('loafer') ||
    hay.includes('sandal') ||
    hay.includes('sneaker') ||
    hay.includes('heel') ||
    hay.includes('flat')
  ) {
    return 'footwear'
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
): string {
  const key = resolveSizeGuideKey(category, categorySlug)
  if (key !== 'footwear') return sizeGuideCharts[key].title
  const hay = `${categorySlug ?? ''} ${category ?? ''}`.toLowerCase()
  if (hay.includes('kid') || hay.includes('child') || hay.includes('boy') || hay.includes('girl')) {
    return "Kids' Footwear"
  }
  if (/(^|[^a-z])men([^a-z]|$)/.test(hay) || hay.includes('mens') || hay.includes("men's")) {
    return "Men's Footwear"
  }
  return "Women's Footwear"
}

export function getSizeGuideChart(
  category?: string | null,
  categorySlug?: string | null,
): SizeGuideChart {
  return sizeGuideCharts[resolveSizeGuideKey(category, categorySlug)]
}

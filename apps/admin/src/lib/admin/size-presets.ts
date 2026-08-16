import { categoryIsSizeless } from '@splaro/config'

/** Size runs by storefront department — chips + comma-separated preset. */

export type SizeDeptKey =
  | 'kids'
  | 'women'
  | 'men'
  | 'footwear'
  | 'accessories'
  | 'sizeless'
  | 'default'

export const SIZE_PRESETS: Record<SizeDeptKey, string> = {
  kids: '0-3M, 3-6M, 6-9M, 9-12M, 12-18M, 18-24M, 2/3, 4/5, 6/7, 8/9, 10/11, 12/13',
  women: 'XS, S, M, L, XL, XXL',
  men: 'S, M, L, XL, XXL, 3XL',
  footwear: '36, 37, 38, 39, 40, 41, 42, 43, 44',
  accessories: 'One Size',
  // Saree, wallet, watch, prayer cap: a size run makes no sense, so the form
  // hides the field entirely and variants are colour-only.
  sizeless: '',
  default: 'S, M, L, XL, XXL',
}

export function sizeChipsForDept(key: SizeDeptKey): string[] {
  const preset = SIZE_PRESETS[key] ?? SIZE_PRESETS.default
  return preset.split(', ').filter(Boolean)
}

/** True when this department's products have no size run — hide the size field. */
export function deptHasNoSize(key: SizeDeptKey): boolean {
  return key === 'sizeless'
}

export function sizeDeptFromSlugOrName(nameOrSlug: string | null | undefined): SizeDeptKey {
  const key = (nameOrSlug ?? '').toLowerCase()
  if (!key) return 'default'
  // Checked first, and delegated to @splaro/config so the panel and the API
  // agree on which categories are sizeless: a saree lives under "Women" but is
  // sold in one size, and the old ordering handed it the women's XS–XXL run.
  if (categoryIsSizeless(key)) return 'sizeless'
  if (key.includes('access') || key.includes('bag') || key.includes('handbag')) {
    return 'accessories'
  }
  if (key.includes('foot') || key.includes('shoe') || key.includes('sandal') || key.includes('sneaker')) {
    return 'footwear'
  }
  if (key.includes('kid') || key.includes('baby') || key.includes('child') || key.includes('girl') || key.includes('boy')) {
    return 'kids'
  }
  if (key.includes('women') || key.includes('woman') || key.includes('kurti')) {
    return 'women'
  }
  if (key.includes('men') || key.includes('man') || key.includes('panjabi')) {
    return 'men'
  }
  return 'default'
}

/** Upload / library folder for department-separated media. */
export const MEDIA_DEPT_FOLDERS = [
  { key: 'all', label: 'All media', folder: 'products' },
  { key: 'men', label: 'Men', folder: 'products-men' },
  { key: 'women', label: 'Women', folder: 'products-women' },
  { key: 'kids', label: 'Kids', folder: 'products-kids' },
  { key: 'footwear', label: 'Footwear', folder: 'products-footwear' },
  { key: 'accessories', label: 'Accessories', folder: 'products-accessories' },
] as const

export type MediaDeptFolder = (typeof MEDIA_DEPT_FOLDERS)[number]['folder']

export function mediaFolderForDept(slugOrName: string | null | undefined): MediaDeptFolder {
  const dept = sizeDeptFromSlugOrName(slugOrName)
  // Media folders follow the storefront department, not the size run — a saree
  // is sizeless but its photos still belong under Women.
  if (dept === 'sizeless') {
    const key = (slugOrName ?? '').toLowerCase()
    if (key.includes('saree') || key.includes('sari')) return 'products-women'
    return 'products-accessories'
  }
  if (dept === 'men') return 'products-men'
  if (dept === 'women') return 'products-women'
  if (dept === 'kids') return 'products-kids'
  if (dept === 'footwear') return 'products-footwear'
  if (dept === 'accessories') return 'products-accessories'
  return 'products'
}

export function mediaDeptKeyFromUrl(url: string): string {
  for (const row of MEDIA_DEPT_FOLDERS) {
    if (row.folder === 'products') continue
    if (url.includes(`/uploads/${row.folder}/`)) return row.key
  }
  if (url.includes('/uploads/products/')) return 'all'
  return 'all'
}

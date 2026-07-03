export type Category = 'All' | 'Summer Edition' | 'Men' | 'Women' | 'Kids' | 'Footwear' | 'Accessories'
export type ProductStatus = 'Ready' | 'Limited' | 'New'

export interface ColorOption {
  id: string
  hex: string
  name: string
  image: string
}

export interface StorefrontVariantRef {
  /** Real database variant id — required for cart sync and order placement */
  id: string
  size?: string
  colorHex?: string
  stock: number
  isActive: boolean
}

export interface StorefrontProduct {
  id: string
  name: string
  code: string
  category: Exclude<Category, 'All'>
  /** Price in Bangladesh Taka (BDT) */
  price: number
  compareAtPrice?: number
  colors: string[]
  colorOptions?: ColorOption[]
  sizes: string[]
  status: ProductStatus
  /** When false, card shows Out Of Stock dock. Derived from API variants when live. */
  inStock?: boolean
  isNewArrival?: boolean
  isBestSeller?: boolean
  image: string
  hoverImage: string
  media?: { type: 'image' | 'video'; url: string; alt?: string }[]
  fit: string
  material: string
  /** Real API variants (id + size + colorHex) so quick-add can send a valid variantId */
  variantRefs?: StorefrontVariantRef[]
}

export function isStorefrontNewArrival(product: StorefrontProduct) {
  return product.isNewArrival === true || product.status === 'New'
}

export function isStorefrontBestSeller(product: StorefrontProduct) {
  return product.isBestSeller === true || product.status === 'Limited'
}

export interface CollectionCard {
  slug: string
  label: Exclude<Category, 'All'>
  image: string
  count: number
}

export const categories: Category[] = ['All', 'Summer Edition', 'Men', 'Women', 'Kids', 'Footwear', 'Accessories']

export const shopFilterMenuCategories: Category[] = ['All', 'Women', 'Kids', 'Footwear', 'Accessories']

export const sizes = [
  'All',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  '2Y',
  '4Y',
  '6Y',
  '8Y',
  '38',
  '39',
  '40',
  '41',
  '42',
]

export const colorNames = ['All', 'White', 'Blue', 'Grey', 'Pink', 'Black'] as const

export const sortOptions = ['Default', 'Newest', 'Price low to high', 'Price high to low'] as const

export const priceFilters = [
  'All',
  'Under BDT 6,000',
  'BDT 6,000 – 10,000',
  'Above BDT 10,000',
] as const

export const PRICE_FILTER_LOW = 6000
export const PRICE_FILTER_HIGH = 10000

export const products: StorefrontProduct[] = [
  {
    id: 'sp-261',
    name: 'Summer Air Overshirt',
    code: '261901S',
    category: 'Summer Edition',
    price: 7480,
    compareAtPrice: 8900,
    colors: ['#f2f0e8', '#b8c6bd', '#111111'],
    colorOptions: [
      {
        id: '#f2f0e8',
        hex: '#f2f0e8',
        name: 'Ivory',
        image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#b8c6bd',
        hex: '#b8c6bd',
        name: 'Sage',
        image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#111111',
        hex: '#111111',
        name: 'Black',
        image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    status: 'New',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=900&q=88&auto=format&fit=crop',
    fit: 'Relaxed',
    material: 'Cotton blend',
  },
  {
    id: 'sp-262',
    name: 'Washed Utility Shirt',
    code: '262044M',
    category: 'Men',
    price: 8140,
    colors: ['#d8d6ce', '#1f2a2e'],
    colorOptions: [
      {
        id: '#d8d6ce',
        hex: '#d8d6ce',
        name: 'Sand',
        image: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#1f2a2e',
        hex: '#1f2a2e',
        name: 'Deep Navy',
        image: 'https://images.unsplash.com/photo-1507680434567-5739c80be1ac?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['M', 'L', 'XL'],
    status: 'Ready',
    image: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1507680434567-5739c80be1ac?w=900&q=88&auto=format&fit=crop',
    fit: 'Regular',
    material: 'Soft twill',
  },
  {
    id: 'sp-263',
    name: 'Soft Structure Dress',
    code: '263118W',
    category: 'Women',
    price: 10120,
    compareAtPrice: 12500,
    colors: ['#f6d6d2', '#ece7dd', '#222222'],
    colorOptions: [
      {
        id: '#f6d6d2',
        hex: '#f6d6d2',
        name: 'Blush',
        image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#ece7dd',
        hex: '#ece7dd',
        name: 'Oat',
        image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#222222',
        hex: '#222222',
        name: 'Charcoal',
        image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['XS', 'S', 'M', 'L'],
    status: 'Limited',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&q=88&auto=format&fit=crop',
    fit: 'Tailored',
    material: 'Viscose satin',
  },
  {
    id: 'sp-264',
    name: 'Kids Everyday Set',
    code: '264207K',
    category: 'Kids',
    price: 5280,
    colors: ['#f7c9d7', '#8dc7c8', '#f1c34b'],
    colorOptions: [
      {
        id: '#f7c9d7',
        hex: '#f7c9d7',
        name: 'Rose',
        image: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#8dc7c8',
        hex: '#8dc7c8',
        name: 'Aqua',
        image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#f1c34b',
        hex: '#f1c34b',
        name: 'Sun',
        image: 'https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['2Y', '4Y', '6Y', '8Y'],
    status: 'Ready',
    image: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&q=88&auto=format&fit=crop',
    fit: 'Easy',
    material: 'Jersey cotton',
  },
  {
    id: 'sp-265',
    name: 'Low Profile Trainer',
    code: '265630F',
    category: 'Footwear',
    price: 9460,
    compareAtPrice: 11200,
    colors: ['#f5f5f0', '#c9c1b5', '#121212'],
    colorOptions: [
      {
        id: '#f5f5f0',
        hex: '#f5f5f0',
        name: 'Cloud',
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#c9c1b5',
        hex: '#c9c1b5',
        name: 'Stone',
        image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#121212',
        hex: '#121212',
        name: 'Onyx',
        image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['38', '39', '40', '41', '42'],
    status: 'New',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=900&q=88&auto=format&fit=crop',
    fit: 'True to size',
    material: 'Leather mix',
  },
  {
    id: 'sp-266',
    name: 'Pleated Resort Set',
    code: '266412S',
    category: 'Summer Edition',
    price: 12100,
    colors: ['#f6efe5', '#d7bca2'],
    colorOptions: [
      {
        id: '#f6efe5',
        hex: '#f6efe5',
        name: 'Cream',
        image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#d7bca2',
        hex: '#d7bca2',
        name: 'Camel',
        image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['S', 'M', 'L'],
    status: 'Limited',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=900&q=88&auto=format&fit=crop',
    fit: 'Fluid',
    material: 'Crepe',
  },
  {
    id: 'sp-267',
    name: 'Minimal Weekend Jacket',
    code: '267842M',
    category: 'Men',
    price: 14080,
    compareAtPrice: 16800,
    colors: ['#dad6cc', '#253036'],
    colorOptions: [
      {
        id: '#dad6cc',
        hex: '#dad6cc',
        name: 'Mist',
        image: 'https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#253036',
        hex: '#253036',
        name: 'Forest',
        image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    status: 'Ready',
    image: 'https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=900&q=88&auto=format&fit=crop',
    fit: 'Boxy',
    material: 'Brushed cotton',
  },
  {
    id: 'sp-268',
    name: 'Kids Rib Pocket Tee',
    code: '268030K',
    category: 'Kids',
    price: 3520,
    colors: ['#e9d4ef', '#f0b350', '#8fbfc6'],
    colorOptions: [
      {
        id: '#e9d4ef',
        hex: '#e9d4ef',
        name: 'Lilac',
        image: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#f0b350',
        hex: '#f0b350',
        name: 'Amber',
        image: 'https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#8fbfc6',
        hex: '#8fbfc6',
        name: 'Sky',
        image: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['2Y', '4Y', '6Y'],
    status: 'New',
    image: 'https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=900&q=88&auto=format&fit=crop',
    fit: 'Comfort',
    material: 'Rib cotton',
  },
  {
    id: 'sp-269',
    name: 'Linen Day Shirt',
    code: '269118S',
    category: 'Summer Edition',
    price: 6380,
    colors: ['#f4f0e6', '#c8d5c4'],
    colorOptions: [
      {
        id: '#f4f0e6',
        hex: '#f4f0e6',
        name: 'Cream',
        image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#c8d5c4',
        hex: '#c8d5c4',
        name: 'Sage',
        image: 'https://images.unsplash.com/photo-1620012253295-c15cc3e65bf4?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    status: 'Ready',
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1620012253295-c15cc3e65bf4?w=900&q=88&auto=format&fit=crop',
    fit: 'Relaxed',
    material: 'Pure linen',
  },
  {
    id: 'sp-270',
    name: 'Structured Midi Skirt',
    code: '270552W',
    category: 'Women',
    price: 8580,
    colors: ['#ece7dd', '#222222'],
    colorOptions: [
      {
        id: '#ece7dd',
        hex: '#ece7dd',
        name: 'Oat',
        image: 'https://images.unsplash.com/photo-1583496664520-9a2388240e1b?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#222222',
        hex: '#222222',
        name: 'Charcoal',
        image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['XS', 'S', 'M', 'L'],
    status: 'New',
    image: 'https://images.unsplash.com/photo-1583496664520-9a2388240e1b?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900&q=88&auto=format&fit=crop',
    fit: 'A-line',
    material: 'Woven blend',
  },
  {
    id: 'sp-271',
    name: 'City Runner Sneaker',
    code: '271901F',
    category: 'Footwear',
    price: 10560,
    compareAtPrice: 12800,
    colors: ['#f5f5f0', '#121212'],
    colorOptions: [
      {
        id: '#f5f5f0',
        hex: '#f5f5f0',
        name: 'Cloud',
        image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#121212',
        hex: '#121212',
        name: 'Onyx',
        image: 'https://images.unsplash.com/photo-1605348532760-67531244333f?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['38', '39', '40', '41', '42'],
    status: 'Limited',
    image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1605348532760-67531244333f?w=900&q=88&auto=format&fit=crop',
    fit: 'True to size',
    material: 'Mesh upper',
  },
  {
    id: 'sp-272',
    name: 'Essential Chino Trouser',
    code: '272044M',
    category: 'Men',
    price: 7040,
    colors: ['#d8d6ce', '#253036'],
    colorOptions: [
      {
        id: '#d8d6ce',
        hex: '#d8d6ce',
        name: 'Sand',
        image: 'https://images.unsplash.com/photo-1473966968600-fa801b279a1a?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#253036',
        hex: '#253036',
        name: 'Forest',
        image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    status: 'Ready',
    image: 'https://images.unsplash.com/photo-1473966968600-fa801b279a1a?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=900&q=88&auto=format&fit=crop',
    fit: 'Tapered',
    material: 'Stretch cotton',
  },
  /* ── New products ─────────────────────────────────────────────── */
  {
    id: 'sp-273',
    name: 'Fluid Wrap Dress',
    code: '273209W',
    category: 'Women',
    price: 9200,
    colors: ['#f6d6d2', '#dad6cc', '#253036'],
    colorOptions: [
      {
        id: '#f6d6d2',
        hex: '#f6d6d2',
        name: 'Blush',
        image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#dad6cc',
        hex: '#dad6cc',
        name: 'Mist',
        image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#253036',
        hex: '#253036',
        name: 'Forest',
        image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['XS', 'S', 'M', 'L'],
    status: 'New',
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=88&auto=format&fit=crop',
    fit: 'Fluid',
    material: 'Silk-touch crepe',
  },
  {
    id: 'sp-274',
    name: 'Classic Oxford Shirt',
    code: '274115M',
    category: 'Men',
    price: 6800,
    compareAtPrice: 8200,
    colors: ['#f5f5f0', '#1f2a2e', '#dc2626'],
    colorOptions: [
      {
        id: '#f5f5f0',
        hex: '#f5f5f0',
        name: 'White',
        image: 'https://images.unsplash.com/photo-1473966968600-fa801b279a1a?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#1f2a2e',
        hex: '#1f2a2e',
        name: 'Deep Navy',
        image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#dc2626',
        hex: '#dc2626',
        name: 'Red',
        image: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    status: 'Ready',
    image: 'https://images.unsplash.com/photo-1473966968600-fa801b279a1a?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=900&q=88&auto=format&fit=crop',
    fit: 'Regular',
    material: 'Oxford cotton',
  },
  {
    id: 'sp-275',
    name: 'High Canvas Sneaker',
    code: '275770F',
    category: 'Footwear',
    price: 8240,
    colors: ['#f5f5f0', '#111111', '#8dc7c8'],
    colorOptions: [
      {
        id: '#f5f5f0',
        hex: '#f5f5f0',
        name: 'White',
        image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#111111',
        hex: '#111111',
        name: 'Black',
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#8dc7c8',
        hex: '#8dc7c8',
        name: 'Aqua',
        image: 'https://images.unsplash.com/photo-1605348532760-67531244333f?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['38', '39', '40', '41', '42'],
    status: 'New',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=88&auto=format&fit=crop',
    fit: 'True to size',
    material: 'Canvas upper',
  },
  {
    id: 'sp-276',
    name: 'Breezy Linen Co-ord',
    code: '276503S',
    category: 'Summer Edition',
    price: 11400,
    compareAtPrice: 13600,
    colors: ['#f6efe5', '#b8c6bd'],
    colorOptions: [
      {
        id: '#f6efe5',
        hex: '#f6efe5',
        name: 'Cream',
        image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#b8c6bd',
        hex: '#b8c6bd',
        name: 'Sage',
        image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['XS', 'S', 'M', 'L'],
    status: 'Limited',
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=900&q=88&auto=format&fit=crop',
    fit: 'Relaxed',
    material: 'Washed linen',
  },
  {
    id: 'sp-277',
    name: 'Toddler Knit Pullover',
    code: '277084K',
    category: 'Kids',
    price: 4200,
    colors: ['#f0b350', '#8fbfc6', '#f7c9d7'],
    colorOptions: [
      {
        id: '#f0b350',
        hex: '#f0b350',
        name: 'Amber',
        image: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#8fbfc6',
        hex: '#8fbfc6',
        name: 'Sky',
        image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#f7c9d7',
        hex: '#f7c9d7',
        name: 'Rose',
        image: 'https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['2Y', '4Y', '6Y', '8Y'],
    status: 'Ready',
    image: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&q=88&auto=format&fit=crop',
    fit: 'Comfort',
    material: 'Soft knit',
  },
  {
    id: 'sp-278',
    name: 'Tailored Blazer',
    code: '278960W',
    category: 'Women',
    price: 15200,
    compareAtPrice: 18000,
    colors: ['#111111', '#f2f0e8', '#253036'],
    colorOptions: [
      {
        id: '#111111',
        hex: '#111111',
        name: 'Black',
        image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#f2f0e8',
        hex: '#f2f0e8',
        name: 'Ivory',
        image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=85&auto=format&fit=crop',
      },
      {
        id: '#253036',
        hex: '#253036',
        name: 'Forest',
        image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=85&auto=format&fit=crop',
      },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    status: 'New',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=88&auto=format&fit=crop',
    hoverImage: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=900&q=88&auto=format&fit=crop',
    fit: 'Tailored',
    material: 'Wool blend',
  },
]

export function slugFromCategory(category: Exclude<Category, 'All'>): string {
  return category.toLowerCase().replace(/\s+/g, '-')
}

export function categoryFromSlug(slug: string): Exclude<Category, 'All'> | null {
  const found = (categories.filter((c) => c !== 'All') as Exclude<Category, 'All'>[]).find(
    (c) => slugFromCategory(c) === slug,
  )
  return found ?? null
}

export function colorGroup(hex: string): string {
  const h = hex.toLowerCase()
  if (['#f2f0e8', '#f5f5f0', '#ece7dd', '#f6efe5', '#f4f0e6', '#dad6cc', '#d8d6ce', '#f6d6d2', '#f7c9d7', '#e9d4ef', '#c9c1b5'].includes(h)) return 'White'
  if (['#b8c6bd', '#8dc7c8', '#8fbfc6', '#c8d5c4', '#1f2a2e', '#253036'].includes(h)) return 'Blue'
  if (['#d7bca2', '#c9c1b5', '#dad6cc', '#d8d6ce'].includes(h)) return 'Grey'
  if (['#f6d6d2', '#f7c9d7', '#f0b350', '#f1c34b', '#e9d4ef'].includes(h)) return 'Pink'
  if (['#111111', '#222222', '#121212', '#101114', '#1f2a2e', '#253036'].includes(h)) return 'Black'
  return 'White'
}

const SIZE_SORT_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2Y', '4Y', '6Y', '8Y', '10Y', '12Y'] as const
const COLOR_SORT_ORDER = ['White', 'Black', 'Grey', 'Blue', 'Brown', 'Beige', 'Pink', 'Red', 'Green'] as const

export type ShopSizeKind = 'apparel' | 'kids' | 'footwear'

/** Classify a size token for category-aware filter UI. */
export function classifyShopSize(size: string): ShopSizeKind {
  if (/^\d+Y$/i.test(size)) return 'kids'
  if (/^\d+$/.test(size)) return 'footwear'
  return 'apparel'
}

export function getShopSizeKindForCategory(category: Category): ShopSizeKind | null {
  if (category === 'All') return null
  if (category === 'Kids') return 'kids'
  if (category === 'Footwear') return 'footwear'
  return 'apparel'
}

export function getShopSizeSectionMeta(category: Category): {
  title: string
  hint: string
  enabled: boolean
} {
  const kind = getShopSizeKindForCategory(category)
  if (!kind) {
    return {
      title: 'Size',
      hint: 'Select a category first to see the right sizes.',
      enabled: false,
    }
  }
  if (kind === 'kids') {
    return {
      title: 'Size',
      hint: 'Kids age sizes',
      enabled: true,
    }
  }
  if (kind === 'footwear') {
    return {
      title: 'Size',
      hint: 'Shoe sizes (EU)',
      enabled: true,
    }
  }
  return {
    title: 'Size',
    hint: 'Clothing sizes',
    enabled: true,
  }
}

export function sortShopSizes(values: string[], category?: Category): string[] {
  const scoped = category && category !== 'All' ? category : undefined
  const footwear = scoped === 'Footwear'
  const numeric = values.length > 0 && values.every((size) => /^\d+$/.test(size))

  if (footwear || numeric) {
    return [...values].sort((a, b) => Number(a) - Number(b))
  }

  return [...values].sort((a, b) => {
    const ai = SIZE_SORT_ORDER.indexOf(a as (typeof SIZE_SORT_ORDER)[number])
    const bi = SIZE_SORT_ORDER.indexOf(b as (typeof SIZE_SORT_ORDER)[number])
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

function productsInCategory(catalog: StorefrontProduct[], category: Category) {
  if (category === 'All') return catalog
  return catalog.filter((product) => product.category === category)
}

/** Size filter options scoped to the active shop category. */
export function getShopSizeOptions(catalog: StorefrontProduct[], category: Category): string[] {
  const kind = getShopSizeKindForCategory(category)
  if (!kind) return ['All']

  const unique = [
    ...new Set(
      productsInCategory(catalog, category)
        .flatMap((product) => product.sizes)
        .filter((size) => classifyShopSize(size) === kind),
    ),
  ]

  return ['All', ...sortShopSizes(unique, category)]
}

/** Color filter options scoped to the active shop category. */
export function getShopColorOptions(catalog: StorefrontProduct[], category: Category): string[] {
  const groups = new Set<string>()

  for (const product of productsInCategory(catalog, category)) {
    for (const hex of product.colors) {
      groups.add(colorGroup(hex))
    }
  }

  const sorted = [...groups].sort((a, b) => {
    const ai = COLOR_SORT_ORDER.indexOf(a as (typeof COLOR_SORT_ORDER)[number])
    const bi = COLOR_SORT_ORDER.indexOf(b as (typeof COLOR_SORT_ORDER)[number])
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return ['All', ...sorted]
}

export const collectionCards: CollectionCard[] = [
  {
    slug: 'summer-edition',
    label: 'Summer Edition',
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=88&auto=format&fit=crop',
    count: products.filter((p) => p.category === 'Summer Edition').length,
  },
  {
    slug: 'men',
    label: 'Men',
    image: 'https://images.unsplash.com/photo-1507680434567-5739c80be1ac?w=800&q=88&auto=format&fit=crop',
    count: products.filter((p) => p.category === 'Men').length,
  },
  {
    slug: 'women',
    label: 'Women',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=88&auto=format&fit=crop',
    count: products.filter((p) => p.category === 'Women').length,
  },
  {
    slug: 'kids',
    label: 'Kids',
    image: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=800&q=88&auto=format&fit=crop',
    count: products.filter((p) => p.category === 'Kids').length,
  },
  {
    slug: 'footwear',
    label: 'Footwear',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=88&auto=format&fit=crop',
    count: products.filter((p) => p.category === 'Footwear').length,
  },
  {
    slug: 'accessories',
    label: 'Accessories',
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=88&auto=format&fit=crop',
    count: 3,
  },
]

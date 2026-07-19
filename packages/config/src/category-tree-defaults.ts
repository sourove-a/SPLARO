/** Default SPLARO department + subcategory tree (idempotent seed). */

export const CATEGORY_DEPARTMENTS = [
  { name: 'Women', slug: 'women', sortOrder: 1 },
  { name: 'Men', slug: 'men', sortOrder: 2 },
  { name: 'Kids', slug: 'kids', sortOrder: 3 },
  { name: 'Footwear', slug: 'footwear', sortOrder: 4 },
  { name: 'Accessories', slug: 'accessories', sortOrder: 5 },
  { name: 'New Arrivals', slug: 'new-arrivals', sortOrder: 6 },
] as const

/**
 * Admin product-picker tree. Upsert by slug — re-seed never creates duplicates.
 * Storefront mega / homepage tiles only surface categories that already have products.
 */
export const CATEGORY_SUBCATEGORIES: Record<string, { name: string; slug: string }[]> = {
  men: [
    { name: 'Polo Shirt', slug: 'polo-shirts' },
    { name: 'Casual Shirt', slug: 'casual-shirts' },
    { name: 'Formal Shirt', slug: 'formal-shirts' },
    { name: 'T-Shirt', slug: 't-shirts' },
    { name: 'Blazer', slug: 'blazers' },
    { name: 'Pants', slug: 'trousers' },
    { name: 'Full Sleeve', slug: 'full-sleeve' },
    { name: 'Half Sleeve', slug: 'half-sleeve' },
    { name: 'Formal Pants', slug: 'formal-pants' },
    { name: 'Denim Pant', slug: 'denim-pants' },
    { name: 'Chino Pant', slug: 'chino-pants' },
    { name: 'Joggers / Trouser', slug: 'joggers' },
    { name: 'Relax Wear', slug: 'relax-wear' },
    { name: 'Lungi', slug: 'lungi' },
    { name: 'Panjabi', slug: 'panjabi' },
    { name: 'Fatua', slug: 'fatua' },
    { name: 'Short Kurta', slug: 'short-kurta' },
    { name: 'Casual Wear', slug: 'men-casual' },
    { name: 'Jackets', slug: 'men-jackets' },
    { name: 'Shawls', slug: 'men-shawls' },
    { name: 'Scarves & Mufflers', slug: 'scarves-mufflers' },
    { name: 'Sleeping Suits', slug: 'men-sleeping-suits' },
  ],
  women: [
    { name: 'Kameez', slug: 'kameez' },
    { name: 'Salwar Kameez', slug: 'shalwar-kameez' },
    { name: 'Single Kameez', slug: 'single-kameez' },
    { name: 'Single Kurti', slug: 'single-kurti' },
    { name: 'Kurti & Tunics', slug: 'kurti-tunics' },
    { name: 'Saree', slug: 'sarees' },
    { name: 'Western Tops', slug: 'western-tops' },
    { name: 'Burqa & Abaya', slug: 'burqa-abaya' },
    { name: 'Pants', slug: 'women-pants' },
    { name: 'Dresses', slug: 'dresses' },
    { name: 'Ethnic Wear', slug: 'ethnic-wear' },
    { name: 'Western Wear', slug: 'western-wear' },
    { name: 'Tops & Tees', slug: 'tops-tees' },
    { name: 'Bridal', slug: 'bridal' },
    { name: 'Denim & Jeans', slug: 'denim-jeans' },
    { name: 'Leggings', slug: 'leggings' },
    { name: 'Skirts', slug: 'skirts' },
    { name: 'Coats & Jackets', slug: 'women-coats-jackets' },
    { name: 'Shawls', slug: 'women-shawls' },
    { name: 'Maternity', slug: 'maternity' },
    { name: 'Nightwear', slug: 'nightwear' },
  ],
  kids: [
    { name: 'Girls Wear', slug: 'girls-wear' },
    { name: 'Boys Wear', slug: 'boys-wear' },
    { name: 'Baby & Toddler', slug: 'baby-toddler' },
    { name: 'Ethnic Kids', slug: 'ethnic-kids' },
    { name: 'Ghagra & Lehenga', slug: 'kids-ghagra-lehenga' },
    { name: 'Party Wear', slug: 'kids-party-wear' },
    { name: 'School Wear', slug: 'school-wear' },
  ],
  footwear: [
    { name: "Women's Shoes", slug: 'women-footwear' },
    { name: "Men's Shoes", slug: 'men-footwear' },
    { name: "Kids' Shoes", slug: 'kids-footwear' },
    { name: 'Sandals', slug: 'sandals' },
    { name: 'Sneakers', slug: 'sneakers' },
    { name: 'Heels', slug: 'heels' },
    { name: 'Flats', slug: 'flats' },
    { name: 'Loafers', slug: 'loafers' },
  ],
  accessories: [
    { name: "Women's Bags", slug: 'bags' },
    { name: 'Handbags', slug: 'handbags' },
    { name: 'Wallets', slug: 'wallets' },
    { name: 'Belts', slug: 'belts' },
    { name: 'Scarves', slug: 'scarves' },
    { name: 'Jewelry', slug: 'jewelry' },
    { name: 'Glasses', slug: 'glasses' },
    { name: 'Watches', slug: 'watches' },
    { name: 'Prayer Caps', slug: 'prayer-caps' },
    { name: 'Home Decor', slug: 'home-decor' },
  ],
}

export const DEPARTMENT_SLUGS = ['women', 'men', 'kids', 'footwear', 'accessories', 'new-arrivals'] as const

export type DepartmentSlug = (typeof DEPARTMENT_SLUGS)[number]

export function departmentHref(slug: string): string {
  return `/c/${slug}`
}

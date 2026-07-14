/** Default SPLARO department + subcategory tree (idempotent seed). */

export const CATEGORY_DEPARTMENTS = [
  { name: 'Women', slug: 'women', sortOrder: 1 },
  { name: 'Men', slug: 'men', sortOrder: 2 },
  { name: 'Kids', slug: 'kids', sortOrder: 3 },
  { name: 'Footwear', slug: 'footwear', sortOrder: 4 },
  { name: 'Accessories', slug: 'accessories', sortOrder: 5 },
  { name: 'New Arrivals', slug: 'new-arrivals', sortOrder: 6 },
] as const

export const CATEGORY_SUBCATEGORIES: Record<string, { name: string; slug: string }[]> = {
  kids: [
    { name: 'Girls Wear', slug: 'girls-wear' },
    { name: 'Boys Wear', slug: 'boys-wear' },
    { name: 'Baby & Toddler', slug: 'baby-toddler' },
    { name: 'Ethnic Kids', slug: 'ethnic-kids' },
    { name: 'Ghagra & Lehenga', slug: 'kids-ghagra-lehenga' },
    { name: 'Party Wear', slug: 'kids-party-wear' },
    { name: 'School Wear', slug: 'school-wear' },
  ],
  women: [
    { name: 'Sarees', slug: 'sarees' },
    { name: 'Ethnic Wear', slug: 'ethnic-wear' },
    { name: 'Kurti & Tunics', slug: 'kurti-tunics' },
    { name: 'Dresses', slug: 'dresses' },
    { name: 'Western Wear', slug: 'western-wear' },
    { name: 'Bridal', slug: 'bridal' },
    { name: 'Tops & Tees', slug: 'tops-tees' },
    { name: 'Denim & Jeans', slug: 'denim-jeans' },
    { name: 'Leggings', slug: 'leggings' },
  ],
  men: [
    { name: 'Panjabi', slug: 'panjabi' },
    { name: 'T-Shirts', slug: 't-shirts' },
    { name: 'Polo Shirts', slug: 'polo-shirts' },
    { name: 'Formal Shirts', slug: 'formal-shirts' },
    { name: 'Casual Wear', slug: 'men-casual' },
    { name: 'Trousers', slug: 'trousers' },
  ],
  footwear: [
    { name: 'Women Footwear', slug: 'women-footwear' },
    { name: 'Men Footwear', slug: 'men-footwear' },
    { name: 'Kids Footwear', slug: 'kids-footwear' },
    { name: 'Sandals', slug: 'sandals' },
    { name: 'Sneakers', slug: 'sneakers' },
  ],
}

export const DEPARTMENT_SLUGS = ['women', 'men', 'kids', 'footwear', 'accessories', 'new-arrivals'] as const

export type DepartmentSlug = (typeof DEPARTMENT_SLUGS)[number]

export function departmentHref(slug: string): string {
  return `/c/${slug}`
}

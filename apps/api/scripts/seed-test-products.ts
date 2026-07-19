/**
 * Seed 30 storefront products for local QA.
 * Idempotent: updates only these SPL-QA slugs, leaves other catalog rows alone.
 */
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { CATEGORY_DEPARTMENTS, CATEGORY_SUBCATEGORIES } from '@splaro/config'

const prisma = new PrismaClient()

type SeedColor = { name: string; hex: string; sizes: string[]; image?: string }
type SeedProduct = {
  name: string
  slug: string
  categorySlug: string
  price: number
  compareAtPrice?: number
  image: string
  hoverImage: string
  badge?: string
  isFeatured?: boolean
  isNewArrival?: boolean
  isBestSeller?: boolean
  fitType?: string
  fabricContent?: string
  occasion?: string
  colors: SeedColor[]
}

const PRODUCTS: SeedProduct[] = [
  {
    name: 'Pearl Cotton Everyday Saree',
    slug: 'pearl-cotton-everyday-saree',
    categorySlug: 'sarees',
    price: 3490,
    compareAtPrice: 3990,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?w=900&q=86&auto=format&fit=max',
    isFeatured: true,
    isNewArrival: true,
    fitType: 'Regular drape',
    fabricContent: 'Premium cotton blend',
    occasion: 'Everyday, office, family gathering',
    colors: [
      { name: 'Pearl', hex: '#eee8dc', sizes: ['Free Size'] },
      { name: 'Ink', hex: '#1f3145', sizes: ['Free Size'] },
    ],
  },
  {
    name: 'Rose Eid Embroidered Kameez',
    slug: 'rose-eid-embroidered-kameez',
    categorySlug: 'ethnic-wear',
    price: 4290,
    compareAtPrice: 4890,
    image: 'https://images.unsplash.com/photo-1594709287485-447f40e8d7a8?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=900&q=86&auto=format&fit=max',
    badge: 'Limited',
    isBestSeller: true,
    fitType: 'Straight fit',
    fabricContent: 'Embroidered viscose cotton',
    occasion: 'Eid, dinner, formal visit',
    colors: [
      { name: 'Rose', hex: '#c98791', sizes: ['S', 'M', 'L', 'XL'] },
      { name: 'Sage', hex: '#8f9b86', sizes: ['S', 'M', 'L'] },
    ],
  },
  {
    name: 'Skyline Soft Denim Shirt Dress',
    slug: 'skyline-soft-denim-shirt-dress',
    categorySlug: 'dresses',
    price: 2990,
    image: 'https://images.unsplash.com/photo-1520975954732-35dd22299614?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=86&auto=format&fit=max',
    isNewArrival: true,
    fitType: 'Relaxed fit',
    fabricContent: 'Soft washed denim',
    occasion: 'Daily, campus, travel',
    colors: [{ name: 'Washed Blue', hex: '#6f8faa', sizes: ['S', 'M', 'L'] }],
  },
  {
    name: 'Noir Tailored Formal Shirt',
    slug: 'noir-tailored-formal-shirt',
    categorySlug: 'formal-shirts',
    price: 2590,
    compareAtPrice: 2990,
    image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=900&q=86&auto=format&fit=max',
    fitType: 'Tailored fit',
    fabricContent: 'Cotton poplin',
    occasion: 'Office, meeting, evening',
    colors: [
      { name: 'Noir', hex: '#111111', sizes: ['M', 'L', 'XL'] },
      { name: 'White', hex: '#f7f7f2', sizes: ['M', 'L', 'XL'] },
    ],
  },
  {
    name: 'Linen Friday Panjabi',
    slug: 'linen-friday-panjabi',
    categorySlug: 'panjabi',
    price: 3690,
    compareAtPrice: 4190,
    image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=900&q=86&auto=format&fit=max',
    isFeatured: true,
    fitType: 'Comfort fit',
    fabricContent: 'Breathable linen cotton',
    occasion: 'Jummah, Eid, family program',
    colors: [
      { name: 'Sand', hex: '#c8b89b', sizes: ['M', 'L', 'XL', 'XXL'] },
      { name: 'Olive', hex: '#6d7458', sizes: ['M', 'L', 'XL'] },
    ],
  },
  {
    name: 'Kids Garden Party Frock',
    slug: 'kids-garden-party-frock',
    categorySlug: 'girls-wear',
    price: 2190,
    compareAtPrice: 2490,
    image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=900&q=86&auto=format&fit=max',
    isNewArrival: true,
    fitType: 'Comfort fit',
    fabricContent: 'Soft cotton voile',
    occasion: 'Party, birthday, family day',
    colors: [{ name: 'Blush', hex: '#f1b8c6', sizes: ['4-5Y', '6-7Y', '8-9Y'] }],
  },
  {
    name: 'Boys Smart Cotton Co-ord',
    slug: 'boys-smart-cotton-co-ord',
    categorySlug: 'boys-wear',
    price: 2390,
    image: 'https://images.unsplash.com/photo-1503919005314-30d93d07d823?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=900&q=86&auto=format&fit=max',
    fitType: 'Easy fit',
    fabricContent: 'Cotton twill',
    occasion: 'Weekend, travel, casual event',
    colors: [
      { name: 'Navy', hex: '#17233f', sizes: ['4-5Y', '6-7Y', '8-9Y'] },
      { name: 'Khaki', hex: '#b9a77f', sizes: ['4-5Y', '6-7Y'] },
    ],
  },
  {
    name: 'Avery Block Heel Sandal',
    slug: 'avery-block-heel-sandal',
    categorySlug: 'women-footwear',
    price: 3190,
    compareAtPrice: 3590,
    image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=86&auto=format&fit=max',
    isBestSeller: true,
    fitType: 'Comfort heel',
    fabricContent: 'Synthetic leather',
    occasion: 'Office, party, dinner',
    colors: [
      { name: 'Tan', hex: '#b6845c', sizes: ['36', '37', '38', '39', '40'] },
      { name: 'Black', hex: '#101010', sizes: ['36', '37', '38', '39'] },
    ],
  },
  {
    name: 'Metro Knit Runner Sneaker',
    slug: 'metro-knit-runner-sneaker',
    categorySlug: 'sneakers',
    price: 3990,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=900&q=86&auto=format&fit=max',
    fitType: 'Cushioned fit',
    fabricContent: 'Knit mesh upper',
    occasion: 'Daily, travel, walking',
    colors: [
      { name: 'White', hex: '#f4f4f0', sizes: ['40', '41', '42', '43'] },
      { name: 'Charcoal', hex: '#33363a', sizes: ['40', '41', '42'] },
    ],
  },
  {
    name: 'Signature Quilted Mini Bag',
    slug: 'signature-quilted-mini-bag',
    categorySlug: 'accessories',
    price: 2890,
    compareAtPrice: 3290,
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=900&q=86&auto=format&fit=max',
    isFeatured: true,
    fitType: 'Mini crossbody',
    fabricContent: 'Quilted vegan leather',
    occasion: 'Evening, party, daily carry',
    colors: [
      { name: 'Black', hex: '#111111', sizes: ['One Size'] },
      { name: 'Ivory', hex: '#eee6d8', sizes: ['One Size'] },
    ],
  },
  {
    name: 'Ivory Linen Co-ord Set',
    slug: 'ivory-linen-co-ord-set',
    categorySlug: 'dresses',
    price: 4690,
    compareAtPrice: 5290,
    image: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=900&q=86&auto=format&fit=max',
    isNewArrival: true,
    fitType: 'Relaxed co-ord',
    fabricContent: 'Linen viscose blend',
    occasion: 'Brunch, office, travel',
    colors: [
      { name: 'Ivory', hex: '#eee8dc', sizes: ['S', 'M', 'L', 'XL'] },
      { name: 'Clay', hex: '#b58b74', sizes: ['S', 'M', 'L'] },
    ],
  },
  {
    name: 'Meadow Printed Everyday Kurti',
    slug: 'meadow-printed-everyday-kurti',
    categorySlug: 'kurti-tunics',
    price: 2490,
    compareAtPrice: 2890,
    image: 'https://images.unsplash.com/photo-1594709287485-447f40e8d7a8?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&q=86&auto=format&fit=max',
    isBestSeller: true,
    fitType: 'Straight comfort fit',
    fabricContent: 'Printed cotton',
    occasion: 'Daily, campus, family visit',
    colors: [
      { name: 'Meadow', hex: '#7d9366', sizes: ['S', 'M', 'L', 'XL'] },
      { name: 'Rust', hex: '#a85f45', sizes: ['M', 'L', 'XL'] },
    ],
  },
  {
    name: 'Monsoon Soft Cotton Saree',
    slug: 'monsoon-soft-cotton-saree',
    categorySlug: 'sarees',
    price: 3290,
    image: 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&q=86&auto=format&fit=max',
    isFeatured: true,
    fitType: 'Classic drape',
    fabricContent: 'Soft cotton',
    occasion: 'Work, puja, home event',
    colors: [
      { name: 'Cloud', hex: '#dce3e8', sizes: ['Free Size'] },
      { name: 'Teal', hex: '#2f6f73', sizes: ['Free Size'] },
    ],
  },
  {
    name: 'Velvet Evening Shalwar Kameez',
    slug: 'velvet-evening-shalwar-kameez',
    categorySlug: 'shalwar-kameez',
    price: 5890,
    compareAtPrice: 6490,
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&q=86&auto=format&fit=max',
    badge: 'Limited',
    fitType: 'Elegant fit',
    fabricContent: 'Velvet georgette blend',
    occasion: 'Wedding, dinner, evening program',
    colors: [
      { name: 'Maroon', hex: '#6f1d2d', sizes: ['S', 'M', 'L', 'XL'] },
      { name: 'Emerald', hex: '#0f5c4b', sizes: ['M', 'L', 'XL'] },
    ],
  },
  {
    name: 'Premium Cotton Polo',
    slug: 'premium-cotton-polo',
    categorySlug: 'polos',
    price: 1890,
    compareAtPrice: 2190,
    image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&q=86&auto=format&fit=max',
    isBestSeller: true,
    fitType: 'Smart regular fit',
    fabricContent: 'Pique cotton',
    occasion: 'Daily, office casual, weekend',
    colors: [
      { name: 'Navy', hex: '#17233f', sizes: ['M', 'L', 'XL', 'XXL'] },
      { name: 'White', hex: '#f7f7f2', sizes: ['M', 'L', 'XL'] },
    ],
  },
  {
    name: 'Executive Oxford Shirt',
    slug: 'executive-oxford-shirt',
    categorySlug: 'formal-shirts',
    price: 2790,
    image: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=900&q=86&auto=format&fit=max',
    isFeatured: true,
    fitType: 'Office tailored fit',
    fabricContent: 'Oxford cotton',
    occasion: 'Office, meeting, formal dinner',
    colors: [
      { name: 'Sky', hex: '#b8d4e8', sizes: ['M', 'L', 'XL'] },
      { name: 'Graphite', hex: '#4a4d52', sizes: ['M', 'L', 'XL', 'XXL'] },
    ],
  },
  {
    name: 'Heritage Jacquard Panjabi',
    slug: 'heritage-jacquard-panjabi',
    categorySlug: 'panjabi',
    price: 4490,
    compareAtPrice: 4990,
    image: 'https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=900&q=86&auto=format&fit=max',
    badge: 'New',
    fitType: 'Classic fit',
    fabricContent: 'Jacquard cotton blend',
    occasion: 'Eid, Jummah, family gathering',
    colors: [
      { name: 'Cream', hex: '#e6dcc8', sizes: ['M', 'L', 'XL', 'XXL'] },
      { name: 'Midnight', hex: '#151d33', sizes: ['M', 'L', 'XL'] },
    ],
  },
  {
    name: 'Modern Chino Trouser',
    slug: 'modern-chino-trouser',
    categorySlug: 'trousers',
    price: 2990,
    image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=86&auto=format&fit=max',
    fitType: 'Tapered fit',
    fabricContent: 'Cotton twill stretch',
    occasion: 'Office, travel, smart casual',
    colors: [
      { name: 'Khaki', hex: '#b9a77f', sizes: ['30', '32', '34', '36'] },
      { name: 'Charcoal', hex: '#33363a', sizes: ['30', '32', '34'] },
    ],
  },
  {
    name: 'Girls Embroidered Tunic Set',
    slug: 'girls-embroidered-tunic-set',
    categorySlug: 'girls-wear',
    price: 2690,
    compareAtPrice: 2990,
    image: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&q=86&auto=format&fit=max',
    isNewArrival: true,
    fitType: 'Easy festive fit',
    fabricContent: 'Cotton voile embroidery',
    occasion: 'Birthday, Eid, family program',
    colors: [
      { name: 'Lilac', hex: '#c8b6d8', sizes: ['4-5Y', '6-7Y', '8-9Y'] },
      { name: 'Peach', hex: '#f3b49f', sizes: ['4-5Y', '6-7Y'] },
    ],
  },
  {
    name: 'Boys Linen Panjabi Set',
    slug: 'boys-linen-panjabi-set',
    categorySlug: 'boys-wear',
    price: 2590,
    image: 'https://images.unsplash.com/photo-1503919005314-30d93d07d823?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&q=86&auto=format&fit=max',
    isFeatured: true,
    fitType: 'Comfort festive fit',
    fabricContent: 'Linen cotton',
    occasion: 'Jummah, Eid, dawah',
    colors: [
      { name: 'Mint', hex: '#b9d7c2', sizes: ['4-5Y', '6-7Y', '8-9Y'] },
      { name: 'Sand', hex: '#c8b89b', sizes: ['6-7Y', '8-9Y'] },
    ],
  },
  {
    name: 'Girls Weekend Denim Dress',
    slug: 'girls-weekend-denim-dress',
    categorySlug: 'kids',
    price: 2290,
    compareAtPrice: 2590,
    image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=900&q=86&auto=format&fit=max',
    fitType: 'Play fit',
    fabricContent: 'Soft denim cotton',
    occasion: 'Weekend, school event, travel',
    colors: [
      { name: 'Blue', hex: '#5d7fa3', sizes: ['4-5Y', '6-7Y', '8-9Y'] },
      { name: 'Pink', hex: '#e5a7b6', sizes: ['4-5Y', '6-7Y'] },
    ],
  },
  {
    name: 'Court Leather Loafer',
    slug: 'court-leather-loafer',
    categorySlug: 'men-footwear',
    price: 4590,
    compareAtPrice: 5190,
    image: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1610398752800-146f269dfcc8?w=900&q=86&auto=format&fit=max',
    isBestSeller: true,
    fitType: 'Formal comfort fit',
    fabricContent: 'Genuine leather upper',
    occasion: 'Office, formal event, wedding',
    colors: [
      { name: 'Brown', hex: '#6b3f2b', sizes: ['40', '41', '42', '43'] },
      { name: 'Black', hex: '#111111', sizes: ['40', '41', '42'] },
    ],
  },
  {
    name: 'Cloud Walk Slip-On Sneaker',
    slug: 'cloud-walk-slip-on-sneaker',
    categorySlug: 'sneakers',
    price: 3490,
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=86&auto=format&fit=max',
    isNewArrival: true,
    fitType: 'Cushioned slip-on',
    fabricContent: 'Knit mesh and rubber sole',
    occasion: 'Daily, walking, travel',
    colors: [
      { name: 'Grey', hex: '#a1a5a8', sizes: ['40', '41', '42', '43'] },
      { name: 'Black', hex: '#101010', sizes: ['40', '41', '42'] },
    ],
  },
  {
    name: 'Sienna Ankle Strap Heel',
    slug: 'sienna-ankle-strap-heel',
    categorySlug: 'women-footwear',
    price: 3390,
    compareAtPrice: 3790,
    image: 'https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=900&q=86&auto=format&fit=max',
    fitType: 'Stable heel',
    fabricContent: 'Faux suede',
    occasion: 'Party, dinner, office event',
    colors: [
      { name: 'Sienna', hex: '#9a5a3d', sizes: ['36', '37', '38', '39'] },
      { name: 'Black', hex: '#111111', sizes: ['36', '37', '38'] },
    ],
  },
  {
    name: 'Heritage Canvas Tote',
    slug: 'heritage-canvas-tote',
    categorySlug: 'bags',
    price: 1790,
    image: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=900&q=86&auto=format&fit=max',
    isFeatured: true,
    fitType: 'Daily tote',
    fabricContent: 'Canvas with vegan leather trim',
    occasion: 'Daily, campus, office carry',
    colors: [
      { name: 'Natural', hex: '#d8c7ac', sizes: ['One Size'] },
      { name: 'Black', hex: '#111111', sizes: ['One Size'] },
    ],
  },
  {
    name: 'Minimal Steel Watch',
    slug: 'minimal-steel-watch',
    categorySlug: 'watches',
    price: 3990,
    compareAtPrice: 4490,
    image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?w=900&q=86&auto=format&fit=max',
    fitType: 'Adjustable strap',
    fabricContent: 'Stainless steel',
    occasion: 'Office, gift, daily wear',
    colors: [
      { name: 'Silver', hex: '#bfc3c7', sizes: ['One Size'] },
      { name: 'Black', hex: '#111111', sizes: ['One Size'] },
    ],
  },
  {
    name: 'Classic Prayer Cap Set',
    slug: 'classic-prayer-cap-set',
    categorySlug: 'prayer-caps',
    price: 790,
    image: 'https://images.unsplash.com/photo-1593032465175-481ac7f401a0?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1593032465175-481ac7f401a0?w=900&q=86&auto=format&fit=max',
    fitType: 'Soft stretch fit',
    fabricContent: 'Cotton knit',
    occasion: 'Prayer, Jummah, daily',
    colors: [
      { name: 'White', hex: '#f7f7f2', sizes: ['One Size'] },
      { name: 'Black', hex: '#111111', sizes: ['One Size'] },
    ],
  },
  {
    name: 'Soft Modal Scarf',
    slug: 'soft-modal-scarf',
    categorySlug: 'scarves',
    price: 1290,
    compareAtPrice: 1490,
    image: 'https://images.unsplash.com/photo-1601924921557-45e6dea0a157?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=900&q=86&auto=format&fit=max',
    isNewArrival: true,
    fitType: 'Lightweight drape',
    fabricContent: 'Modal blend',
    occasion: 'Daily, office, travel',
    colors: [
      { name: 'Taupe', hex: '#a89482', sizes: ['One Size'] },
      { name: 'Dusty Pink', hex: '#d3a5ad', sizes: ['One Size'] },
    ],
  },
  {
    name: 'Travel Leather Backpack',
    slug: 'travel-leather-backpack',
    categorySlug: 'bags',
    price: 1590,
    compareAtPrice: 1890,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=900&q=86&auto=format&fit=max',
    isBestSeller: true,
    fitType: 'Structured travel carry',
    fabricContent: 'Genuine leather finish',
    occasion: 'Office, travel, daily',
    colors: [
      { name: 'Brown', hex: '#6b3f2b', sizes: ['One Size'] },
      { name: 'Black', hex: '#111111', sizes: ['One Size'] },
    ],
  },
  {
    name: 'Weekend Crossbody Wallet',
    slug: 'weekend-crossbody-wallet',
    categorySlug: 'wallets',
    price: 2190,
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=900&q=86&auto=format&fit=max',
    hoverImage: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=900&q=86&auto=format&fit=max',
    fitType: 'Compact crossbody',
    fabricContent: 'Vegan leather',
    occasion: 'Daily, travel, evening',
    colors: [
      { name: 'Camel', hex: '#b6845c', sizes: ['One Size'] },
      { name: 'Black', hex: '#111111', sizes: ['One Size'] },
    ],
  },
]

function skuFor(slug: string, index: number) {
  return `SPL-QA-${String(index + 1).padStart(2, '0')}-${slug.slice(0, 12).replace(/-/g, '').toUpperCase()}`
}

async function ensureCategoryTree(storeId: string) {
  const categories = new Map<string, string>()
  for (const dept of CATEGORY_DEPARTMENTS) {
    const row = await prisma.category.upsert({
      where: { storeId_slug: { storeId, slug: dept.slug } },
      create: { storeId, name: dept.name, slug: dept.slug, sortOrder: dept.sortOrder },
      update: { name: dept.name, sortOrder: dept.sortOrder, isActive: true },
    })
    categories.set(dept.slug, row.id)
  }

  for (const [parentSlug, children] of Object.entries(CATEGORY_SUBCATEGORIES)) {
    const parentId = categories.get(parentSlug)
    if (!parentId) continue
    for (const [index, child] of children.entries()) {
      const row = await prisma.category.upsert({
        where: { storeId_slug: { storeId, slug: child.slug } },
        create: {
          storeId,
          parentId,
          name: child.name,
          slug: child.slug,
          sortOrder: index + 1,
        },
        update: { parentId, name: child.name, sortOrder: index + 1, isActive: true },
      })
      categories.set(child.slug, row.id)
    }
  }

  return categories
}

async function invalidateCatalogCache(storeId: string) {
  if (process.env['REDIS_ENABLED'] === 'false') return
  const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
    password: process.env['REDIS_PASSWORD'] || undefined,
    db: Number(process.env['REDIS_DB'] ?? '0'),
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
  })

  try {
    await redis.connect()
    const resources = ['products', 'product', 'categories', 'collections', 'nav']
    for (const resource of resources) {
      const base = `splaro:${storeId}:${resource}`
      await redis.del(base)
      let cursor = '0'
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', `${base}:*`, 'COUNT', 100)
        cursor = next
        if (keys.length) await redis.del(...keys)
      } while (cursor !== '0')
    }
  } catch {
    // API will refresh after TTL if Redis is unavailable.
  } finally {
    redis.disconnect()
  }
}

async function migrateLegacySlugs(storeId: string) {
  const legacy = await prisma.product.findUnique({
    where: { storeId_slug: { storeId, slug: 'travel-leather-belt' } },
    select: { id: true },
  })
  if (!legacy) return

  const taken = await prisma.product.findUnique({
    where: { storeId_slug: { storeId, slug: 'travel-leather-backpack' } },
    select: { id: true },
  })
  if (taken && taken.id !== legacy.id) {
    await prisma.product.delete({ where: { id: legacy.id } })
    return
  }

  await prisma.product.update({
    where: { id: legacy.id },
    data: { slug: 'travel-leather-backpack', name: 'Travel Leather Backpack' },
  })
}

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: 'splaro' } })
  if (!store) throw new Error('Store "splaro" not found. Run pnpm db:seed first.')

  await migrateLegacySlugs(store.id)
  const categories = await ensureCategoryTree(store.id)
  const touched: string[] = []

  for (const [index, seed] of PRODUCTS.entries()) {
    const categoryId = categories.get(seed.categorySlug) ?? categories.get('women')
    if (!categoryId) throw new Error(`Category missing for ${seed.slug}`)
    const sku = skuFor(seed.slug, index)
    const existing = await prisma.product.findUnique({
      where: { storeId_slug: { storeId: store.id, slug: seed.slug } },
      select: { id: true },
    })

    const common = {
      storeId: store.id,
      categoryId,
      name: seed.name,
      slug: seed.slug,
      shortDescription: `${seed.name} — premium SPLARO piece for everyday wear.`,
      description:
        `${seed.name} by SPLARO — crafted with quality materials and a refined finish. Designed for everyday comfort, easy styling, and lasting wear across Bangladesh.`,
      basePrice: seed.price,
      compareAtPrice: seed.compareAtPrice ?? null,
      isPublished: true,
      isHidden: false,
      status: 'PUBLISHED',
      isFeatured: seed.isFeatured ?? false,
      isNewArrival: seed.isNewArrival ?? false,
      isBestSeller: seed.isBestSeller ?? false,
      isOnSale: Boolean(seed.compareAtPrice && seed.compareAtPrice > seed.price),
      badge: seed.badge ?? null,
      sku,
      fabricContent: seed.fabricContent ?? 'Premium fabric',
      fitType: seed.fitType ?? 'Regular fit',
      occasion: seed.occasion ?? 'Everyday',
      origin: 'Bangladesh',
      tags: ['qa-catalog', seed.categorySlug],
      metaTitle: `${seed.name} | SPLARO`,
      metaDescription: `Shop ${seed.name} at SPLARO Bangladesh. Premium fashion with fast nationwide delivery and easy returns.`,
      metaKeywords: ['SPLARO', seed.name, seed.categorySlug, 'Bangladesh fashion'],
    }

    const product = existing
      ? await prisma.product.update({ where: { id: existing.id }, data: common })
      : await prisma.product.create({ data: common })

    await prisma.productVariant.deleteMany({ where: { productId: product.id } })
    await prisma.productImage.deleteMany({ where: { productId: product.id } })

    await prisma.productImage.createMany({
      data: [
        { productId: product.id, url: seed.image, altText: seed.name, position: 0, isDefault: true },
        { productId: product.id, url: seed.hoverImage, altText: `${seed.name} alternate`, position: 1, isDefault: false },
      ],
    })

    await prisma.productVariant.createMany({
      data: seed.colors.flatMap((color) =>
        color.sizes.map((size) => ({
          productId: product.id,
          sku: `${sku}-${size}-${color.name}`.replace(/\s+/g, '-').slice(0, 80),
          size,
          color: color.name,
          colorName: color.name,
          colorHex: color.hex,
          price: seed.price,
          compareAtPrice: seed.compareAtPrice ?? null,
          stock: 18,
          image: color.image ?? seed.image,
          isActive: true,
        })),
      ),
    })

    touched.push(seed.slug)
  }

  await invalidateCatalogCache(store.id)

  console.log(`Seeded/updated ${touched.length} QA products:`)
  for (const slug of touched) console.log(`- ${slug}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

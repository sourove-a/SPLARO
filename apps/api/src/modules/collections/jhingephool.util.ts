import { BadRequestException } from '@nestjs/common'
import { isJhingephoolCollectionSlug, isSareeCategorySlug } from '@splaro/types'
import type { PrismaService } from '../../common/prisma.service'

const JHINGEPHOOL_SLUG = 'jhingephool'
const JHINGEPHOOL_NAME = 'ঝিঙেফুল'
const JHINGEPHOOL_DESCRIPTION = 'Premium handloom sarees — ঝিঙেফুল by SPLARO.'
const JHINGEPHOOL_LOGO = '/images/logo/jhingephool-logo-horizontal.png'
const SPLARO_BRAND_SLUG = 'splaro'
const SPLARO_BRAND_NAME = 'SPLARO'
const SPLARO_BRAND_LOGO = '/images/logo/splaro-logo-black-premium.webp'
const MYROX_BRAND_SLUG = 'myrox'
const MYROX_BRAND_NAME = 'MYROX'
const MYROX_BRAND_VENDOR = 'MYROX Lifestyle'
const MYROX_BRAND_LOGO = '/images/logo/myrox-logo-horizontal.webp'

export async function ensureJhingephoolCollection(prisma: PrismaService, storeId: string) {
  await prisma.collection.upsert({
    where: { storeId_slug: { storeId, slug: JHINGEPHOOL_SLUG } },
    create: {
      storeId,
      name: JHINGEPHOOL_NAME,
      slug: JHINGEPHOOL_SLUG,
      description: JHINGEPHOOL_DESCRIPTION,
      image: JHINGEPHOOL_LOGO,
      isActive: true,
      sortOrder: 0,
    },
    update: { image: JHINGEPHOOL_LOGO, name: JHINGEPHOOL_NAME },
  })
}

interface HouseBrand {
  slug: string
  name: string
  vendorLabel: string
  /** Shipped default. Seeds a brand that has no mark; never replaces one. */
  logo?: string
}

/**
 * Keeps a house brand on the store without ever overwriting its logo.
 *
 * The name is ours to keep correct, so the upsert still repairs it. The logo is
 * not: pinning it in `update` reverted every mark uploaded from the product
 * form's "Add brand logo" button on the very next brand list. A brand that has
 * no mark at all is still healed below, which is all the pin was needed for.
 */
async function ensureHouseBrand(prisma: PrismaService, storeId: string, brand: HouseBrand) {
  await prisma.brand.upsert({
    where: { storeId_slug: { storeId, slug: brand.slug } },
    create: {
      storeId,
      name: brand.name,
      slug: brand.slug,
      logo: brand.logo,
      vendorLabel: brand.vendorLabel,
      country: 'Bangladesh',
      isActive: true,
    },
    update: { name: brand.name },
  })

  if (!brand.logo) return
  await prisma.brand.updateMany({
    where: { storeId, slug: brand.slug, OR: [{ logo: null }, { logo: '' }] },
    data: { logo: brand.logo },
  })
}

export async function ensureJhingephoolBrand(prisma: PrismaService, storeId: string) {
  await ensureHouseBrand(prisma, storeId, {
    slug: JHINGEPHOOL_SLUG,
    name: JHINGEPHOOL_NAME,
    vendorLabel: 'ঝিঙেফুল by SPLARO',
    logo: JHINGEPHOOL_LOGO,
  })
}

export async function ensureSplaroBrand(prisma: PrismaService, storeId: string) {
  await ensureHouseBrand(prisma, storeId, {
    slug: SPLARO_BRAND_SLUG,
    name: SPLARO_BRAND_NAME,
    vendorLabel: 'In-house',
    logo: SPLARO_BRAND_LOGO,
  })
}

export async function ensureMyroxBrand(prisma: PrismaService, storeId: string) {
  await ensureHouseBrand(prisma, storeId, {
    slug: MYROX_BRAND_SLUG,
    name: MYROX_BRAND_NAME,
    vendorLabel: MYROX_BRAND_VENDOR,
    logo: MYROX_BRAND_LOGO,
  })
}

export async function assertJhingephoolSareeOnly(
  prisma: PrismaService,
  collectionId: string,
  categoryId: string | null | undefined,
) {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { slug: true },
  })
  if (!collection || !isJhingephoolCollectionSlug(collection.slug)) return
  if (!categoryId) {
    throw new BadRequestException('ঝিঙেফুল is saree-only. Pick the Saree category.')
  }
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { slug: true, name: true },
  })
  if (!category || (!isSareeCategorySlug(category.slug) && !isSareeCategorySlug(category.name))) {
    throw new BadRequestException('ঝিঙেফুল is saree-only. Pick the Saree category.')
  }
}

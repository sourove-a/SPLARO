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

export async function ensureJhingephoolBrand(prisma: PrismaService, storeId: string) {
  await prisma.brand.upsert({
    where: { storeId_slug: { storeId, slug: JHINGEPHOOL_SLUG } },
    create: {
      storeId,
      name: JHINGEPHOOL_NAME,
      slug: JHINGEPHOOL_SLUG,
      logo: JHINGEPHOOL_LOGO,
      vendorLabel: 'ঝিঙেফুল by SPLARO',
      country: 'Bangladesh',
      isActive: true,
    },
    update: { logo: JHINGEPHOOL_LOGO, name: JHINGEPHOOL_NAME },
  })
}

export async function ensureSplaroBrand(prisma: PrismaService, storeId: string) {
  await prisma.brand.upsert({
    where: { storeId_slug: { storeId, slug: SPLARO_BRAND_SLUG } },
    create: {
      storeId,
      name: SPLARO_BRAND_NAME,
      slug: SPLARO_BRAND_SLUG,
      logo: SPLARO_BRAND_LOGO,
      vendorLabel: 'In-house',
      country: 'Bangladesh',
      isActive: true,
    },
    update: { logo: SPLARO_BRAND_LOGO, name: SPLARO_BRAND_NAME },
  })
}

export async function ensureMyroxBrand(prisma: PrismaService, storeId: string) {
  await prisma.brand.upsert({
    where: { storeId_slug: { storeId, slug: MYROX_BRAND_SLUG } },
    create: {
      storeId,
      name: MYROX_BRAND_NAME,
      slug: MYROX_BRAND_SLUG,
      vendorLabel: MYROX_BRAND_VENDOR,
      country: 'Bangladesh',
      isActive: true,
    },
    // No logo key here on purpose. MYROX's mark is uploaded from the product
    // form's "Add brand logo" button, so pinning one would revert that upload
    // on the next brand list — the way SPLARO and ঝিঙেফুল currently do.
    update: { name: MYROX_BRAND_NAME },
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

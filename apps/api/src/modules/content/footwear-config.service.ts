import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { CacheService } from '../../common/cache.service'
import { resolveStoreId } from '../../common/store.util'
import { mergeStorefrontConfig, type StorefrontConfig } from '../settings/storefront-config'

export type FootwearPageConfig = Record<string, unknown>

const DEFAULT_FOOTWEAR_CONFIG: FootwearPageConfig = {
  heroBanner: {
    visible: true,
    image: '/images/footwear/hero-banner.jpg',
    alt: 'SPLARO Footwear Collection',
    title: 'Step Into Luxury',
    subtitle: 'Handcrafted footwear for the discerning few',
  },
  shopByCategory: {
    visible: true,
    title: 'Shop By Category',
    categories: [
      { id: 'men', label: 'Men', image: '/images/footwear/cat-men.jpg', href: '/footwear/men', visible: true },
      { id: 'women', label: 'Women', image: '/images/footwear/cat-women.jpg', href: '/footwear/women', visible: true },
      { id: 'kids', label: 'Kids', image: '/images/footwear/cat-kids.jpg', href: '/footwear/kids', visible: true },
    ],
  },
  productRows: [],
}

@Injectable()
export class FootwearConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private readFromConfig(raw: unknown): FootwearPageConfig {
    const config = mergeStorefrontConfig(raw)
    const footwear = config.footwear
    if (footwear && typeof footwear === 'object') {
      return footwear as FootwearPageConfig
    }
    return DEFAULT_FOOTWEAR_CONFIG
  }

  async get(storeIdRaw: string): Promise<FootwearPageConfig> {
    const store = await resolveStoreId(this.prisma, storeIdRaw)
    return this.cache.getOrSet(this.cache.storeKey(store, 'footwear-config'), 120, async () => {
      const settings = await this.prisma.siteSettings.findUnique({
        where: { storeId: store },
        select: { storefrontConfig: true },
      })
      return this.readFromConfig(settings?.storefrontConfig)
    })
  }

  async upsert(storeIdRaw: string, body: FootwearPageConfig): Promise<FootwearPageConfig> {
    const store = await resolveStoreId(this.prisma, storeIdRaw)
    const current = mergeStorefrontConfig(
      (
        await this.prisma.siteSettings.findUnique({
          where: { storeId: store },
          select: { storefrontConfig: true },
        })
      )?.storefrontConfig,
    )

    const nextConfig: StorefrontConfig = {
      ...current,
      footwear: body,
    }

    await this.prisma.siteSettings.upsert({
      where: { storeId: store },
      create: {
        storeId: store,
        storefrontConfig: nextConfig as object,
      },
      update: {
        storefrontConfig: nextConfig as object,
      },
    })

    await this.cache.invalidateStoreResource(store, 'footwear-config')
    await this.cache.invalidateStoreResource(store, 'settings')

    return body
  }
}

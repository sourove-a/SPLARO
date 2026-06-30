'use client'

import { useMemo } from 'react'
import {
  DEFAULT_CATALOG_CHANNELS,
  filterNavByCatalogChannels,
  getPublishedShopCategories,
  isCatalogChannelPublished,
  mergeCatalogChannels,
  type CatalogChannel,
} from '@splaro/types'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import type { Category } from '@/data/storefront'

export function useCatalogChannels(): CatalogChannel[] {
  const { config } = useStorefrontSettings()
  return useMemo(
    () => mergeCatalogChannels(config.catalogChannels),
    [config.catalogChannels],
  )
}

export function usePublishedShopCategories(): Category[] {
  const channels = useCatalogChannels()
  return useMemo(() => {
    const published = getPublishedShopCategories(channels)
    return ['All', ...published] as Category[]
  }, [channels])
}

export function useVisibleNavLinks<T extends { href: string }>(links: T[] | undefined): T[] {
  const channels = useCatalogChannels()
  return useMemo(
    () => filterNavByCatalogChannels(links ?? [], channels),
    [links, channels],
  )
}

export function useIsCatalogSlugPublished(slug: string): boolean {
  const channels = useCatalogChannels()
  return isCatalogChannelPublished(channels, slug)
}

export function usePublishedCollectionTiles<T extends { href: string; label: string }>(
  tiles: T[],
): T[] {
  const channels = useCatalogChannels()
  return useMemo(() => {
    const published = new Set(
      channels.filter((channel) => channel.published).map((channel) => channel.href),
    )
    return tiles.filter((tile) => published.has(tile.href))
  }, [tiles, channels])
}

export { DEFAULT_CATALOG_CHANNELS }

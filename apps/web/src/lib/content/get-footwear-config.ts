import { getServerApiBaseUrl } from '@splaro/config'
import type { FootwearConfig } from '@/components/footwear/FootwearPage'
import configJson from '@/data/footwear-page-config.json'
import { fetchWithTimeout } from '@/lib/server/build-safe-fetch'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

export async function getFootwearPageConfig(): Promise<FootwearConfig> {
  const fallback = configJson as FootwearConfig

  try {
    const base = getServerApiBaseUrl()
    const res = await fetchWithTimeout(
      `${base}/storefront/footwear?storeId=${encodeURIComponent(STORE_ID)}`,
      { next: { revalidate: 120, tags: ['storefront-settings'] } },
    )
    if (!res?.ok) return fallback
    const data = (await res.json()) as FootwearConfig
    return {
      ...fallback,
      ...data,
      heroBanner: { ...fallback.heroBanner, ...data.heroBanner },
      shopByCategory: { ...fallback.shopByCategory, ...data.shopByCategory },
      productRows: data.productRows?.length ? data.productRows : fallback.productRows,
    }
  } catch {
    return fallback
  }
}

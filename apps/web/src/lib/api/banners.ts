import { getApiBaseUrl } from '@splaro/config'
import { fetchWithTimeout, isCiOrProductionBuild } from '@/lib/server/build-safe-fetch'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

export interface HeroBanner {
  id: string
  title?: string | null
  subtitle?: string | null
  image: string
  linkUrl?: string | null
  sortOrder: number
}

export async function fetchHeroBanners(): Promise<HeroBanner[]> {
  if (isCiOrProductionBuild()) {
    return []
  }

  try {
    const base = getApiBaseUrl()
    const res = await fetchWithTimeout(
      `${base}/storefront/banners?storeId=${encodeURIComponent(STORE_ID)}`,
      { next: { revalidate: 10 } },
    )
    if (!res?.ok) return []
    const data = (await res.json()) as { banners?: HeroBanner[] }
    return data.banners?.filter((banner) => banner.image?.trim()) ?? []
  } catch {
    return []
  }
}

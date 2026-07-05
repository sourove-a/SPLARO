import { getServerApiBaseUrl } from '@splaro/config'
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

  const base = getServerApiBaseUrl()
  const url = `${base}/storefront/banners?storeId=${encodeURIComponent(STORE_ID)}`

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {
        next: { revalidate: 30, tags: ['hero-banners'] },
        timeoutMs: 12_000,
      })
      if (!res?.ok) continue
      const data = (await res.json()) as { banners?: HeroBanner[] }
      return data.banners?.filter((banner) => banner.image?.trim()) ?? []
    } catch {
      /* retry once */
    }
  }

  return []
}

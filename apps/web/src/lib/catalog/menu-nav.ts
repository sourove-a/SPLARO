import { getServerApiBaseUrl } from '@splaro/config'
import { fetchWithTimeout } from '@/lib/server/build-safe-fetch'
import { settingsFetchTimeoutMs } from '@/lib/server/fetch-timeouts'
import type { MegaMenuConfig, NavLink } from '@/lib/storefront/settings'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

interface LiveMenuItem {
  id: string
  label: string
  url?: string | null
  sortOrder?: number
  megaMenuData?: MegaMenuConfig | null
  children?: LiveMenuItem[]
}

interface LiveMenuResponse {
  menu?: {
    items?: LiveMenuItem[]
  } | null
}

function mapMenuItem(item: LiveMenuItem): NavLink {
  const link: NavLink = {
    label: item.label,
    href: item.url?.trim() || '/',
  }
  if (item.megaMenuData && typeof item.megaMenuData === 'object') {
    link.megaMenu = item.megaMenuData
  }
  return link
}

/** Header nav from Menu table when admin has seeded / saved a header menu. */
export async function fetchLiveHeaderNav(): Promise<NavLink[] | null> {
  const base = getServerApiBaseUrl()
  const url = `${base}/storefront/menu/header?storeId=${encodeURIComponent(STORE_ID)}`

  try {
    const res = await fetchWithTimeout(url, {
      next: { revalidate: 120, tags: ['storefront-menu-header'] },
      timeoutMs: settingsFetchTimeoutMs(),
    })
    if (!res?.ok) return null
    const data = (await res.json()) as LiveMenuResponse
    const items = data.menu?.items ?? []
    if (!items.length) return null
    return items
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(mapMenuItem)
  } catch {
    return null
  }
}

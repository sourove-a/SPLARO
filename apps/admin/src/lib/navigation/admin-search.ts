import type { CommandNavItem } from '@/lib/navigation/admin-nav'

const MIN_QUERY_LENGTH = 2

function scoreCommandItem(item: CommandNavItem, query: string): number {
  const label = item.label.toLowerCase()
  const slug = item.href.replace(/^\/dashboard\/?/, '').toLowerCase()
  const slugParts = slug.split('/').filter(Boolean)
  const group = item.group.toLowerCase()
  const description = (item.description ?? '').toLowerCase()
  const labelWords = label.split(/\s+/).filter(Boolean)

  if (label === query) return 1000
  if (label.startsWith(query)) return 900
  if (slug === query || slug.replace(/-/g, '') === query.replace(/\s+/g, '')) return 880

  if (labelWords.some((word) => word.startsWith(query))) return 850
  if (slugParts.some((part) => part.startsWith(query) || part.replace(/-/g, '').startsWith(query))) return 820

  if (query.length >= 3 && label.includes(query)) return 700
  if (query.length >= 3 && slug.includes(query)) return 650
  if (group.startsWith(query) || (query.length >= 3 && group.includes(query))) return 500

  if (query.length >= 4) {
    const descWords = description.split(/\s+/).filter(Boolean)
    if (descWords.some((word) => word.startsWith(query))) return 300
  }

  return 0
}

export function filterCommandItems(items: CommandNavItem[], query: string): CommandNavItem[] {
  const normalized = query.trim().toLowerCase()
  if (normalized.length < MIN_QUERY_LENGTH) return []

  return items
    .map((item) => ({ item, score: scoreCommandItem(item, normalized) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .slice(0, 12)
    .map(({ item }) => item)
}

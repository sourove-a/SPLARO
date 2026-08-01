import { scoreProductSeo } from './tools/seo-scoring.util'

export interface SeoBriefProduct {
  id: string
  name: string
  slug: string | null
  metaTitle: string | null
  metaDescription: string | null
}

export interface SeoBriefSearch {
  query: string
}

export interface SeoDailyBrief {
  subject: string
  body: string
  level: 'info' | 'warn'
}

/** Build a deterministic daily target from live catalog + onsite search data.
 *  Google rank is deliberately excluded until Search Console OAuth is connected. */
export function buildSeoDailyBrief(
  products: SeoBriefProduct[],
  searches: SeoBriefSearch[],
): SeoDailyBrief {
  const scored = products
    .map(scoreProductSeo)
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
  const target = scored[0]
  const ready = scored.filter((row) => row.score >= 80).length

  const queryCounts = new Map<string, number>()
  for (const row of searches) {
    const query = row.query.trim().toLowerCase()
    if (query) queryCounts.set(query, (queryCounts.get(query) ?? 0) + 1)
  }
  const demand = [...queryCounts.entries()].sort((a, b) => b[1] - a[1])[0]

  const targetLine = target
    ? `Today's target: ${target.name} — ${target.score}/100${target.issues[0] ? ` · ${target.issues[0]}` : ''}.`
    : 'Today\'s target: publish a product before running a catalog SEO audit.'
  const demandLine = demand
    ? `Onsite demand: “${demand[0]}” — ${demand[1]} searches in the last 30 days.`
    : 'Onsite demand: no customer search signal in the last 30 days.'

  return {
    subject: 'Daily SEO target',
    body: [
      `Catalog baseline: ${ready}/${scored.length} products score 80+ for metadata readiness.`,
      targetLine,
      demandLine,
      'Google ranking unavailable until Search Console OAuth is connected.',
      'No metadata changed automatically. Review and confirm fixes in SEO Health.',
    ].join('\n'),
    level: target && target.score < 80 ? 'warn' : 'info',
  }
}

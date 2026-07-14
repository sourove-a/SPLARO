/** Code-based SEO scoring — no LLM. Returns 0–100 per product. */

export interface SeoScoreResult {
  productId: string
  name: string
  slug: string | null
  score: number
  issues: string[]
  metaTitle: string | null
  metaDescription: string | null
  suggestions: {
    metaTitle?: string
    metaDescription?: string
  }
}

export function scoreProductSeo(product: {
  id: string
  name: string
  slug: string | null
  metaTitle: string | null
  metaDescription: string | null
}): SeoScoreResult {
  const issues: string[] = []
  let score = 100

  const title = product.metaTitle?.trim() ?? ''
  const desc = product.metaDescription?.trim() ?? ''
  const slug = product.slug?.trim() ?? ''

  if (!title) {
    issues.push('Missing meta title')
    score -= 25
  } else if (title.length < 30) {
    issues.push('Meta title too short (<30 chars)')
    score -= 10
  } else if (title.length > 60) {
    issues.push('Meta title too long (>60 chars)')
    score -= 8
  }

  if (!desc) {
    issues.push('Missing meta description')
    score -= 25
  } else if (desc.length < 120) {
    issues.push('Meta description too short (<120 chars)')
    score -= 10
  } else if (desc.length > 160) {
    issues.push('Meta description too long (>160 chars)')
    score -= 8
  }

  if (!slug) {
    issues.push('Missing slug')
    score -= 15
  }

  const suggestions: SeoScoreResult['suggestions'] = {}
  if (!title || title.length < 30) {
    suggestions.metaTitle = `${product.name} | SPLARO Bangladesh`.slice(0, 60)
  }
  if (!desc || desc.length < 120) {
    const base = `Shop ${product.name} at SPLARO — premium women's fashion in Bangladesh. Quality fabric, elegant design, fast delivery.`
    suggestions.metaDescription = base.slice(0, 160)
  }

  return {
    productId: product.id,
    name: product.name,
    slug: product.slug,
    score: Math.max(0, score),
    issues,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    suggestions,
  }
}

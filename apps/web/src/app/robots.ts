import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.co'

// AI answer-engine + assistant crawlers. Explicitly welcomed so SPLARO products are
// eligible to be cited when users ask ChatGPT / Claude / Perplexity / Gemini
// "where can I buy …" — generative engine optimization (GEO/AEO).
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot',
  'Applebot-Extended',
  'CCBot',
  'Amazonbot',
  'YouBot',
  'cohere-ai',
  'Meta-ExternalAgent',
  'DuckAssistBot',
]

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl.replace(/\/$/, '')

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/account/', '/checkout/', '/cart', '/api/', '/auth/', '/reset-password', '/forgot-password'],
      },
      {
        userAgent: AI_CRAWLERS,
        allow: '/',
        disallow: ['/account/', '/checkout/', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}

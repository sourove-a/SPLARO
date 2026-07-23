import type { MetadataRoute } from 'next'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://splaro.co').replace(/\/$/, '')

/**
 * AI answer-engine crawlers — allow catalog + policies so ChatGPT / Claude /
 * Perplexity / Gemini / Copilot can cite SPLARO when users ask where to buy
 * premium fashion in Bangladesh (GEO / AEO).
 */
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
  'GoogleOther',
  'Googlebot',
  'Googlebot-Image',
  'Bingbot',
  'Applebot',
  'Applebot-Extended',
  'CCBot',
  'Amazonbot',
  'YouBot',
  'cohere-ai',
  'Meta-ExternalAgent',
  'FacebookBot',
  'DuckAssistBot',
  'Bytespider',
  'Diffbot',
  'OmigiliBot',
  'AI2Bot',
]

const PRIVATE = ['/account/', '/checkout/', '/cart', '/api/', '/auth/', '/reset-password', '/forgot-password']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/llms.txt', '/ai.txt', '/.well-known/llms.txt', '/sitemap.xml'],
        disallow: PRIVATE,
      },
      {
        userAgent: AI_CRAWLERS,
        allow: ['/', '/llms.txt', '/ai.txt', '/.well-known/llms.txt', '/shop', '/products/', '/faq', '/about', '/contact', '/stores'],
        disallow: ['/account/', '/checkout/', '/api/'],
      },
    ],
    sitemap: [
      `${siteUrl}/sitemap.xml`,
      `${siteUrl}/sitemap-images.xml`,
    ],
    host: siteUrl,
  }
}

export type AgentDifficulty = 'lookup' | 'content' | 'complex'

const LOOKUP_PATTERN =
  /koyta|koto|how many|list|stock|health|status|check|dekhao|report|summary|ajker|today|pending|ache\s*\?/i

const CONTENT_PATTERN =
  /seo|meta|description|dicribtion|prodakt|copy|improve|likho|write|title|slug|content|brand/i

const COMPLEX_PATTERN =
  /shob|all|every|bulk|batch|fix all|multi|confirm|cancel|book courier|steadfast book/i

export function routeByDifficulty(message: string): AgentDifficulty {
  const text = message.trim()
  if (COMPLEX_PATTERN.test(text)) return 'complex'
  if (CONTENT_PATTERN.test(text)) return 'content'
  if (LOOKUP_PATTERN.test(text)) return 'lookup'
  return 'lookup'
}

export function cheapModelForProvider(provider: string): string | undefined {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini'
    case 'claude':
      return 'claude-haiku-4-5'
    case 'gemini':
      return 'gemini-2.5-flash'
    case 'grok':
      return 'grok-4-fast'
    case 'manus':
      return 'manus-1.6-lite'
    default:
      return undefined
  }
}

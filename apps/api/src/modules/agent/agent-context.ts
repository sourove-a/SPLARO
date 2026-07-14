import type { AgentMessage } from './agent.types'
import { AGENT_TOOL_REGISTRY, registryToDefinitions, type ToolCategory, type ToolRegistryEntry } from './tool-registry'

const CATEGORY_PATTERNS: Array<{ categories: ToolCategory[]; pattern: RegExp }> = [
  {
    categories: ['analytics', 'orders'],
    pattern: /ordar|order|sales|sale|revenue|koto|koyta|earning|hisab|ajker|today|week|month/i,
  },
  {
    categories: ['inventory'],
    pattern: /stock|inventory|low stock|kom|variant|warehouse/i,
  },
  {
    categories: ['seo', 'products'],
    pattern: /seo|meta|description|slug|product|prodakt|dicribtion|copy|title/i,
  },
  {
    categories: ['orders'],
    pattern: /courier|steadfast|pathao|deliver|cancel|confirm|invoice|tracking|phone|number|01\d{8,9}/i,
  },
  {
    categories: ['integrations'],
    pattern: /telegram|integration|connect|api key|payment|bkash/i,
  },
  {
    categories: ['diagnostics'],
    pattern: /problem|health|thik|error|down|route|diagnostic|kichu/i,
  },
]

const ALWAYS_INCLUDE = new Set([
  'get_store_health',
  'get_admin_health_report',
  'get_conversation_history',
])

const MAX_TOOL_RESULT_CHARS = 2048
const MAX_ARRAY_ITEMS = 10

const SITE_TERMS = '(?:website|web\\s*site|site|web|admin|dashboard)'
const ISSUE_TERMS = '(?:issue|problem|health|status|thik|ঠিক|সমস্যা)'
const INTEGRATION_TERMS =
  '(?:telegram|integration|connect|connection|api\\s*key|payment|bkash|nagad|steadfast)'
const INTEGRATION_STATE_TERMS = '(?:issue|problem|status|kaj|work|connected)'

/** Intents that must fetch verified live data before the model answers. */
const MANDATORY_READ_TOOLS: Array<{ tool: string; patterns: RegExp[] }> = [
  {
    tool: 'get_admin_health_report',
    patterns: [
      new RegExp(`(?:my|amar|আমার)?\\s*${SITE_TERMS}.*${ISSUE_TERMS}`, 'i'),
      new RegExp(`${ISSUE_TERMS}.*${SITE_TERMS}`, 'i'),
      /problem\s*ki|ki\s*obo(?:st|sth)a|কি\s*অবস্থা|kono\s*problem|কোনো\s*সমস্যা/i,
    ],
  },
  {
    tool: 'get_integration_status',
    patterns: [
      new RegExp(`${INTEGRATION_TERMS}.*${INTEGRATION_STATE_TERMS}`, 'i'),
      new RegExp(`${INTEGRATION_STATE_TERMS}.*${INTEGRATION_TERMS}`, 'i'),
    ],
  },
]

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

/**
 * Some live-data intents must never depend on whether the model chooses to call
 * a tool. Returning a tool name here makes the loop fetch verified data first.
 */
export function mandatoryReadToolForMessage(message: string): string | null {
  const text = message.trim().toLowerCase()
  for (const { tool, patterns } of MANDATORY_READ_TOOLS) {
    if (matchesAny(text, patterns)) return tool
  }
  return null
}

export function filterToolsForMessage(message: string): ToolRegistryEntry[] {
  const text = message.toLowerCase()
  const matched = new Set<ToolCategory>()

  for (const row of CATEGORY_PATTERNS) {
    if (row.pattern.test(text)) {
      for (const cat of row.categories) matched.add(cat)
    }
  }

  let filtered: ToolRegistryEntry[]
  if (matched.size === 0) {
    filtered = AGENT_TOOL_REGISTRY.filter(
      (t) => t.tier === 'READ' || t.category === 'diagnostics' || t.category === 'meta',
    )
  } else {
    filtered = AGENT_TOOL_REGISTRY.filter(
      (t) => matched.has(t.category) || ALWAYS_INCLUDE.has(t.name) || t.tier === 'DANGEROUS',
    )
  }

  if (filtered.length < 4) {
    const names = new Set(filtered.map((t) => t.name))
    for (const t of AGENT_TOOL_REGISTRY) {
      if (t.tier === 'READ' && !names.has(t.name)) {
        filtered.push(t)
        names.add(t.name)
      }
      if (filtered.length >= 8) break
    }
  }

  return filtered.slice(0, 14)
}

export function filterToolsToDefinitions(message: string) {
  return registryToDefinitions(filterToolsForMessage(message))
}

export function truncateToolResult(toolName: string, result: unknown): string {
  const summarized = summarizeValue(result)
  let json = JSON.stringify(summarized)
  if (json.length <= MAX_TOOL_RESULT_CHARS) return json

  const trimmed = {
    tool: toolName,
    truncated: true,
    preview: json.slice(0, MAX_TOOL_RESULT_CHARS - 80),
    note: 'Full result omitted — ask for a narrower query if you need more detail.',
  }
  return JSON.stringify(trimmed)
}

function summarizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) {
    if (value.length <= MAX_ARRAY_ITEMS) return value.map((v) => summarizeValue(v, depth + 1))
    return {
      items: value.slice(0, MAX_ARRAY_ITEMS).map((v) => summarizeValue(v, depth + 1)),
      totalCount: value.length,
      truncated: true,
    }
  }

  if (depth > 2) return '[object]'

  const obj = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  const keys = Object.keys(obj).slice(0, 20)
  for (const key of keys) {
    out[key] = summarizeValue(obj[key], depth + 1)
  }
  if (Object.keys(obj).length > keys.length) {
    out._truncatedKeys = Object.keys(obj).length - keys.length
  }
  return out
}

export function trimHistory(messages: AgentMessage[], maxTurns = 12): AgentMessage[] {
  const nonSystem = messages.filter((m) => m.role !== 'system')
  if (nonSystem.length <= maxTurns * 2) return nonSystem

  const recent = nonSystem.slice(-maxTurns * 2)
  return recent.map((m) => {
    if (m.role === 'tool' && m.content.length > 512) {
      return { ...m, content: m.content.slice(0, 512) + '…[trimmed]' }
    }
    return m
  })
}

export function isConfirmMessage(text: string): boolean {
  const t = text.trim().toLowerCase()
  return (
    /^(confirm|yes|ok|ha|ji|j[iy]|thik ache|thik|ঠিক|জি|হ্যাঁ|হা)$/i.test(t) ||
    t === 'ha thik ache' ||
    t === 'agent:confirm'
  )
}

export function isCancelMessage(text: string): boolean {
  const t = text.trim().toLowerCase()
  return /^(cancel|no|na|nope|না|বাতিল|agent:cancel)$/i.test(t)
}

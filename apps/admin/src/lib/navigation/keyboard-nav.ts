/**
 * Two-key "G then X" navigation, and the recent-pages list behind it.
 *
 * Kept as pure functions because the failure modes are all state ones: a
 * sequence that never times out, a shortcut that fires while the operator is
 * typing an order number, a recents list that grows forever or fills with the
 * same page twice.
 */

export const GOTO_LEADER = 'g'
/** A sequence abandoned mid-way must not fire minutes later. */
export const GOTO_WINDOW_MS = 1200
export const RECENT_PAGES_LIMIT = 5
export const RECENT_PAGES_KEY = 'splaro:admin:recent-pages'

export const GOTO_TARGETS: Record<string, { href: string; label: string }> = {
  d: { href: '/dashboard', label: 'Dashboard' },
  o: { href: '/dashboard/orders', label: 'Orders' },
  p: { href: '/dashboard/products', label: 'Products' },
  c: { href: '/dashboard/customers', label: 'Customers' },
  s: { href: '/dashboard/settings', label: 'Settings' },
}

/**
 * True when a keystroke belongs to whatever the operator is typing into.
 * Without this, typing "go" in the order search would navigate away.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false
  const el = target as HTMLElement
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  return Boolean(el.closest?.('[contenteditable="true"]'))
}

export interface GotoState {
  /** When the leader key was pressed, or null when no sequence is open. */
  armedAt: number | null
}

export type GotoResult =
  | { action: 'arm' }
  | { action: 'navigate'; href: string; label: string }
  | { action: 'reset' }
  | { action: 'ignore' }

/**
 * Resolve one keystroke against the sequence state.
 *
 * Modifier combinations are ignored outright — ⌘G / Ctrl+P belong to the
 * browser, and stealing them would be worse than not having the shortcut.
 */
export function resolveGotoKey(
  state: GotoState,
  key: string,
  opts: { now: number; hasModifier: boolean; typing: boolean },
): GotoResult {
  if (opts.hasModifier || opts.typing) return { action: 'ignore' }

  const lower = key.toLowerCase()
  const armed = state.armedAt !== null && opts.now - state.armedAt <= GOTO_WINDOW_MS

  if (armed) {
    const target = GOTO_TARGETS[lower]
    if (target) return { action: 'navigate', href: target.href, label: target.label }
    return { action: 'reset' }
  }

  if (lower === GOTO_LEADER) return { action: 'arm' }
  return { action: 'ignore' }
}

export interface RecentPage {
  href: string
  label: string
  at: number
}

/**
 * Most-recent-first, de-duplicated by href, capped.
 *
 * Re-visiting a page moves it to the top instead of adding a second row —
 * otherwise a refresh loop would push every other page out of the list.
 */
export function pushRecentPage(
  list: RecentPage[],
  entry: RecentPage,
  limit = RECENT_PAGES_LIMIT,
): RecentPage[] {
  const href = entry.href.trim()
  if (!href) return list
  const rest = list.filter((item) => item.href !== href)
  return [{ ...entry, href }, ...rest].slice(0, limit)
}

/** Parse persisted recents, dropping anything malformed rather than throwing. */
export function parseRecentPages(raw: string | null): RecentPage[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is RecentPage =>
          Boolean(item) &&
          typeof (item as RecentPage).href === 'string' &&
          typeof (item as RecentPage).label === 'string',
      )
      .slice(0, RECENT_PAGES_LIMIT)
  } catch {
    return []
  }
}

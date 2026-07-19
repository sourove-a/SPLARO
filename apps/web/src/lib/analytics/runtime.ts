export type AnalyticsProvider = 'ga' | 'meta'

type QueuedAnalyticsEvent =
  | { provider: 'ga'; name: string; payload: Record<string, unknown> }
  | { provider: 'meta'; name: string; payload: Record<string, unknown>; eventId?: string }

declare global {
  interface Window {
    dataLayer?: unknown[]
    fbq?: (...args: unknown[]) => void
    gtag?: (...args: unknown[]) => void
    __splaroAnalyticsReady?: Partial<Record<AnalyticsProvider, boolean>>
  }
}

const MAX_QUEUE_SIZE = 200
const queue: QueuedAnalyticsEvent[] = []
let listenersAttached = false

function providerIsReady(provider: AnalyticsProvider): boolean {
  if (typeof window === 'undefined') return false
  if (!window.__splaroAnalyticsReady?.[provider]) return false
  return provider === 'ga'
    ? typeof window.gtag === 'function'
    : typeof window.fbq === 'function'
}

function dispatch(event: QueuedAnalyticsEvent): boolean {
  if (typeof window === 'undefined' || !providerIsReady(event.provider)) return false

  try {
    if (event.provider === 'ga') {
      window.gtag?.('event', event.name, event.payload)
    } else {
      window.fbq?.(
        'track',
        event.name,
        event.payload,
        ...(event.eventId ? [{ eventID: event.eventId }] : []),
      )
    }
    return true
  } catch {
    return false
  }
}

function flush(provider: AnalyticsProvider): void {
  for (let index = 0; index < queue.length; ) {
    const event = queue[index]
    if (!event) break
    if (event.provider === provider && dispatch(event)) {
      queue.splice(index, 1)
    } else {
      index += 1
    }
  }
}

function attachReadyListeners(): void {
  if (typeof window === 'undefined' || listenersAttached) return
  listenersAttached = true
  window.addEventListener('splaro:ga-ready', () => flush('ga'))
  window.addEventListener('splaro:meta-ready', () => flush('meta'))
}

function enqueue(event: QueuedAnalyticsEvent): void {
  if (typeof window === 'undefined') return
  attachReadyListeners()
  if (dispatch(event)) return

  if (queue.length >= MAX_QUEUE_SIZE) queue.shift()
  queue.push(event)
}

export function trackGaEvent(name: string, payload: Record<string, unknown> = {}): void {
  enqueue({ provider: 'ga', name, payload })
}

export function trackMetaEvent(
  name: string,
  payload: Record<string, unknown> = {},
  eventId?: string,
): void {
  enqueue({
    provider: 'meta',
    name,
    payload,
    ...(eventId ? { eventId } : {}),
  })
}

export function trackAnalyticsPageView(input: {
  pageLocation: string
  pagePath: string
  pageTitle?: string
}): void {
  trackGaEvent('page_view', {
    page_location: input.pageLocation,
    page_path: input.pagePath,
    ...(input.pageTitle ? { page_title: input.pageTitle } : {}),
  })
  trackMetaEvent('PageView')
}
